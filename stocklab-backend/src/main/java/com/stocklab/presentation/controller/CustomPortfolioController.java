package com.stocklab.presentation.controller;

import com.stocklab.presentation.dto.*;
import com.stocklab.service.CustomPortfolioService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/custom-portfolios")
@RequiredArgsConstructor
public class CustomPortfolioController {

    private final CustomPortfolioService customPortfolioService;

    /**
     * GET /api/custom-portfolios
     * Lấy danh sách danh mục tùy chỉnh của user
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<CustomPortfolioDTO>>> getMyCustomPortfolios(
            @AuthenticationPrincipal UserDetails userDetails) {
        ApiResponse<List<CustomPortfolioDTO>> response =
                customPortfolioService.getCustomPortfolios(userDetails.getUsername());
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/custom-portfolios
     * Tạo danh mục tùy chỉnh mới
     */
    @PostMapping
    public ResponseEntity<ApiResponse<CustomPortfolioDTO>> createCustomPortfolio(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CreateCustomPortfolioRequest request) {
        ApiResponse<CustomPortfolioDTO> response =
                customPortfolioService.createCustomPortfolio(userDetails.getUsername(), request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * PUT /api/custom-portfolios/{id}
     * Cập nhật thông tin danh mục (tên, mô tả)
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<CustomPortfolioDTO>> updateCustomPortfolio(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @Valid @RequestBody UpdateCustomPortfolioRequest request) {
        ApiResponse<CustomPortfolioDTO> response =
                customPortfolioService.updateCustomPortfolio(userDetails.getUsername(), id, request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * DELETE /api/custom-portfolios/{id}
     * Xóa danh mục tùy chỉnh
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteCustomPortfolio(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {
        ApiResponse<Void> response =
                customPortfolioService.deleteCustomPortfolio(userDetails.getUsername(), id);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * PUT /api/custom-portfolios/{id}/stocks
     * Cập nhật danh sách mã cổ phiếu trong danh mục
     */
    @PutMapping("/{id}/stocks")
    public ResponseEntity<ApiResponse<CustomPortfolioDTO>> updatePortfolioStocks(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @Valid @RequestBody UpdatePortfolioStocksRequest request) {
        ApiResponse<CustomPortfolioDTO> response =
                customPortfolioService.updatePortfolioStocks(userDetails.getUsername(), id, request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * GET /api/custom-portfolios/{id}/summary
     * Lấy dữ liệu thống kê, tỷ trọng và cổ phiếu thuộc danh mục này
     */
    @GetMapping("/{id}/summary")
    public ResponseEntity<ApiResponse<CustomPortfolioSummaryResponse>> getCustomPortfolioSummary(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {
        ApiResponse<CustomPortfolioSummaryResponse> response =
                customPortfolioService.getCustomPortfolioSummary(userDetails.getUsername(), id);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }
}
