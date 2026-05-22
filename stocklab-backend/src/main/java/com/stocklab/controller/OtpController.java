package com.stocklab.controller;

import com.stocklab.dto.ApiResponse;
import com.stocklab.model.User;
import com.stocklab.repository.UserRepository;
import com.stocklab.service.OtpService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/otp")
@RequiredArgsConstructor
public class OtpController {

    private final OtpService otpService;
    private final UserRepository userRepository;

    /**
     * Gửi mã OTP qua email cho user hiện tại (dùng cho xác thực bán cổ phiếu)
     */
    @PostMapping("/send")
    public ResponseEntity<ApiResponse<String>> sendOtp(
            @AuthenticationPrincipal UserDetails userDetails) {
        // Tìm user để lấy email thực
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        ApiResponse<String> response = otpService.sendOtp(user.getEmail());
        return ResponseEntity.ok(response);
    }
}
