package com.stocklab.service;

import com.stocklab.dto.*;
import com.stocklab.model.Role;
import com.stocklab.model.User;
import org.springframework.security.authentication.DisabledException;
import com.stocklab.repository.UserRepository;
import com.stocklab.security.JwtUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtils jwtUtils;
    private final OtpService otpService;
    private final TotpService totpService;
    private final UserDetailsService userDetailsService;

    // Cache tạm thời thông tin đăng ký (email -> RegisterRequest)
    private final Map<String, RegisterRequest> pendingRegistrations = new ConcurrentHashMap<>();
    private static final String PENDING_PASSWORD_PREFIX = "PENDING_PASSWORD:";

    // Fallback 2FA stores (khi Redis không khả dụng)
    private final Map<String, String> local2faStore = new ConcurrentHashMap<>();


    public ApiResponse<String> register(RegisterRequest request) {
        // Kiểm tra username đã tồn tại
        if (userRepository.existsByUsername(request.getUsername())) {
            return ApiResponse.error("Username đã được sử dụng!");
        }

        // Kiểm tra email đã tồn tại
        if (userRepository.existsByEmail(request.getEmail())) {
            return ApiResponse.error("Email đã được sử dụng!");
        }

        // Lưu thông tin đăng ký vào bộ nhớ tạm
        pendingRegistrations.put(request.getEmail(), request);

        // Gửi OTP qua email
        try {
            otpService.sendOtp(request.getEmail());
            return ApiResponse.success("Vui lòng kiểm tra email để lấy mã OTP xác thực.");
        } catch (Exception e) {
            return ApiResponse.success("Đã gửi thông tin đăng ký, tuy nhiên gửi OTP bị lỗi. Vui lòng nhấn gửi thử lại.");
        }
    }

    public ApiResponse<String> resendRegistrationOtp(String email) {
        if (!pendingRegistrations.containsKey(email)) {
            // Kiểm tra xem user có thực sự đang đăng ký dở hay không
            if (userRepository.existsByEmail(email)) {
                return ApiResponse.error("Tài khoản này đã tồn tại và được hệ thống ghi nhận.");
            }
            return ApiResponse.error("Phiên đăng ký đã hết hạn hoặc email không hợp lệ.");
        }
        
        otpService.sendOtp(email);
        return ApiResponse.success("Đã gửi lại mã OTP đến email của bạn.");
    }

    public ApiResponse<String> verifyRegistrationOtp(OtpVerifyRequest request) {
        String email = request.getEmail();
        
        RegisterRequest pendingRequest = pendingRegistrations.get(email);
        if (pendingRequest == null) {
            // Nếu không có trong cache, có thể do server restart hoặc user tự đổi email
            if (userRepository.existsByEmail(email)) {
                return ApiResponse.error("Tài khoản này đã được tạo trước đó.");
            }
            return ApiResponse.error("Không tìm thấy thông tin đăng ký hoặc phiên đã hết hạn. Vui lòng đăng ký lại.");
        }

        boolean isValid = otpService.verifyOtp(email, request.getOtpCode());
        if (!isValid) {
            return ApiResponse.error("Mã OTP không chính xác hoặc đã hết hạn.");
        }

        // Khi OTP hợp lệ, tiến hành tạo User và lưu vào Database
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
        
        // Xóa thông tin tạm sau khi lưu thành công
        pendingRegistrations.remove(email);

        return ApiResponse.success("Xác thực email thành công! Tài khoản đã được tạo và kích hoạt.");
    }

    public ApiResponse<String> verifyChangePasswordOtp(String username, ChangePasswordVerifyRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        String email = user.getEmail();
        String key = PENDING_PASSWORD_PREFIX + email;

        // 1. Kiểm tra xem có yêu cầu đổi mật khẩu đang chờ không
        String newPassword;
        try {
            newPassword = (String) otpService.getRedisTemplate().opsForValue().get(key);
        } catch (Exception e) {
            return ApiResponse.error("Hệ thống bận, vui lòng thử lại sau.");
        }

        if (newPassword == null) {
            return ApiResponse.error("Yêu cầu đổi mật khẩu đã hết hạn hoặc không tồn tại.");
        }

        // 2. Xác thực OTP
        boolean isValid = otpService.verifyOtp(email, request.getOtpCode());
        if (!isValid) {
            return ApiResponse.error("Mã OTP không chính xác hoặc đã hết hạn.");
        }

        // 3. Cập nhật mật khẩu chính thức
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // 4. Dọn dẹp cache
        try {
            otpService.getRedisTemplate().delete(key);
        } catch (Exception ignored) {}

        return ApiResponse.success("Đổi mật khẩu thành công!");
    }

    public ApiResponse<LoginResponse> verify2fa(Verify2faRequest request) {
        String key = "TEMP_2FA:" + request.getTempToken();
        
        // Lấy username từ Redis hoặc fallback RAM
        String username = null;
        try {
            username = (String) otpService.getRedisTemplate().opsForValue().get(key);
        } catch (Exception e) {
            username = local2faStore.get(key);
        }
        if (username == null) {
            username = local2faStore.get(key);
        }
        if (username == null) {
            return ApiResponse.error("Yêu cầu xác thực đã hết hạn hoặc không tồn tại.");
        }

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        // Xác thực mã TOTP từ Google Authenticator
        try {
            int totpCode = Integer.parseInt(request.getOtpCode());
            if (!totpService.verifyCode(user.getTwoFaSecret(), totpCode)) {
                return ApiResponse.error("Mã xác thực không chính xác. Vui lòng thử lại.");
            }
        } catch (NumberFormatException e) {
            return ApiResponse.error("Mã xác thực phải là số.");
        }

        // Dọn dẹp cache
        try {
            otpService.getRedisTemplate().delete(key);
        } catch (Exception ignored) {}
        local2faStore.remove(key);

        // Phát hành token chính thức
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
        User user = userRepository.findByUsername(username)
                .orElse(null);
        
        if (user == null) {
            return ApiResponse.error("Tên đăng nhập không tồn tại trong hệ thống!");
        }

        String email = user.getEmail();
        try {
            otpService.sendOtp(email);
            return ApiResponse.success("Đã gửi mã OTP khôi phục mật khẩu đến email đăng ký: " + maskEmail(email));
        } catch (Exception e) {
            return ApiResponse.error("Lỗi khi gửi mã OTP. Vui lòng thử lại sau.");
        }
    }

    private String maskEmail(String email) {
        int atIndex = email.indexOf("@");
        if (atIndex <= 1) return email;
        return email.substring(0, 2) + "****" + email.substring(atIndex);
    }

    public ApiResponse<String> resetPasswordWithOtp(ForgotPasswordResetRequest request) {
        String username = request.getUsername();
        
        // 1. Tìm User để lấy email xác thực OTP
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Tài khoản không tồn tại."));
        
        String email = user.getEmail();

        // 2. Xác thực OTP
        boolean isValid = otpService.verifyOtp(email, request.getOtpCode());
        if (!isValid) {
            return ApiResponse.error("Mã OTP không chính xác hoặc đã hết hạn.");
        }

        // 3. Cập nhật mật khẩu mới
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        return ApiResponse.success("Mật khẩu đã được đặt lại thành công! Bạn có thể đăng nhập bằng mật khẩu mới.");
    }

    public ApiResponse<LoginResponse> login(LoginRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getUsername(),
                            request.getPassword()
                    )
            );

            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            User user = userRepository.findByUsername(request.getUsername())
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            // 2. Xác thực 2 bước bằng Google Authenticator (TOTP)
            {
                String tempToken = java.util.UUID.randomUUID().toString();
                String key = "TEMP_2FA:" + tempToken;

                // Lưu username tạm vào Redis/RAM
                try {
                    otpService.getRedisTemplate().opsForValue().set(key, user.getUsername(), 5, TimeUnit.MINUTES);
                } catch (Exception e) {
                    local2faStore.put(key, user.getUsername());
                }

                // Nếu user chưa có secret → tạo mới + trả QR code
                String qrCodeBase64 = null;
                if (user.getTwoFaSecret() == null || user.getTwoFaSecret().isEmpty()) {
                    String secret = totpService.generateSecret();
                    user.setTwoFaSecret(secret);
                    userRepository.save(user);
                    qrCodeBase64 = totpService.generateQrCodeBase64(user.getUsername(), secret);
                } else {
                    // User đã thiết lập → vẫn trả QR để tiện scan lại nếu cần
                    qrCodeBase64 = totpService.generateQrCodeBase64(user.getUsername(), user.getTwoFaSecret());
                }

                return ApiResponse.success("Vui lòng quét mã QR bằng Google Authenticator và nhập mã OTP.",
                    LoginResponse.builder()
                        .is2faRequired(true)
                        .tempToken(tempToken)
                        .qrCodeBase64(qrCodeBase64)
                        .build());
            }

        } catch (DisabledException e) {
            return ApiResponse.error("Tài khoản của bạn chưa được kích hoạt hoặc đã bị khóa!");
        } catch (Exception e) {
            return ApiResponse.error("Sai username hoặc mật khẩu!");
        }
    }

    public ApiResponse<UserProfileResponse> getProfile(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        UserProfileResponse profile = UserProfileResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .role(user.getRole().name())
                .balance(user.getBalance())
                .lockedBalance(user.getLockedBalance())
                .availableBalance(user.getAvailableBalance())
                .isActive(user.isActive())
                .avatarUrl(user.getAvatarUrl())
                .createdAt(user.getCreatedAt())
                .build();

        return ApiResponse.success("Lấy thông tin thành công", profile);
    }

    public ApiResponse<String> updateProfile(String username, UpdateProfileRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }
        if (request.getPhone() != null) {
            user.setPhone(request.getPhone());
        }
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                return ApiResponse.error("Email đã được sử dụng!");
            }
            user.setEmail(request.getEmail());
        }

        userRepository.save(user);
        return ApiResponse.success("Cập nhật thông tin thành công!");
    }

    public ApiResponse<String> uploadAvatar(String username, String avatarBase64) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        if (avatarBase64 == null || avatarBase64.isBlank()) {
            return ApiResponse.error("Dữ liệu ảnh không hợp lệ!");
        }

        // Giới hạn kích thước ~2MB (base64 tăng ~33% so với file gốc)
        if (avatarBase64.length() > 2_800_000) {
            return ApiResponse.error("Ảnh quá lớn! Vui lòng chọn ảnh dưới 2MB.");
        }

        user.setAvatarUrl(avatarBase64);
        userRepository.save(user);
        return ApiResponse.success("Cập nhật ảnh đại diện thành công!");
    }

    // Cache tạm thời thông tin đổi mật khẩu (email -> newPassword) trong Redis
    public ApiResponse<String> requestChangePassword(String username, ChangePasswordRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        // 1. Kiểm tra mật khẩu cũ
        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            return ApiResponse.error("Mật khẩu cũ không chính xác!");
        }

        // 2. Mật khẩu mới không được trùng mật khẩu cũ
        if (request.getOldPassword().equals(request.getNewPassword())) {
            return ApiResponse.error("Mật khẩu mới không được giống mật khẩu cũ!");
        }

        // 3. Lưu mật khẩu mới vào Redis chờ xác thực (TTL 10 phút)
        String key = PENDING_PASSWORD_PREFIX + user.getEmail();
        try {
            otpService.getRedisTemplate().opsForValue().set(key, request.getNewPassword(), 10, TimeUnit.MINUTES);
        } catch (Exception e) {
            // Nếu Redis lỗi, ném lỗi để người dùng biết
            return ApiResponse.error("Hệ thống bận, vui lòng thử lại sau.");
        }

        // 4. Gửi OTP qua email
        try {
            otpService.sendOtp(user.getEmail());
            return ApiResponse.success("Mã OTP đã được gửi đến email của bạn để xác thực việc đổi mật khẩu.");
        } catch (Exception e) {
            return ApiResponse.error("Lỗi khi gửi OTP. Vui lòng thử lại.");
        }
    }

    public ApiResponse<List<UserProfileResponse>> getAllUsers() {
        List<UserProfileResponse> users = userRepository.findAll().stream()
                .map(user -> UserProfileResponse.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .email(user.getEmail())
                        .fullName(user.getFullName())
                        .phone(user.getPhone())
                        .role(user.getRole().name())
                        .balance(user.getBalance())
                        .lockedBalance(user.getLockedBalance())
                        .availableBalance(user.getAvailableBalance())
                        .isActive(user.isActive())
                        .avatarUrl(user.getAvatarUrl())
                        .createdAt(user.getCreatedAt())
                        .build())
                .toList();
        return ApiResponse.success("Lấy danh sách user thành công", users);
    }

    public ApiResponse<String> toggleUserLock(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));
        
        if (user.getRole() == Role.ADMIN) {
            return ApiResponse.error("Không thể khoá tài khoản Admin!");
        }

        user.setActive(!user.isActive());
        userRepository.save(user);
        String status = user.isActive() ? "mở khoá" : "khoá";
        return ApiResponse.success("Đã " + status + " tài khoản " + user.getUsername() + " thành công!");
    }

    public ApiResponse<String> changeUserRole(Long userId, String newRole) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        try {
            Role roleEnum = Role.valueOf(newRole.toUpperCase());
            user.setRole(roleEnum);
            userRepository.save(user);
            return ApiResponse.success("Đã cấp quyền " + roleEnum.name() + " cho tài khoản " + user.getUsername() + " thành công!");
        } catch (IllegalArgumentException e) {
            return ApiResponse.error("Quyền không hợp lệ!");
        }
    }

    public ApiResponse<String> makeMeAdmin(String username) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ApiResponse.error("Không tìm thấy user: " + username);
        }
        user.setRole(Role.ADMIN);
        userRepository.save(user);
        return ApiResponse.success("Đã cấp quyền ADMIN thành công cho tài khoản: " + username);
    }

    public String getDebugToken(String username) {
        UserDetails userDetails = userDetailsService.loadUserByUsername(username);
        return jwtUtils.generateToken(userDetails);
    }
}
