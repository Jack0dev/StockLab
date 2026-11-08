package com.stocklab.service;

import com.stocklab.presentation.dto.*;
import com.stocklab.service.user.UserAuthService;
import com.stocklab.service.user.UserProfileService;
import com.stocklab.service.user.UserSecurityService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service Facade — Quản lý toàn bộ nghiệp vụ người dùng (User Management).
 * Áp dụng Facade Pattern điều phối các dịch vụ chuyên biệt:
 * - UserAuthService: Đăng ký, đăng nhập, JWT
 * - UserSecurityService: 2FA TOTP, OTP, Đổi/Quên mật khẩu
 * - UserProfileService: Thông tin cá nhân, avatar, quản trị User Admin
 */
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserAuthService userAuthService;
    private final UserSecurityService userSecurityService;
    private final UserProfileService userProfileService;

    // ===== 1. Authentication & Registration =====

    public ApiResponse<String> register(RegisterRequest request) {
        return userAuthService.register(request);
    }

    public ApiResponse<String> resendRegistrationOtp(String email) {
        return userAuthService.resendRegistrationOtp(email);
    }

    public ApiResponse<String> verifyRegistrationOtp(OtpVerifyRequest request) {
        return userAuthService.verifyRegistrationOtp(request);
    }

    public ApiResponse<LoginResponse> login(LoginRequest request) {
        return userAuthService.login(request);
    }

    public String getDebugToken(String username) {
        return userAuthService.getDebugToken(username);
    }

    // ===== 2. Security, 2FA & Password Recovery =====

    public ApiResponse<LoginResponse> verify2fa(Verify2faRequest request) {
        return userSecurityService.verify2fa(request, userAuthService.getLocal2faStore());
    }

    public ApiResponse<String> requestForgotPassword(ForgotPasswordRequest request) {
        return userSecurityService.requestForgotPassword(request);
    }

    public ApiResponse<String> resetPasswordWithOtp(ForgotPasswordResetRequest request) {
        return userSecurityService.resetPasswordWithOtp(request);
    }

    public ApiResponse<String> requestChangePassword(String username, ChangePasswordRequest request) {
        return userSecurityService.requestChangePassword(username, request);
    }

    public ApiResponse<String> verifyChangePasswordOtp(String username, ChangePasswordVerifyRequest request) {
        return userSecurityService.verifyChangePasswordOtp(username, request);
    }

    // ===== 3. User Profile & Admin Operations =====

    public ApiResponse<UserProfileResponse> getProfile(String username) {
        return userProfileService.getProfile(username);
    }

    public ApiResponse<String> updateProfile(String username, UpdateProfileRequest request) {
        return userProfileService.updateProfile(username, request);
    }

    public ApiResponse<String> uploadAvatar(String username, String avatarBase64) {
        return userProfileService.uploadAvatar(username, avatarBase64);
    }

    public ApiResponse<List<UserProfileResponse>> getAllUsers() {
        return userProfileService.getAllUsers();
    }

    public ApiResponse<String> toggleUserLock(Long userId) {
        return userProfileService.toggleUserLock(userId);
    }

    public ApiResponse<String> changeUserRole(Long userId, String newRole) {
        return userProfileService.changeUserRole(userId, newRole);
    }

    public ApiResponse<String> makeMeAdmin(String username) {
        return userProfileService.makeMeAdmin(username);
    }
}
