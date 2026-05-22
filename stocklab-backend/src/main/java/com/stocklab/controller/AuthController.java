package com.stocklab.controller;

import com.stocklab.dto.*;
import com.stocklab.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<String>> register(@Valid @RequestBody RegisterRequest request) {
        ApiResponse<String> response = userService.register(request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/verify-registration")
    public ResponseEntity<ApiResponse<String>> verifyRegistration(@Valid @RequestBody OtpVerifyRequest request) {
        ApiResponse<String> response = userService.verifyRegistrationOtp(request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/resend-otp")
    public ResponseEntity<ApiResponse<String>> resendOtp(@RequestParam String email) {
        ApiResponse<String> response = userService.resendRegistrationOtp(email);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        ApiResponse<LoginResponse> response = userService.login(request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/login/verify-2fa")
    public ResponseEntity<ApiResponse<LoginResponse>> verify2fa(@Valid @RequestBody Verify2faRequest request) {
        ApiResponse<LoginResponse> response = userService.verify2fa(request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/forgot-password/request")
    public ResponseEntity<ApiResponse<String>> forgotPasswordRequest(@Valid @RequestBody ForgotPasswordRequest request) {
        ApiResponse<String> response = userService.requestForgotPassword(request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/forgot-password/reset")
    public ResponseEntity<ApiResponse<String>> forgotPasswordReset(@Valid @RequestBody ForgotPasswordResetRequest request) {
        ApiResponse<String> response = userService.resetPasswordWithOtp(request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    @GetMapping("/make-admin")
    public ResponseEntity<ApiResponse<String>> makeAdmin(@RequestParam String username) {
        return ResponseEntity.ok(userService.makeMeAdmin(username));
    }

    @GetMapping("/debug/token")
    public ResponseEntity<String> getDebugToken(@RequestParam String username) {
        return ResponseEntity.ok(userService.getDebugToken(username));
    }
}
