package com.stocklab.service.user;

import com.stocklab.domain.exception.ErrorCode;
import com.stocklab.domain.exception.ResourceNotFoundException;
import com.stocklab.domain.model.User;
import com.stocklab.infrastructure.repository.UserRepository;
import com.stocklab.infrastructure.security.JwtUtils;
import com.stocklab.presentation.dto.*;
import com.stocklab.service.OtpService;
import com.stocklab.service.TotpService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Service chuyên trách Bảo mật người dùng (2FA Google Authenticator, OTP qua Email, Đổi/Quên mật khẩu).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserSecurityService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final OtpService otpService;
    private final TotpService totpService;
    private final JwtUtils jwtUtils;
    private final UserDetailsService userDetailsService;

    private static final String PENDING_PASSWORD_PREFIX = "PENDING_PASSWORD:";

    public ApiResponse<LoginResponse> verify2fa(Verify2faRequest request, Map<String, String> local2faStore) {
        String key = "TEMP_2FA:" + request.getTempToken();

        String username = null;
        try {
            username = (String) otpService.getRedisTemplate().opsForValue().get(key);
        } catch (Exception e) {
            if (local2faStore != null) {
                username = local2faStore.get(key);
            }
        }

        if (username == null && local2faStore != null) {
            username = local2faStore.get(key);
        }

        if (username == null) {
            return ApiResponse.error(ErrorCode.EXPIRED_SESSION, "Yêu cầu xác thực đã hết hạn hoặc không tồn tại.");
        }

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User không tồn tại"));

        try {
            int totpCode = Integer.parseInt(request.getOtpCode());
            if (!totpService.verifyCode(user.getTwoFaSecret(), totpCode)) {
                return ApiResponse.error(ErrorCode.INVALID_OTP, "Mã xác thực không chính xác. Vui lòng thử lại.");
            }
        } catch (NumberFormatException e) {
            return ApiResponse.error(ErrorCode.INVALID_ORDER_PARAMETERS, "Mã xác thực phải là số.");
        }

        try {
            otpService.getRedisTemplate().delete(key);
        } catch (Exception ignored) {}
        if (local2faStore != null) {
            local2faStore.remove(key);
        }

        String token = jwtUtils.generateToken(userDetailsService.loadUserByUsername(username));
        return ApiResponse.success("Xác thực 2 bước thành công!",
                LoginResponse.builder()
                        .token(token)
                        .username(user.getUsername())
                        .email(user.getEmail())
                        .fullName(user.getFullName())
                        .role(user.getRole().toString())
                        .build());
    }

    public ApiResponse<String> requestForgotPassword(ForgotPasswordRequest request) {
        String username = request.getUsername();
        User user = userRepository.findByUsername(username).orElse(null);

        if (user == null) {
            return ApiResponse.error(ErrorCode.USER_NOT_FOUND, "Tên đăng nhập không tồn tại trong hệ thống!");
        }

        String email = user.getEmail();
        try {
            otpService.sendOtp(email);
            return ApiResponse.success("Đã gửi mã OTP khôi phục mật khẩu đến email đăng ký: " + maskEmail(email));
        } catch (Exception e) {
            log.error("Lỗi khi gửi mã OTP quên mật khẩu: {}", e.getMessage());
            return ApiResponse.error(ErrorCode.INTERNAL_SERVER_ERROR, "Lỗi khi gửi mã OTP. Vui lòng thử lại sau.");
        }
    }

    public ApiResponse<String> resetPasswordWithOtp(ForgotPasswordResetRequest request) {
        String username = request.getUsername();

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "Tài khoản không tồn tại."));

        String email = user.getEmail();

        boolean isValid = otpService.verifyOtp(email, request.getOtpCode());
        if (!isValid) {
            return ApiResponse.error(ErrorCode.INVALID_OTP, "Mã OTP không chính xác hoặc đã hết hạn.");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        return ApiResponse.success("Mật khẩu đã được đặt lại thành công! Bạn có thể đăng nhập bằng mật khẩu mới.");
    }

    public ApiResponse<String> requestChangePassword(String username, ChangePasswordRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User không tồn tại"));

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            return ApiResponse.error(ErrorCode.INVALID_CREDENTIALS, "Mật khẩu cũ không chính xác!");
        }

        if (request.getOldPassword().equals(request.getNewPassword())) {
            return ApiResponse.error(ErrorCode.INVALID_ORDER_PARAMETERS, "Mật khẩu mới không được giống mật khẩu cũ!");
        }

        String key = PENDING_PASSWORD_PREFIX + user.getEmail();
        try {
            otpService.getRedisTemplate().opsForValue().set(key, request.getNewPassword(), 10, TimeUnit.MINUTES);
        } catch (Exception e) {
            log.error("Lỗi lưu Redis khi đổi mật khẩu: {}", e.getMessage());
            return ApiResponse.error(ErrorCode.INTERNAL_SERVER_ERROR, "Hệ thống bận, vui lòng thử lại sau.");
        }

        try {
            otpService.sendOtp(user.getEmail());
            return ApiResponse.success("Mã OTP đã được gửi đến email của bạn để xác thực việc đổi mật khẩu.");
        } catch (Exception e) {
            log.error("Lỗi khi gửi OTP đổi mật khẩu: {}", e.getMessage());
            return ApiResponse.error(ErrorCode.INTERNAL_SERVER_ERROR, "Lỗi khi gửi OTP. Vui lòng thử lại.");
        }
    }

    public ApiResponse<String> verifyChangePasswordOtp(String username, ChangePasswordVerifyRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User không tồn tại"));

        String email = user.getEmail();
        String key = PENDING_PASSWORD_PREFIX + email;

        String newPassword;
        try {
            newPassword = (String) otpService.getRedisTemplate().opsForValue().get(key);
        } catch (Exception e) {
            return ApiResponse.error(ErrorCode.INTERNAL_SERVER_ERROR, "Hệ thống bận, vui lòng thử lại sau.");
        }

        if (newPassword == null) {
            return ApiResponse.error(ErrorCode.EXPIRED_SESSION, "Yêu cầu đổi mật khẩu đã hết hạn hoặc không tồn tại.");
        }

        boolean isValid = otpService.verifyOtp(email, request.getOtpCode());
        if (!isValid) {
            return ApiResponse.error(ErrorCode.INVALID_OTP, "Mã OTP không chính xác hoặc đã hết hạn.");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        try {
            otpService.getRedisTemplate().delete(key);
        } catch (Exception ignored) {}

        return ApiResponse.success("Đổi mật khẩu thành công!");
    }

    private String maskEmail(String email) {
        int atIndex = email.indexOf("@");
        if (atIndex <= 1) return email;
        return email.substring(0, 2) + "****" + email.substring(atIndex);
    }
}
