package com.stocklab.service;

import com.stocklab.presentation.dto.*;
import com.stocklab.domain.model.Order;
import com.stocklab.service.order.OrderDtoMapper;
import com.stocklab.service.order.OrderManagementService;
import com.stocklab.service.order.OrderPlacementService;
import com.stocklab.service.order.PortfolioQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * OrderService — Facade Pattern
 * Điều phối các nghiệp vụ đặt lệnh, quản lý lệnh và truy vấn danh mục
 * thông qua các sub-services chuyên biệt:
 * 1. OrderPlacementService: Tiếp nhận, validate, lock tài sản & tạo lệnh
 * 2. OrderManagementService: Hủy, sửa, lấy sổ lệnh & admin controls
 * 3. PortfolioQueryService: Lấy danh mục, tóm tắt NAV & lịch sử giao dịch
 */
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderPlacementService orderPlacementService;
    private final OrderManagementService orderManagementService;
    private final PortfolioQueryService portfolioQueryService;
    private final com.stocklab.service.order.OrderEstimationService orderEstimationService;

    // ===== 1. Order Estimation & Valuation =====

    public ApiResponse<OrderEstimateResponse> estimateOrder(String username, OrderEstimateRequest request) {
        return orderEstimationService.estimateOrder(username, request);
    }

    // ===== 2. Order Placement =====

    public ApiResponse<OrderResponse> placeOrder(String username, OrderRequest request) {
        return orderPlacementService.placeOrder(username, request);
    }

    // ===== 2. Order Management & Query =====

    public ApiResponse<Page<OrderResponse>> getMyOrders(String username, Pageable pageable, String status) {
        return orderManagementService.getMyOrders(username, pageable, status);
    }

    public ApiResponse<OrderResponse> getOrderDetail(String username, Long orderId) {
        return orderManagementService.getOrderDetail(username, orderId);
    }

    public ApiResponse<OrderResponse> cancelOrder(String username, Long orderId) {
        return orderManagementService.cancelOrder(username, orderId);
    }

    public ApiResponse<OrderResponse> modifyOrder(String username, Long orderId, ModifyOrderRequest request) {
        return orderManagementService.modifyOrder(username, orderId, request);
    }

    public ApiResponse<OrderBookResponse> getOrderBook(String ticker) {
        return orderManagementService.getOrderBook(ticker);
    }

    public ApiResponse<Page<OrderResponse>> getAllOrdersForAdmin(Pageable pageable) {
        return orderManagementService.getAllOrdersForAdmin(pageable);
    }

    public ApiResponse<OrderResponse> forceCancelOrder(Long orderId) {
        return orderManagementService.forceCancelOrder(orderId);
    }

    // ===== 3. Portfolio & Transaction Queries =====

    public ApiResponse<Page<TransactionResponse>> getTransactionHistory(
            String username, Pageable pageable, String type) {
        return portfolioQueryService.getTransactionHistory(username, pageable, type);
    }

    public ApiResponse<List<PortfolioResponse>> getPortfolio(String username) {
        return portfolioQueryService.getPortfolio(username);
    }

    public ApiResponse<PortfolioSummaryResponse> getPortfolioSummary(String username) {
        return portfolioQueryService.getPortfolioSummary(username);
    }

    // ===== Helper mapping for external callers =====

    public OrderResponse toOrderResponse(Order order) {
        return OrderDtoMapper.toOrderResponse(order);
    }
}
