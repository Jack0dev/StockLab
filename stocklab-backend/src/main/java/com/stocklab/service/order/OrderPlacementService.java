package com.stocklab.service.order;

import com.stocklab.presentation.dto.ApiResponse;
import com.stocklab.presentation.dto.OrderRequest;
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
import com.stocklab.service.OtpService;
import com.stocklab.service.PlatformTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderPlacementService {

    private final UserRepository userRepository;
    private final StockRepository stockRepository;
    private final OrderRepository orderRepository;
    private final PortfolioRepository portfolioRepository;
    private final OtpService otpService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Đặt lệnh mua/bán (LO, MP, Conditional, OCO)
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
        TimeInForce tif;
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
                ? OrderStatus.PENDING_TRIGGER
                : OrderStatus.ACTIVE;

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
                    OrderDtoMapper.formatCurrency(totalRequired) + " VND (Bao gồm phí), khả dụng: " +
                    OrderDtoMapper.formatCurrency(availableBalance) + " VND");
        }

        user.setLockedBalance(user.getLockedBalance().add(totalRequired));
        userRepository.save(user);

        Order order = buildOrder(user, stock, OrderSide.BUY, orderType, quantity, price,
                initialStatus, tif, request, expiryDate);
        orderRepository.save(order);

        // Publish events for real-time updates
        eventPublisher.publishEvent(new OrderUpdatedEvent(this, user.getUsername(), OrderDtoMapper.toOrderResponse(order)));
        eventPublisher.publishEvent(new BalanceChangedEvent(this, user.getUsername(),
                BalanceChangedEvent.BalanceReason.ORDER_LOCK));
        eventPublisher.publishEvent(new OrderBookUpdatedEvent(this, stock.getTicker()));

        String msg = orderType.isConditional()
                ? "Đặt lệnh " + orderType + " MUA thành công! Đang chờ điều kiện kích hoạt."
                : "Đặt lệnh MUA " + quantity + " CP " + stock.getTicker() + " thành công!";
        return ApiResponse.success(msg, OrderDtoMapper.toOrderResponse(order));
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
        eventPublisher.publishEvent(new OrderUpdatedEvent(this, user.getUsername(), OrderDtoMapper.toOrderResponse(order)));
        eventPublisher.publishEvent(new PortfolioChangedEvent(this, user.getUsername()));
        eventPublisher.publishEvent(new OrderBookUpdatedEvent(this, stock.getTicker()));

        String msg = orderType.isConditional()
                ? "Đặt lệnh " + orderType + " BÁN thành công! Đang chờ điều kiện kích hoạt."
                : "Đặt lệnh BÁN " + quantity + " CP " + stock.getTicker() + " thành công!";
        return ApiResponse.success(msg, OrderDtoMapper.toOrderResponse(order));
    }

    /**
     * Build Order entity với đầy đủ conditional fields
     */
    private Order buildOrder(User user, Stock stock, OrderSide side, OrderType orderType,
            int quantity, BigDecimal price, OrderStatus status,
            TimeInForce tif, OrderRequest request, LocalDateTime expiryDate) {
        return Order.builder()
                .user(user).stock(stock).side(side).orderType(orderType)
                .quantity(quantity).price(price).status(status)
                .timeInForce(tif).expiryDate(expiryDate)
                .stopPrice(request.getStopPrice())
                .trailingDelta(request.getTrailingDelta())
                .activationPrice(request.getActivationPrice())
                .build();
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
        eventPublisher.publishEvent(new OrderUpdatedEvent(this, username, OrderDtoMapper.toOrderResponse(order1)));
        eventPublisher.publishEvent(new OrderUpdatedEvent(this, username, OrderDtoMapper.toOrderResponse(order2)));
        if (side == OrderSide.BUY) {
            eventPublisher.publishEvent(new BalanceChangedEvent(this, username,
                    BalanceChangedEvent.BalanceReason.ORDER_LOCK));
        } else {
            eventPublisher.publishEvent(new PortfolioChangedEvent(this, username));
        }
        eventPublisher.publishEvent(new OrderBookUpdatedEvent(this, stock.getTicker()));

        return ApiResponse.success("Đặt lệnh OCO thành công! 2 lệnh liên kết đã được tạo.",
                OrderDtoMapper.toOrderResponse(order1));
    }
}
