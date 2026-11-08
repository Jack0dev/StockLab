package com.stocklab.service.user;

import com.stocklab.domain.exception.ErrorCode;
import com.stocklab.domain.model.Role;
import com.stocklab.domain.model.User;
import com.stocklab.infrastructure.repository.UserRepository;
import com.stocklab.infrastructure.security.JwtUtils;
import com.stocklab.presentation.dto.ApiResponse;
import com.stocklab.presentation.dto.LoginRequest;
import com.stocklab.presentation.dto.LoginResponse;
import com.stocklab.presentation.dto.OtpVerifyRequest;
import com.stocklab.presentation.dto.RegisterRequest;
import com.stocklab.service.OtpService;
import com.stocklab.service.TotpService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Service chuyên trách Xác thực người dùng (Đăng ký, Đăng nhập, JWT Token).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserAuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtils jwtUtils;
    private final OtpService otpService;
    private final TotpService totpService;
    private final UserDetailsService userDetailsService;

    // Cache tạm thời thông tin đăng ký (email -> RegisterRequest)
    private final Map<String, RegisterRequest> pendingRegistrations = new ConcurrentHashMap<>();
    // Fallback store lưu tempToken 2FA khi Redis không khả dụng
    private final Map<String, String> local2faStore = new ConcurrentHashMap<>();

    public ApiResponse<String> register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            return ApiResponse.error(ErrorCode.INVALID_ORDER_PARAMETERS, "Username đã được sử dụng!");
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            return ApiResponse.error(ErrorCode.INVALID_ORDER_PARAMETERS, "Email đã được sử dụng!");
        }

        pendingRegistrations.put(request.getEmail(), request);

        try {
            otpService.sendOtp(request.getEmail());
            return ApiResponse.success("Vui lòng kiểm tra email để lấy mã OTP xác thực.");
        } catch (Exception e) {
            log.error("Lỗi gửi OTP đăng ký cho email {}: {}", request.getEmail(), e.getMessage());
            return ApiResponse.success("Đã gửi thông tin đăng ký, tuy nhiên gửi OTP bị lỗi. Vui lòng nhấn gửi thử lại.");
        }
    }

    public ApiResponse<String> resendRegistrationOtp(String email) {
        if (!pendingRegistrations.containsKey(email)) {
            if (userRepository.existsByEmail(email)) {
                return ApiResponse.error(ErrorCode.INVALID_ORDER_PARAMETERS, "Tài khoản này đã tồn tại và được hệ thống ghi nhận.");
            }
            return ApiResponse.error(ErrorCode.EXPIRED_SESSION, "Phiên đăng ký đã hết hạn hoặc email không hợp lệ.");
        }

        otpService.sendOtp(email);
        return ApiResponse.success("Đã gửi lại mã OTP đến email của bạn.");
    }

    public ApiResponse<String> verifyRegistrationOtp(OtpVerifyRequest request) {
        String email = request.getEmail();

        RegisterRequest pendingRequest = pendingRegistrations.get(email);
        if (pendingRequest == null) {
            if (userRepository.existsByEmail(email)) {
                return ApiResponse.error(ErrorCode.INVALID_ORDER_PARAMETERS, "Tài khoản này đã được tạo trước đó.");
            }
            return ApiResponse.error(ErrorCode.EXPIRED_SESSION, "Không tìm thấy thông tin đăng ký hoặc phiên đã hết hạn. Vui lòng đăng ký lại.");
        }

        boolean isValid = otpService.verifyOtp(email, request.getOtpCode());
        if (!isValid) {
            return ApiResponse.error(ErrorCode.INVALID_OTP, "Mã OTP không chính xác hoặc đã hết hạn.");
        }

        User user = User.builder()
                .username(pendingRequest.getUsername())
                .email(pendingRequest.getEmail())
                .password(passwordEncoder.encode(pendingRequest.getPassword()))
                .fullName(pendingRequest.getFullName())
                .phone(pendingRequest.getPhone())
                .role(Role.USER)
                .isActive(true)
                .build();

        userRepository.save(user);
        pendingRegistrations.remove(email);

        return ApiResponse.success("Xác thực email thành công! Tài khoản đã được tạo và kích hoạt.");
    }

    public ApiResponse<LoginResponse> login(LoginRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getUsername(),
                            request.getPassword()
                    )
            );

            User user = userRepository.findByUsername(request.getUsername())
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            String tempToken = UUID.randomUUID().toString();
            String key = "TEMP_2FA:" + tempToken;

            try {
                otpService.getRedisTemplate().opsForValue().set(key, user.getUsername(), 5, TimeUnit.MINUTES);
            } catch (Exception e) {
                local2faStore.put(key, user.getUsername());
            }

            String qrCodeBase64;
            if (user.getTwoFaSecret() == null || user.getTwoFaSecret().isEmpty()) {
                String secret = totpService.generateSecret();
                user.setTwoFaSecret(secret);
                userRepository.save(user);
                qrCodeBase64 = totpService.generateQrCodeBase64(user.getUsername(), secret);
            } else {
                qrCodeBase64 = totpService.generateQrCodeBase64(user.getUsername(), user.getTwoFaSecret());
            }

            return ApiResponse.success("Vui lòng quét mã QR bằng Google Authenticator và nhập mã OTP.",
                    LoginResponse.builder()
                            .is2faRequired(true)
                            .tempToken(tempToken)
                            .qrCodeBase64(qrCodeBase64)
                            .build());

        } catch (DisabledException e) {
            return ApiResponse.error(ErrorCode.ACCOUNT_LOCKED, "Tài khoản của bạn chưa được kích hoạt hoặc đã bị khóa!");
        } catch (Exception e) {
            return ApiResponse.error(ErrorCode.INVALID_CREDENTIALS, "Sai username hoặc mật khẩu!");
        }
    }

    public String getDebugToken(String username) {
        UserDetails userDetails = userDetailsService.loadUserByUsername(username);
        return jwtUtils.generateToken(userDetails);
    }

    public Map<String, String> getLocal2faStore() {
        return local2faStore;
    }
}
