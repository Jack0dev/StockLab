package com.stocklab.service;

import com.stocklab.dto.*;
import com.stocklab.model.*;
import com.stocklab.repository.*;
import com.stocklab.service.PlatformTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.ApplicationEventPublisher;
import com.stocklab.event.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final UserRepository userRepository;
    private final StockRepository stockRepository;
    private final OrderRepository orderRepository;
    private final PortfolioRepository portfolioRepository;
    private final TransactionRepository transactionRepository;
    private final OtpService otpService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Đặt lệnh mua/bán
     */
    @Transactional
    public ApiResponse<OrderResponse> placeOrder(String username, OrderRequest request) {
        // 1. Tìm user
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ApiResponse.error("Không tìm thấy người dùng");
        }

        // 2. Tìm stock
        Stock stock = stockRepository.findByTicker(request.getTicker().toUpperCase()).orElse(null);
        if (stock == null) {
            return ApiResponse.error("Không tìm thấy cổ phiếu: " + request.getTicker());
        }

        // 3. Parse enums
        OrderSide side;
        try {
            side = OrderSide.valueOf(request.getSide().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ApiResponse.error("Loại lệnh không hợp lệ: " + request.getSide() + ". Chỉ chấp nhận BUY hoặc SELL");
        }

        OrderType orderType;
        try {
            orderType = OrderType.valueOf(request.getOrderType().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ApiResponse.error("Kiểu lệnh không hợp lệ: " + request.getOrderType());
        }

        // 4. XÁC THỰC OTP (bỏ qua cho bot)
        if (!username.startsWith("bot_")) {
            if (request.getOtpCode() == null || request.getOtpCode().isBlank()) {
                return ApiResponse.error("Đặt lệnh yêu cầu mã OTP xác thực!");
            }
            if (!otpService.verifyOtp(user.getEmail(), request.getOtpCode())) {
                return ApiResponse.error("Mã OTP không chính xác hoặc đã hết hạn!");
            }
        }

        // 5. Validate conditional fields
        if (orderType.requiresStopPrice()) {
            if (request.getStopPrice() == null || request.getStopPrice().compareTo(BigDecimal.ZERO) <= 0) {
                return ApiResponse.error(orderType + ": Giá kích hoạt (stopPrice) phải > 0");
            }
        }
        if (orderType.requiresTrailingDelta()) {
            if (request.getTrailingDelta() == null || request.getTrailingDelta().compareTo(BigDecimal.ZERO) <= 0
                    || request.getTrailingDelta().compareTo(BigDecimal.valueOf(20)) > 0) {
                return ApiResponse.error("Trailing delta phải từ 0.01% đến 20%");
            }
        }
        if (orderType == OrderType.OCO) {
            if (request.getPrice() == null || request.getOcoStopPrice() == null) {
                return ApiResponse.error("OCO: Cần cả giá limit và giá stop");
            }
        }

        // 6. Validate price cho LIMIT-like
        BigDecimal price;
        if (orderType.isLimitLike()) {
            if (request.getPrice() == null || request.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
                return ApiResponse.error("Lệnh " + orderType + " bắt buộc phải có giá > 0");
            }
            price = request.getPrice();
        } else {
            price = stock.getCurrentPrice();
        }

        // 7. Validate số lượng
        if (request.getQuantity() == null || request.getQuantity() <= 0) {
            return ApiResponse.error("Số lượng phải lớn hơn 0");
        }

        // 8. Parse TimeInForce
        TimeInForce tif = TimeInForce.GTC;
        if (request.getTimeInForce() != null && !request.getTimeInForce().isBlank()) {
            try {
                tif = TimeInForce.valueOf(request.getTimeInForce().toUpperCase());
            } catch (IllegalArgumentException e) {
                return ApiResponse.error("TimeInForce không hợp lệ: " + request.getTimeInForce());
            }
        } else {
            tif = orderType.isMarketLike() ? TimeInForce.IOC : TimeInForce.GTC;
        }

        // 9. Initial status
        OrderStatus initialStatus = orderType.isConditional()
                ? OrderStatus.PENDING_TRIGGER : OrderStatus.ACTIVE;

        // 10. Parse expiryDate cho GTD
        LocalDateTime expiryDate = null;
        if (tif == TimeInForce.GTD) {
            if (request.getExpiryDate() == null || request.getExpiryDate().isBlank()) {
                return ApiResponse.error("GTD: Ngày hết hạn không được để trống");
            }
            try {
                expiryDate = LocalDate.parse(request.getExpiryDate()).atTime(23, 59, 59);
            } catch (Exception e) {
                return ApiResponse.error("Ngày hết hạn không hợp lệ");
            }
        }

        // 11. OCO: tạo 2 lệnh cùng group
        if (orderType == OrderType.OCO) {
            return placeOcoOrders(user, stock, side, request, tif, expiryDate);
        }

        // 12. Validate & Lock tài sản
        if (side == OrderSide.BUY) {
            return placeBuyOrder(user, stock, orderType, price, request.getQuantity(),
                    initialStatus, tif, request, expiryDate);
        } else {
            return placeSellOrder(user, stock, orderType, price, request.getQuantity(),
                    initialStatus, tif, request, expiryDate);
        }
    }

    /**
     * Xử lý đặt lệnh MUA
     */
    private ApiResponse<OrderResponse> placeBuyOrder(User user, Stock stock, OrderType orderType,
            BigDecimal price, int quantity, OrderStatus initialStatus,
            TimeInForce tif, OrderRequest request, LocalDateTime expiryDate) {
        BigDecimal totalCost = price.multiply(BigDecimal.valueOf(quantity));
        BigDecimal fee = totalCost.multiply(PlatformTokenService.FEE_RATE).setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalRequired = totalCost.add(fee);
        BigDecimal availableBalance = user.getAvailableBalance();

        if (availableBalance.compareTo(totalRequired) < 0) {
            return ApiResponse.error("Số dư khả dụng không đủ! Cần " +
                    formatCurrency(totalRequired) + " VND (Bao gồm phí), khả dụng: " +
                    formatCurrency(availableBalance) + " VND");
        }

        user.setLockedBalance(user.getLockedBalance().add(totalRequired));
        userRepository.save(user);

        Order order = buildOrder(user, stock, OrderSide.BUY, orderType, quantity, price,
                initialStatus, tif, request, expiryDate);
        orderRepository.save(order);

        // Publish events for real-time updates
        eventPublisher.publishEvent(new OrderUpdatedEvent(this, user.getUsername(), toOrderResponse(order)));
        eventPublisher.publishEvent(new BalanceChangedEvent(this, user.getUsername(), com.stocklab.event.BalanceChangedEvent.BalanceReason.ORDER_LOCK));
        eventPublisher.publishEvent(new OrderBookUpdatedEvent(this, stock.getTicker()));

        String msg = orderType.isConditional()
                ? "Đặt lệnh " + orderType + " MUA thành công! Đang chờ điều kiện kích hoạt."
                : "Đặt lệnh MUA " + quantity + " CP " + stock.getTicker() + " thành công!";
        return ApiResponse.success(msg, toOrderResponse(order));
    }

    /**
     * Xử lý đặt lệnh BÁN
     */
    private ApiResponse<OrderResponse> placeSellOrder(User user, Stock stock, OrderType orderType,
            BigDecimal price, int quantity, OrderStatus initialStatus,
            TimeInForce tif, OrderRequest request, LocalDateTime expiryDate) {
        Portfolio portfolio = portfolioRepository.findByUserIdAndStockId(user.getId(), stock.getId())
                .orElse(null);
        int availableQty = (portfolio != null) ? portfolio.getAvailableQuantity() : 0;

        if (availableQty < quantity) {
            return ApiResponse.error("Không đủ cổ phiếu để bán! Đang có " +
                    availableQty + " CP " + stock.getTicker() + " khả dụng");
        }

        portfolio.setLockedQuantity(portfolio.getLockedQuantity() + quantity);
        portfolioRepository.save(portfolio);

        Order order = buildOrder(user, stock, OrderSide.SELL, orderType, quantity, price,
                initialStatus, tif, request, expiryDate);
        orderRepository.save(order);

        // Publish events for real-time updates
        eventPublisher.publishEvent(new OrderUpdatedEvent(this, user.getUsername(), toOrderResponse(order)));
        eventPublisher.publishEvent(new PortfolioChangedEvent(this, user.getUsername()));
        eventPublisher.publishEvent(new OrderBookUpdatedEvent(this, stock.getTicker()));

        String msg = orderType.isConditional()
                ? "Đặt lệnh " + orderType + " BÁN thành công! Đang chờ điều kiện kích hoạt."
                : "Đặt lệnh BÁN " + quantity + " CP " + stock.getTicker() + " thành công!";
        return ApiResponse.success(msg, toOrderResponse(order));
    }

    /**
     * Build Order entity với đầy đủ conditional fields
     */
    private Order buildOrder(User user, Stock stock, OrderSide side, OrderType orderType,
            int quantity, BigDecimal price, OrderStatus status,
            TimeInForce tif, OrderRequest request, LocalDateTime expiryDate) {
        Order order = Order.builder()
                .user(user).stock(stock).side(side).orderType(orderType)
                .quantity(quantity).price(price).status(status)
                .timeInForce(tif).expiryDate(expiryDate)
                .stopPrice(request.getStopPrice())
                .trailingDelta(request.getTrailingDelta())
                .activationPrice(request.getActivationPrice())
                .build();
        return order;
    }

    /**
     * OCO: tạo 2 lệnh liên kết cùng ocoGroupId
     */
    @Transactional
    private ApiResponse<OrderResponse> placeOcoOrders(User user, Stock stock, OrderSide side,
            OrderRequest request, TimeInForce tif, LocalDateTime expiryDate) {
        String groupId = UUID.randomUUID().toString();
        BigDecimal price1 = request.getPrice();
        BigDecimal stopPrice2 = request.getOcoStopPrice();
        BigDecimal limitPrice2 = request.getOcoLimitPrice();
        int quantity = request.getQuantity();

        // Lock tài sản cho cả 2 lệnh
        BigDecimal lockPrice = price1.max(limitPrice2 != null ? limitPrice2 : stopPrice2);
        BigDecimal totalCost = lockPrice.multiply(BigDecimal.valueOf(quantity));
        BigDecimal fee = totalCost.multiply(PlatformTokenService.FEE_RATE).setScale(2, RoundingMode.HALF_UP);

        if (side == OrderSide.BUY) {
            BigDecimal available = user.getAvailableBalance();
            if (available.compareTo(totalCost.add(fee)) < 0) {
                return ApiResponse.error("Số dư không đủ cho lệnh OCO");
            }
            user.setLockedBalance(user.getLockedBalance().add(totalCost.add(fee)));
            userRepository.save(user);
        } else {
            Portfolio p = portfolioRepository.findByUserIdAndStockId(user.getId(), stock.getId()).orElse(null);
            if (p == null || p.getAvailableQuantity() < quantity) {
                return ApiResponse.error("Không đủ CP cho lệnh OCO");
            }
            p.setLockedQuantity(p.getLockedQuantity() + quantity);
            portfolioRepository.save(p);
        }

        // Lệnh 1: LIMIT (take profit)
        Order order1 = Order.builder()
                .user(user).stock(stock).side(side).orderType(OrderType.OCO)
                .quantity(quantity).price(price1).status(OrderStatus.ACTIVE)
                .timeInForce(tif).ocoGroupId(groupId).expiryDate(expiryDate)
                .build();
        orderRepository.save(order1);

        // Lệnh 2: STOP (stop loss) — PENDING_TRIGGER
        Order order2 = Order.builder()
                .user(user).stock(stock).side(side).orderType(OrderType.STOP_LIMIT)
                .quantity(quantity).price(limitPrice2 != null ? limitPrice2 : stopPrice2)
                .stopPrice(stopPrice2).status(OrderStatus.PENDING_TRIGGER)
                .timeInForce(tif).ocoGroupId(groupId).expiryDate(expiryDate)
                .build();
        orderRepository.save(order2);

        // Publish events for real-time updates
        String username = user.getUsername();
        eventPublisher.publishEvent(new OrderUpdatedEvent(this, username, toOrderResponse(order1)));
        eventPublisher.publishEvent(new OrderUpdatedEvent(this, username, toOrderResponse(order2)));
        if (side == OrderSide.BUY) {
            eventPublisher.publishEvent(new BalanceChangedEvent(this, username, com.stocklab.event.BalanceChangedEvent.BalanceReason.ORDER_LOCK));
        } else {
            eventPublisher.publishEvent(new PortfolioChangedEvent(this, username));
        }
        eventPublisher.publishEvent(new OrderBookUpdatedEvent(this, stock.getTicker()));

        return ApiResponse.success("Đặt lệnh OCO thành công! 2 lệnh liên kết đã được tạo.",
                toOrderResponse(order1));
    }

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
                        .map(this::toOrderResponse);
            } catch (IllegalArgumentException e) {
                return ApiResponse.error("Trạng thái lệnh không hợp lệ: " + status);
            }
        } else {
            orders = orderRepository
                    .findByUserIdOrderByCreatedAtDesc(user.getId(), pageable)
                    .map(this::toOrderResponse);
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

        // Chỉ cho phép xem lệnh của chính mình
        if (!order.getUser().getId().equals(user.getId())) {
            return ApiResponse.error("Bạn không có quyền xem lệnh này");
        }

        return ApiResponse.success("OK", toOrderResponse(order));
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

        // Chỉ cho phép hủy lệnh của chính mình
        if (!order.getUser().getId().equals(user.getId())) {
            return ApiResponse.error("Bạn không có quyền hủy lệnh này");
        }

        // Chỉ hủy được PENDING hoặc PARTIAL
        if (!order.isCancellable()) {
            return ApiResponse.error("Không thể hủy lệnh ở trạng thái: " + order.getStatus().name());
        }

        int remainingQty = order.getRemainingQuantity();

        // Unlock tài sản theo remaining quantity
        if (order.getSide() == OrderSide.BUY) {
            // Hoàn tiền locked = (remaining * price) + fee của phần đó
            BigDecimal refundSubTotal = order.getPrice().multiply(BigDecimal.valueOf(remainingQty));
            BigDecimal refundFee = refundSubTotal.multiply(PlatformTokenService.FEE_RATE).setScale(2, RoundingMode.HALF_UP);
            BigDecimal totalRefund = refundSubTotal.add(refundFee);
            
            user.setLockedBalance(user.getLockedBalance().subtract(totalRefund));
            userRepository.save(user);
        } else {
            // Hoàn CP locked
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

        // Publish events for real-time updates
        eventPublisher.publishEvent(new OrderUpdatedEvent(this, username, toOrderResponse(order)));
        if (order.getSide() == OrderSide.BUY) {
            eventPublisher.publishEvent(new BalanceChangedEvent(this, username, com.stocklab.event.BalanceChangedEvent.BalanceReason.ORDER_UNLOCK));
        } else {
            eventPublisher.publishEvent(new PortfolioChangedEvent(this, username));
        }
        eventPublisher.publishEvent(new OrderBookUpdatedEvent(this, order.getStock().getTicker()));

        return ApiResponse.success(
                "Đã hủy lệnh #" + orderId + " thành công! Hoàn " + remainingQty +
                        (order.getSide() == OrderSide.BUY ? " phần tiền đã lock" : " CP đã lock"),
                toOrderResponse(order));
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

        // Chỉ cho phép sửa lệnh của chính mình
        if (!oldOrder.getUser().getId().equals(user.getId())) {
            return ApiResponse.error("Bạn không có quyền sửa lệnh này");
        }

        // Chỉ sửa được PENDING hoặc PARTIAL
        if (!oldOrder.isCancellable()) {
            return ApiResponse.error("Không thể sửa lệnh ở trạng thái: " + oldOrder.getStatus());
        }

        // Validate input
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

        // Lock tài sản mới
        if (oldOrder.getSide() == OrderSide.BUY) {
            BigDecimal newSubTotal = newPrice.multiply(BigDecimal.valueOf(newQuantity));
            BigDecimal newFee = newSubTotal.multiply(PlatformTokenService.FEE_RATE).setScale(2, RoundingMode.HALF_UP);
            BigDecimal lockAmount = newSubTotal.add(newFee);
            
            BigDecimal available = user.getBalance().subtract(user.getLockedBalance());
            if (available.compareTo(lockAmount) < 0) {
                // Rollback cancel — unlock đã xảy ra nên phải lock lại
                // Nhưng vì đã cancel rồi, trả error cho user biết
                userRepository.save(user);
                return ApiResponse.error("Không đủ số dư để đặt lệnh mới (Bao gồm phí). Lệnh cũ đã được hủy. " +
                        "Số dư khả dụng: " + formatCurrency(available) + " VND, cần: " + formatCurrency(lockAmount) + " VND");
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

        // Publish events for real-time updates
        eventPublisher.publishEvent(new OrderUpdatedEvent(this, username, toOrderResponse(oldOrder)));
        eventPublisher.publishEvent(new OrderUpdatedEvent(this, username, toOrderResponse(newOrder)));
        if (newOrder.getSide() == OrderSide.BUY) {
            eventPublisher.publishEvent(new BalanceChangedEvent(this, username, com.stocklab.event.BalanceChangedEvent.BalanceReason.ORDER_UNLOCK));
        } else {
            eventPublisher.publishEvent(new PortfolioChangedEvent(this, username));
        }
        eventPublisher.publishEvent(new OrderBookUpdatedEvent(this, newOrder.getStock().getTicker()));

        return ApiResponse.success(
                "Đã sửa lệnh thành công! Lệnh cũ #" + orderId + " → hủy, lệnh mới #" + newOrder.getId(),
                toOrderResponse(newOrder));
    }

    /**
     * Lấy Order Book cho 1 cổ phiếu — group lệnh PENDING/PARTIAL theo giá
     */
    public ApiResponse<OrderBookResponse> getOrderBook(String ticker) {
        Stock stock = stockRepository.findByTicker(ticker.toUpperCase()).orElse(null);
        if (stock == null) {
            return ApiResponse.error("Không tìm thấy cổ phiếu: " + ticker);
        }

        List<OrderStatus> activeStatuses = List.of(OrderStatus.ACTIVE, OrderStatus.PARTIALLY_FILLED);

        // Lấy tất cả lệnh BUY đang active
        List<Order> buyOrders = orderRepository.findByStockIdAndSideAndStatusIn(
                stock.getId(), OrderSide.BUY, activeStatuses);

        // Lấy tất cả lệnh SELL đang active
        List<Order> sellOrders = orderRepository.findByStockIdAndSideAndStatusIn(
                stock.getId(), OrderSide.SELL, activeStatuses);

        // Group BUY theo giá → bids (giá giảm dần)
        List<OrderBookResponse.OrderBookEntry> bids = groupByPrice(buyOrders, true);

        // Group SELL theo giá → asks (giá tăng dần)
        List<OrderBookResponse.OrderBookEntry> asks = groupByPrice(sellOrders, false);

        OrderBookResponse orderBook = OrderBookResponse.builder()
                .ticker(stock.getTicker())
                .companyName(stock.getCompanyName())
                .bids(bids)
                .asks(asks)
                .build();

        return ApiResponse.success("OK", orderBook);
    }

    /**
     * Group danh sách Order theo price → tính tổng remaining quantity + đếm số lệnh
     */
    private List<OrderBookResponse.OrderBookEntry> groupByPrice(List<Order> orders, boolean descending) {
        // Group theo price
        java.util.Map<BigDecimal, List<Order>> grouped = orders.stream()
                .collect(java.util.stream.Collectors.groupingBy(Order::getPrice));

        // Chuyển thành OrderBookEntry
        List<OrderBookResponse.OrderBookEntry> entries = grouped.entrySet().stream()
                .map(entry -> OrderBookResponse.OrderBookEntry.builder()
                        .price(entry.getKey())
                        .totalQuantity(entry.getValue().stream()
                                .mapToInt(Order::getRemainingQuantity)
                                .sum())
                        .orderCount(entry.getValue().size())
                        .build())
                .collect(java.util.stream.Collectors.toList());

        // Sắp xếp: BUY giá giảm dần, SELL giá tăng dần
        if (descending) {
            entries.sort((a, b) -> b.getPrice().compareTo(a.getPrice()));
        } else {
            entries.sort((a, b) -> a.getPrice().compareTo(b.getPrice()));
        }

        return entries;
    }

    // ===== Helper Methods =====

    OrderResponse toOrderResponse(Order order) {
        return OrderResponse.builder()
                .id(order.getId())
                .user(OrderResponse.UserDto.builder()
                        .id(order.getUser().getId())
                        .username(order.getUser().getUsername())
                        .email(order.getUser().getEmail())
                        .build())
                .ticker(order.getStock().getTicker())
                .companyName(order.getStock().getCompanyName())
                .side(order.getSide().name())
                .orderType(order.getOrderType().name())
                .quantity(order.getQuantity())
                .filledQuantity(order.getFilledQuantity())
                .price(order.getPrice())
                .status(order.getStatus().name())
                .timeInForce(order.getTimeInForce() != null ? order.getTimeInForce().name() : null)
                .stopPrice(order.getStopPrice())
                .trailingDelta(order.getTrailingDelta())
                .activationPrice(order.getActivationPrice())
                .ocoGroupId(order.getOcoGroupId())
                .triggered(order.getTriggered())
                .triggeredAt(order.getTriggeredAt())
                .expiryDate(order.getExpiryDate())
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }

    private String formatCurrency(BigDecimal amount) {
        return String.format("%,.0f", amount);
    }

    // ===== Lệnh Admin (ADM-5) =====

    /**
     * Lấy TẤT CẢ lệnh trên hệ thống cho Admin (pagination)
     */
    public ApiResponse<Page<OrderResponse>> getAllOrdersForAdmin(Pageable pageable) {
        Page<OrderResponse> orders = orderRepository.findAll(pageable).map(this::toOrderResponse);
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

        // Chỉ hủy được PENDING hoặc PARTIAL
        if (!order.isCancellable()) {
            return ApiResponse.error("Không thể hủy lệnh ở trạng thái: " + order.getStatus());
        }

        int remainingQty = order.getRemainingQuantity();

        // Unlock tài sản theo remaining quantity
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

        return ApiResponse.success("Admin đã cưỡng chế hủy lệnh #" + orderId + " thành công!", toOrderResponse(order));
    }

    // ===== Migrated from TradeService =====

    /**
     * Lịch sử giao dịch
     */
    public ApiResponse<Page<TransactionResponse>> getTransactionHistory(
            String username, Pageable pageable, String type) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return ApiResponse.error("Không tìm thấy người dùng");

        Page<TransactionResponse> transactions;
        if (type != null && !type.isEmpty()) {
            try {
                TransactionType txType = TransactionType.valueOf(type.toUpperCase());
                transactions = transactionRepository
                        .findByUserIdAndTypeOrderByCreatedAtDesc(user.getId(), txType, pageable)
                        .map(this::toTransactionResponse);
            } catch (IllegalArgumentException e) {
                return ApiResponse.error("Loại giao dịch không hợp lệ: " + type);
            }
        } else {
            transactions = transactionRepository
                    .findByUserIdOrderByCreatedAtDesc(user.getId(), pageable)
                    .map(this::toTransactionResponse);
        }
        return ApiResponse.success("Lấy lịch sử giao dịch thành công", transactions);
    }

    /**
     * Danh mục đầu tư
     */
    public ApiResponse<List<PortfolioResponse>> getPortfolio(String username) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return ApiResponse.error("Không tìm thấy người dùng");

        List<PortfolioResponse> portfolio = portfolioRepository.findByUserId(user.getId())
                .stream()
                .map(this::toPortfolioResponse)
                .collect(Collectors.toList());

        return ApiResponse.success("Lấy danh mục đầu tư thành công", portfolio);
    }

    /**
     * Portfolio Summary (cho charts)
     */
    public ApiResponse<PortfolioSummaryResponse> getPortfolioSummary(String username) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return ApiResponse.error("Không tìm thấy người dùng");

        List<Portfolio> holdings = portfolioRepository.findByUserId(user.getId());

        String[] chartColors = {
            "#2962ff", "#00c853", "#ff6d00", "#aa00ff", "#d50000",
            "#00bfa5", "#6200ea", "#c51162", "#0091ea", "#64dd17"
        };

        BigDecimal totalStockValue = BigDecimal.ZERO;
        List<PortfolioSummaryResponse.AllocationItem> allocations = new java.util.ArrayList<>();

        for (int i = 0; i < holdings.size(); i++) {
            Portfolio p = holdings.get(i);
            Stock stock = p.getStock();
            BigDecimal value = stock.getCurrentPrice().multiply(BigDecimal.valueOf(p.getQuantity()));
            totalStockValue = totalStockValue.add(value);

            allocations.add(PortfolioSummaryResponse.AllocationItem.builder()
                    .ticker(stock.getTicker())
                    .companyName(stock.getCompanyName())
                    .value(value)
                    .color(chartColors[i % chartColors.length])
                    .build());
        }

        BigDecimal totalAssets = totalStockValue.add(user.getBalance());
        for (PortfolioSummaryResponse.AllocationItem item : allocations) {
            if (totalStockValue.compareTo(BigDecimal.ZERO) > 0) {
                item.setPercentage(item.getValue()
                        .divide(totalStockValue, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                        .doubleValue());
            } else {
                item.setPercentage(0.0);
            }
        }

        BigDecimal totalInvested = BigDecimal.ZERO;
        for (Portfolio p : holdings) {
            totalInvested = totalInvested.add(
                    p.getAvgBuyPrice().multiply(BigDecimal.valueOf(p.getQuantity())));
        }
        BigDecimal totalPnL = totalStockValue.subtract(totalInvested);
        double totalPnLPercent = totalInvested.compareTo(BigDecimal.ZERO) > 0
                ? totalPnL.divide(totalInvested, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100)).doubleValue()
                : 0.0;

        PortfolioSummaryResponse summary = PortfolioSummaryResponse.builder()
                .totalAssets(totalAssets)
                .totalStockValue(totalStockValue)
                .cashBalance(user.getBalance())
                .totalPnL(totalPnL)
                .totalPnLPercent(totalPnLPercent)
                .allocations(allocations)
                .build();

        return ApiResponse.success("OK", summary);
    }

    private TransactionResponse toTransactionResponse(Transaction tx) {
        return TransactionResponse.builder()
                .id(tx.getId())
                .ticker(tx.getStock().getTicker())
                .companyName(tx.getStock().getCompanyName())
                .type(tx.getType().name())
                .quantity(tx.getQuantity())
                .price(tx.getPrice())
                .totalAmount(tx.getTotalAmount())
                .createdAt(tx.getCreatedAt())
                .build();
    }

    private PortfolioResponse toPortfolioResponse(Portfolio p) {
        Stock stock = p.getStock();
        BigDecimal currentPrice = stock.getCurrentPrice();
        BigDecimal totalValue = currentPrice.multiply(BigDecimal.valueOf(p.getQuantity()));
        BigDecimal profitLoss = currentPrice.subtract(p.getAvgBuyPrice())
                .multiply(BigDecimal.valueOf(p.getQuantity()));

        double profitLossPercent = 0.0;
        if (p.getAvgBuyPrice().compareTo(BigDecimal.ZERO) > 0) {
            profitLossPercent = currentPrice.subtract(p.getAvgBuyPrice())
                    .divide(p.getAvgBuyPrice(), 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .doubleValue();
        }

        return PortfolioResponse.builder()
                .id(p.getId())
                .ticker(stock.getTicker())
                .companyName(stock.getCompanyName())
                .exchange(stock.getExchange())
                .quantity(p.getQuantity())
                .avgBuyPrice(p.getAvgBuyPrice())
                .currentPrice(currentPrice)
                .totalValue(totalValue)
                .profitLoss(profitLoss)
                .profitLossPercent(profitLossPercent)
                .build();
    }
}
