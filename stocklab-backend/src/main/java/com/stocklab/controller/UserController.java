package com.stocklab.controller;

import com.stocklab.dto.*;
import com.stocklab.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getProfile(Authentication authentication) {
        ApiResponse<UserProfileResponse> response = userService.getProfile(authentication.getName());
        return ResponseEntity.ok(response);
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<String>> updateProfile(
            Authentication authentication,
            @RequestBody UpdateProfileRequest request
    ) {
        ApiResponse<String> response = userService.updateProfile(authentication.getName(), request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/change-password/request")
    public ResponseEntity<ApiResponse<String>> requestChangePassword(
            Authentication authentication,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        ApiResponse<String> response = userService.requestChangePassword(authentication.getName(), request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/change-password/verify")
    public ResponseEntity<ApiResponse<String>> verifyChangePassword(
            Authentication authentication,
            @Valid @RequestBody ChangePasswordVerifyRequest request
    ) {
        ApiResponse<String> response = userService.verifyChangePasswordOtp(authentication.getName(), request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/avatar")
    public ResponseEntity<ApiResponse<String>> uploadAvatar(
            Authentication authentication,
            @RequestBody java.util.Map<String, String> body
    ) {
        String avatarBase64 = body.get("avatarBase64");
        ApiResponse<String> response = userService.uploadAvatar(authentication.getName(), avatarBase64);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }
}
