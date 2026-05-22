package com.stocklab.controller;

import com.stocklab.dto.ApiResponse;
import com.stocklab.dto.PlatformTokenResponse;
import com.stocklab.service.PlatformTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * API endpoint cho Token sàn SLP (StockLab Platform Token)
 */
@RestController
@RequestMapping("/api/platform-token")
@RequiredArgsConstructor
public class PlatformTokenController {

    private final PlatformTokenService platformTokenService;

    /**
     * GET /api/platform-token
     * Lấy thông tin token SLP: giá, thống kê sàn
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PlatformTokenResponse>> getTokenInfo() {
        PlatformTokenResponse response = platformTokenService.getTokenInfo();
        return ResponseEntity.ok(ApiResponse.success("Lấy thông tin token SLP thành công", response));
    }
}
