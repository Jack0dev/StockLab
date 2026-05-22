package com.stocklab.controller;

import com.stocklab.dto.*;
import com.stocklab.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    /**
     * POST /api/orders
     * Đặt lệnh mua/bán
     */
    @PostMapping
    public ResponseEntity<ApiResponse<OrderResponse>> placeOrder(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody OrderRequest request) {

        ApiResponse<OrderResponse> response = orderService.placeOrder(
                userDetails.getUsername(), request);

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * GET /api/orders?page=0&size=20&status=PENDING
     * Danh sách lệnh của user
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<OrderResponse>>> getMyOrders(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status) {

        Pageable pageable = PageRequest.of(page, size);
        ApiResponse<Page<OrderResponse>> response = orderService.getMyOrders(
                userDetails.getUsername(), pageable, status);

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * GET /api/orders/{id}
     * Chi tiết 1 lệnh
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrderResponse>> getOrderDetail(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {

        ApiResponse<OrderResponse> response = orderService.getOrderDetail(
                userDetails.getUsername(), id);

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * GET /api/orders/book/{ticker}
     * Order Book — public, không cần đăng nhập
     */
    @GetMapping("/book/{ticker}")
    public ResponseEntity<ApiResponse<OrderBookResponse>> getOrderBook(
            @PathVariable String ticker) {

        ApiResponse<OrderBookResponse> response = orderService.getOrderBook(ticker);

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * PUT /api/orders/{id}/cancel
     * Hủy lệnh PENDING hoặc PARTIAL
     */
    @PutMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<OrderResponse>> cancelOrder(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {

        ApiResponse<OrderResponse> response = orderService.cancelOrder(
                userDetails.getUsername(), id);

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * PUT /api/orders/{id}/modify
     * Sửa lệnh — hủy cũ + đặt mới với giá/KL mới
     */
    @PutMapping("/{id}/modify")
    public ResponseEntity<ApiResponse<OrderResponse>> modifyOrder(
            @PathVariable Long id,
            @RequestBody ModifyOrderRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        ApiResponse<OrderResponse> response = orderService.modifyOrder(
                userDetails.getUsername(), id, request);

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    // ===== Migrated from TradeController =====

    /**
     * GET /api/orders/transactions?page=0&size=20&type=BUY
     * Lịch sử giao dịch
     */
    @GetMapping("/transactions")
    public ResponseEntity<ApiResponse<Page<TransactionResponse>>> getTransactionHistory(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String type) {

        Pageable pageable = PageRequest.of(page, size);
        ApiResponse<Page<TransactionResponse>> response = orderService.getTransactionHistory(
                userDetails.getUsername(), pageable, type);

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * GET /api/orders/portfolio
     * Danh mục đầu tư
     */
    @GetMapping("/portfolio")
    public ResponseEntity<ApiResponse<java.util.List<PortfolioResponse>>> getPortfolio(
            @AuthenticationPrincipal UserDetails userDetails) {

        ApiResponse<java.util.List<PortfolioResponse>> response = orderService.getPortfolio(
                userDetails.getUsername());

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * GET /api/orders/portfolio/summary
     * Tổng quan danh mục đầu tư (cho charts)
     */
    @GetMapping("/portfolio/summary")
    public ResponseEntity<ApiResponse<PortfolioSummaryResponse>> getPortfolioSummary(
            @AuthenticationPrincipal UserDetails userDetails) {

        ApiResponse<PortfolioSummaryResponse> response = orderService.getPortfolioSummary(
                userDetails.getUsername());

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }
}
