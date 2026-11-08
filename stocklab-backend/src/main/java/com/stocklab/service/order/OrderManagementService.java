package com.stocklab.service.order;

import com.stocklab.presentation.dto.ApiResponse;
import com.stocklab.presentation.dto.ModifyOrderRequest;
import com.stocklab.presentation.dto.OrderBookResponse;
import com.stocklab.presentation.dto.OrderResponse;
import com.stocklab.infrastructure.event.BalanceChangedEvent;
import com.stocklab.infrastructure.event.OrderBookUpdatedEvent;
import com.stocklab.infrastructure.event.OrderUpdatedEvent;
import com.stocklab.infrastructure.event.PortfolioChangedEvent;
import com.stocklab.domain.model.*;
import com.stocklab.infrastructure.repository.OrderRepository;
import com.stocklab.infrastructure.repository.PortfolioRepository;
import com.stocklab.infrastructure.repository.StockRepository;
import com.stocklab.infrastructure.repository.UserRepository;
import com.stocklab.service.PlatformTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderManagementService {

    private final UserRepository userRepository;
    private final StockRepository stockRepository;
    private final OrderRepository orderRepository;
    private final PortfolioRepository portfolioRepository;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Lấy danh sách lệnh của user (pagination)
     */
    public ApiResponse<Page<OrderResponse>> getMyOrders(String username, Pageable pageable, String status) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ApiResponse.error("Không tìm thấy người dùng");
        }

        Page<OrderResponse> orders;
        if (status != null && !status.isEmpty()) {
            try {
                OrderStatus orderStatus = OrderStatus.valueOf(status.toUpperCase());
                orders = orderRepository
                        .findByUserIdAndStatusOrderByCreatedAtDesc(user.getId(), orderStatus, pageable)
                        .map(OrderDtoMapper::toOrderResponse);
            } catch (IllegalArgumentException e) {
                return ApiResponse.error("Trạng thái lệnh không hợp lệ: " + status);
            }
        } else {
            orders = orderRepository
                    .findByUserIdOrderByCreatedAtDesc(user.getId(), pageable)
                    .map(OrderDtoMapper::toOrderResponse);
        }

        return ApiResponse.success("Lấy danh sách lệnh thành công", orders);
    }

    /**
     * Lấy chi tiết 1 lệnh
     */
    public ApiResponse<OrderResponse> getOrderDetail(String username, Long orderId) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ApiResponse.error("Không tìm thấy người dùng");
        }

        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            return ApiResponse.error("Không tìm thấy lệnh #" + orderId);
        }

        if (!order.getUser().getId().equals(user.getId())) {
            return ApiResponse.error("Bạn không có quyền xem lệnh này");
        }

        return ApiResponse.success("OK", OrderDtoMapper.toOrderResponse(order));
    }

    /**
     * Hủy lệnh — chỉ cho phép PENDING hoặc PARTIAL
     */
    @Transactional
    public ApiResponse<OrderResponse> cancelOrder(String username, Long orderId) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ApiResponse.error("Không tìm thấy người dùng");
        }

        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            return ApiResponse.error("Không tìm thấy lệnh #" + orderId);
        }

        if (!order.getUser().getId().equals(user.getId())) {
            return ApiResponse.error("Bạn không có quyền hủy lệnh này");
        }

        if (!order.isCancellable()) {
            return ApiResponse.error("Không thể hủy lệnh ở trạng thái: " + order.getStatus().name());
        }

        int remainingQty = order.getRemainingQuantity();

        // Unlock tài sản
        if (order.getSide() == OrderSide.BUY) {
            BigDecimal refundSubTotal = order.getPrice().multiply(BigDecimal.valueOf(remainingQty));
            BigDecimal refundFee = refundSubTotal.multiply(PlatformTokenService.FEE_RATE).setScale(2, RoundingMode.HALF_UP);
            BigDecimal totalRefund = refundSubTotal.add(refundFee);

            user.setLockedBalance(user.getLockedBalance().subtract(totalRefund));
            userRepository.save(user);
        } else {
            Portfolio portfolio = portfolioRepository
                    .findByUserIdAndStockId(user.getId(), order.getStock().getId())
                    .orElse(null);
            if (portfolio != null) {
                portfolio.setLockedQuantity(portfolio.getLockedQuantity() - remainingQty);
                portfolioRepository.save(portfolio);
            }
        }

        order.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);

        eventPublisher.publishEvent(new OrderUpdatedEvent(this, username, OrderDtoMapper.toOrderResponse(order)));
        if (order.getSide() == OrderSide.BUY) {
            eventPublisher.publishEvent(new BalanceChangedEvent(this, username,
                    BalanceChangedEvent.BalanceReason.ORDER_UNLOCK));
        } else {
            eventPublisher.publishEvent(new PortfolioChangedEvent(this, username));
        }
        eventPublisher.publishEvent(new OrderBookUpdatedEvent(this, order.getStock().getTicker()));

        return ApiResponse.success(
                "Đã hủy lệnh #" + orderId + " thành công! Hoàn " + remainingQty +
                        (order.getSide() == OrderSide.BUY ? " phần tiền đã lock" : " CP đã lock"),
                OrderDtoMapper.toOrderResponse(order));
    }

    /**
     * Sửa lệnh — hủy lệnh cũ + đặt lệnh mới với giá/số lượng mới
     */
    @Transactional
    public ApiResponse<OrderResponse> modifyOrder(String username, Long orderId, ModifyOrderRequest request) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ApiResponse.error("Không tìm thấy người dùng");
        }

        Order oldOrder = orderRepository.findById(orderId).orElse(null);
        if (oldOrder == null) {
            return ApiResponse.error("Không tìm thấy lệnh #" + orderId);
        }

        if (!oldOrder.getUser().getId().equals(user.getId())) {
            return ApiResponse.error("Bạn không có quyền sửa lệnh này");
        }

        if (!oldOrder.isCancellable()) {
            return ApiResponse.error("Không thể sửa lệnh ở trạng thái: " + oldOrder.getStatus());
        }

        if (request.getQuantity() == null || request.getQuantity() <= 0) {
            return ApiResponse.error("Số lượng phải lớn hơn 0");
        }
        if (request.getPrice() == null || request.getPrice() <= 0) {
            return ApiResponse.error("Giá phải lớn hơn 0");
        }

        // --- Bước 1: Hủy lệnh cũ (unlock tài sản) ---
        int remainingQty = oldOrder.getRemainingQuantity();

        if (oldOrder.getSide() == OrderSide.BUY) {
            BigDecimal refundSubTotal = oldOrder.getPrice().multiply(BigDecimal.valueOf(remainingQty));
            BigDecimal refundFee = refundSubTotal.multiply(PlatformTokenService.FEE_RATE).setScale(2, RoundingMode.HALF_UP);
            BigDecimal totalRefund = refundSubTotal.add(refundFee);

            user.setLockedBalance(user.getLockedBalance().subtract(totalRefund));
        } else {
            Portfolio portfolio = portfolioRepository
                    .findByUserIdAndStockId(user.getId(), oldOrder.getStock().getId())
                    .orElse(null);
            if (portfolio != null) {
                portfolio.setLockedQuantity(portfolio.getLockedQuantity() - remainingQty);
                portfolioRepository.save(portfolio);
            }
        }

        oldOrder.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(oldOrder);

        // --- Bước 2: Đặt lệnh mới ---
        BigDecimal newPrice = BigDecimal.valueOf(request.getPrice());
        int newQuantity = request.getQuantity();

        if (oldOrder.getSide() == OrderSide.BUY) {
            BigDecimal newSubTotal = newPrice.multiply(BigDecimal.valueOf(newQuantity));
            BigDecimal newFee = newSubTotal.multiply(PlatformTokenService.FEE_RATE).setScale(2, RoundingMode.HALF_UP);
            BigDecimal lockAmount = newSubTotal.add(newFee);

            BigDecimal available = user.getBalance().subtract(user.getLockedBalance());
            if (available.compareTo(lockAmount) < 0) {
                userRepository.save(user);
                return ApiResponse.error("Không đủ số dư để đặt lệnh mới (Bao gồm phí). Lệnh cũ đã được hủy. " +
                        "Số dư khả dụng: " + OrderDtoMapper.formatCurrency(available) + " VND, cần: " +
                        OrderDtoMapper.formatCurrency(lockAmount) + " VND");
            }
            user.setLockedBalance(user.getLockedBalance().add(lockAmount));
        } else {
            Portfolio portfolio = portfolioRepository
                    .findByUserIdAndStockId(user.getId(), oldOrder.getStock().getId())
                    .orElse(null);
            int availableQty = (portfolio != null)
                    ? portfolio.getQuantity() - portfolio.getLockedQuantity()
                    : 0;
            if (availableQty < newQuantity) {
                userRepository.save(user);
                return ApiResponse.error("Không đủ CP để đặt lệnh bán mới. Lệnh cũ đã được hủy. " +
                        "Khả dụng: " + availableQty + " CP, cần: " + newQuantity + " CP");
            }
            portfolio.setLockedQuantity(portfolio.getLockedQuantity() + newQuantity);
            portfolioRepository.save(portfolio);
        }

        userRepository.save(user);

        // Tạo lệnh mới
        Order newOrder = new Order();
        newOrder.setUser(user);
        newOrder.setStock(oldOrder.getStock());
        newOrder.setSide(oldOrder.getSide());
        newOrder.setOrderType(oldOrder.getOrderType());
        newOrder.setQuantity(newQuantity);
        newOrder.setFilledQuantity(0);
        newOrder.setPrice(newPrice);
        newOrder.setStatus(OrderStatus.ACTIVE);
        orderRepository.save(newOrder);

        eventPublisher.publishEvent(new OrderUpdatedEvent(this, username, OrderDtoMapper.toOrderResponse(oldOrder)));
        eventPublisher.publishEvent(new OrderUpdatedEvent(this, username, OrderDtoMapper.toOrderResponse(newOrder)));
        if (newOrder.getSide() == OrderSide.BUY) {
            eventPublisher.publishEvent(new BalanceChangedEvent(this, username,
                    BalanceChangedEvent.BalanceReason.ORDER_UNLOCK));
        } else {
            eventPublisher.publishEvent(new PortfolioChangedEvent(this, username));
        }
        eventPublisher.publishEvent(new OrderBookUpdatedEvent(this, newOrder.getStock().getTicker()));

        return ApiResponse.success(
                "Đã sửa lệnh thành công! Lệnh cũ #" + orderId + " → hủy, lệnh mới #" + newOrder.getId(),
                OrderDtoMapper.toOrderResponse(newOrder));
    }

    /**
     * Lấy Order Book cho 1 cổ phiếu
     */
    public ApiResponse<OrderBookResponse> getOrderBook(String ticker) {
        Stock stock = stockRepository.findByTicker(ticker.toUpperCase()).orElse(null);
        if (stock == null) {
            return ApiResponse.error("Không tìm thấy cổ phiếu: " + ticker);
        }

        List<OrderStatus> activeStatuses = List.of(OrderStatus.ACTIVE, OrderStatus.PARTIALLY_FILLED);

        List<Order> buyOrders = orderRepository.findByStockIdAndSideAndStatusIn(
                stock.getId(), OrderSide.BUY, activeStatuses);

        List<Order> sellOrders = orderRepository.findByStockIdAndSideAndStatusIn(
                stock.getId(), OrderSide.SELL, activeStatuses);

        List<OrderBookResponse.OrderBookEntry> bids = groupByPrice(buyOrders, true);
        List<OrderBookResponse.OrderBookEntry> asks = groupByPrice(sellOrders, false);

        OrderBookResponse orderBook = OrderBookResponse.builder()
                .ticker(stock.getTicker())
                .companyName(stock.getCompanyName())
                .bids(bids)
                .asks(asks)
                .build();

        return ApiResponse.success("OK", orderBook);
    }

    private List<OrderBookResponse.OrderBookEntry> groupByPrice(List<Order> orders, boolean descending) {
        Map<BigDecimal, List<Order>> grouped = orders.stream()
                .collect(Collectors.groupingBy(Order::getPrice));

        List<OrderBookResponse.OrderBookEntry> entries = grouped.entrySet().stream()
                .map(entry -> OrderBookResponse.OrderBookEntry.builder()
                        .price(entry.getKey())
                        .totalQuantity(entry.getValue().stream().mapToInt(Order::getRemainingQuantity).sum())
                        .orderCount(entry.getValue().size())
                        .build())
                .collect(Collectors.toList());

        if (descending) {
            entries.sort((a, b) -> b.getPrice().compareTo(a.getPrice()));
        } else {
            entries.sort((a, b) -> a.getPrice().compareTo(b.getPrice()));
        }

        return entries;
    }

    /**
     * Admin: Lấy TẤT CẢ lệnh trên hệ thống
     */
    public ApiResponse<Page<OrderResponse>> getAllOrdersForAdmin(Pageable pageable) {
        Page<OrderResponse> orders = orderRepository.findAll(pageable).map(OrderDtoMapper::toOrderResponse);
        return ApiResponse.success("Lấy danh sách mọi lệnh thành công", orders);
    }

    /**
     * Admin cưỡng chế hủy lệnh
     */
    @Transactional
    public ApiResponse<OrderResponse> forceCancelOrder(Long orderId) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            return ApiResponse.error("Không tìm thấy lệnh #" + orderId);
        }

        if (!order.isCancellable()) {
            return ApiResponse.error("Không thể hủy lệnh ở trạng thái: " + order.getStatus());
        }

        int remainingQty = order.getRemainingQuantity();
        User orderOwner = order.getUser();

        if (order.getSide() == OrderSide.BUY) {
            BigDecimal refundSubTotal = order.getPrice().multiply(BigDecimal.valueOf(remainingQty));
            BigDecimal refundFee = refundSubTotal.multiply(PlatformTokenService.FEE_RATE).setScale(2, RoundingMode.HALF_UP);
            BigDecimal totalRefund = refundSubTotal.add(refundFee);

            orderOwner.setLockedBalance(orderOwner.getLockedBalance().subtract(totalRefund));
            userRepository.save(orderOwner);
        } else {
            Portfolio portfolio = portfolioRepository
                    .findByUserIdAndStockId(orderOwner.getId(), order.getStock().getId())
                    .orElse(null);
            if (portfolio != null) {
                portfolio.setLockedQuantity(portfolio.getLockedQuantity() - remainingQty);
                portfolioRepository.save(portfolio);
            }
        }

        order.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);

        eventPublisher.publishEvent(new OrderBookUpdatedEvent(this, order.getStock().getTicker()));

        return ApiResponse.success("Admin đã cưỡng chế hủy lệnh #" + orderId + " thành công!",
                OrderDtoMapper.toOrderResponse(order));
    }
}
