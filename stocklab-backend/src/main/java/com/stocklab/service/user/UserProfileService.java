package com.stocklab.service.user;

import com.stocklab.domain.exception.BusinessRuleException;
import com.stocklab.domain.exception.ErrorCode;
import com.stocklab.domain.exception.ResourceNotFoundException;
import com.stocklab.domain.model.Role;
import com.stocklab.domain.model.User;
import com.stocklab.infrastructure.repository.UserRepository;
import com.stocklab.presentation.dto.ApiResponse;
import com.stocklab.presentation.dto.UpdateProfileRequest;
import com.stocklab.presentation.dto.UserProfileResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service chuyên trách Hồ sơ người dùng và Quản trị danh sách người dùng (Profile & User Admin).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserProfileService {

    private final UserRepository userRepository;

    public ApiResponse<UserProfileResponse> getProfile(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User không tồn tại: " + username));

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
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User không tồn tại: " + username));

        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }
        if (request.getPhone() != null) {
            user.setPhone(request.getPhone());
        }
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                return ApiResponse.error(ErrorCode.INVALID_ORDER_PARAMETERS, "Email đã được sử dụng!");
            }
            user.setEmail(request.getEmail());
        }

        userRepository.save(user);
        return ApiResponse.success("Cập nhật thông tin thành công!");
    }

    public ApiResponse<String> uploadAvatar(String username, String avatarBase64) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User không tồn tại: " + username));

        if (avatarBase64 == null || avatarBase64.isBlank()) {
            return ApiResponse.error(ErrorCode.INVALID_ORDER_PARAMETERS, "Dữ liệu ảnh không hợp lệ!");
        }

        // Giới hạn kích thước ~2MB (base64 tăng ~33% so với file gốc)
        if (avatarBase64.length() > 2_800_000) {
            return ApiResponse.error(ErrorCode.INVALID_ORDER_PARAMETERS, "Ảnh quá lớn! Vui lòng chọn ảnh dưới 2MB.");
        }

        user.setAvatarUrl(avatarBase64);
        userRepository.save(user);
        return ApiResponse.success("Cập nhật ảnh đại diện thành công!");
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
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User không tồn tại"));

        if (user.getRole() == Role.ADMIN) {
            return ApiResponse.error(ErrorCode.FORBIDDEN, "Không thể khoá tài khoản Admin!");
        }

        user.setActive(!user.isActive());
        userRepository.save(user);
        String status = user.isActive() ? "mở khoá" : "khoá";
        return ApiResponse.success("Đã " + status + " tài khoản " + user.getUsername() + " thành công!");
    }

    public ApiResponse<String> changeUserRole(Long userId, String newRole) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User không tồn tại"));

        try {
            Role roleEnum = Role.valueOf(newRole.toUpperCase());
            user.setRole(roleEnum);
            userRepository.save(user);
            return ApiResponse.success("Đã cấp quyền " + roleEnum.name() + " cho tài khoản " + user.getUsername() + " thành công!");
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(ErrorCode.INVALID_ORDER_PARAMETERS, "Quyền không hợp lệ: " + newRole);
        }
    }

    public ApiResponse<String> makeMeAdmin(String username) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ApiResponse.error(ErrorCode.USER_NOT_FOUND, "Không tìm thấy user: " + username);
        }
        user.setRole(Role.ADMIN);
        userRepository.save(user);
        return ApiResponse.success("Đã cấp quyền ADMIN thành công cho tài khoản: " + username);
    }
}
