package com.stocklab.service.order;

import com.stocklab.presentation.dto.ApiResponse;
import com.stocklab.presentation.dto.OrderEstimateRequest;
import com.stocklab.presentation.dto.OrderEstimateResponse;
import com.stocklab.domain.model.Portfolio;
import com.stocklab.domain.model.Stock;
import com.stocklab.domain.model.TradingConstants;
import com.stocklab.domain.model.User;
import com.stocklab.infrastructure.repository.PortfolioRepository;
import com.stocklab.infrastructure.repository.StockRepository;
import com.stocklab.infrastructure.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
@RequiredArgsConstructor
public class OrderEstimationService {

    private final UserRepository userRepository;
    private final StockRepository stockRepository;
    private final PortfolioRepository portfolioRepository;

    /**
     * Ước tính và định giá lệnh mua/bán (Pure Business Logic)
     */
    @Transactional(readOnly = true)
    public ApiResponse<OrderEstimateResponse> estimateOrder(String username, OrderEstimateRequest request) {
        if (request.getTicker() == null || request.getTicker().isBlank()) {
            return ApiResponse.error("Mã cổ phiếu không được để trống");
        }

        Stock stock = stockRepository.findByTicker(request.getTicker().trim().toUpperCase()).orElse(null);
        if (stock == null) {
            return ApiResponse.error("Không tìm thấy mã cổ phiếu: " + request.getTicker());
        }

        String side = (request.getSide() != null && !request.getSide().isBlank())
                ? request.getSide().trim().toUpperCase()
                : "BUY";
        String orderType = (request.getOrderType() != null && !request.getOrderType().isBlank())
                ? request.getOrderType().trim().toUpperCase()
                : "LO";

        int lotStep = TradingConstants.LOT_STEP;
        int qty = (request.getQuantity() != null && request.getQuantity() > 0) ? request.getQuantity() : lotStep;

        BigDecimal effectivePrice;
        if (request.getPrice() != null && request.getPrice().compareTo(BigDecimal.ZERO) > 0) {
            effectivePrice = request.getPrice();
        } else {
            effectivePrice = stock.getCurrentPrice() != null ? stock.getCurrentPrice() : stock.getReferencePrice();
        }

        BigDecimal grossAmount = effectivePrice.multiply(BigDecimal.valueOf(qty)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal feeRate = TradingConstants.DEFAULT_FEE_RATE;
        BigDecimal feeAmount = grossAmount.multiply(feeRate).setScale(2, RoundingMode.HALF_UP);

        BigDecimal totalAmount;
        if ("BUY".equals(side)) {
            totalAmount = grossAmount.add(feeAmount);
        } else {
            totalAmount = grossAmount.subtract(feeAmount);
            if (totalAmount.compareTo(BigDecimal.ZERO) < 0) {
                totalAmount = BigDecimal.ZERO;
            }
        }

        // Tính giá trần / sàn theo biên độ sàn giao dịch
        BigDecimal refPrice = (stock.getReferencePrice() != null && stock.getReferencePrice().compareTo(BigDecimal.ZERO) > 0)
                ? stock.getReferencePrice()
                : stock.getCurrentPrice();

        double amplitude = TradingConstants.getExchangeAmplitude(stock.getExchange());
        BigDecimal ceilingPrice = refPrice.multiply(BigDecimal.valueOf(1.0 + amplitude)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal floorPrice = refPrice.multiply(BigDecimal.valueOf(1.0 - amplitude)).setScale(2, RoundingMode.HALF_UP);

        // Thông tin User (nếu đã đăng nhập)
        BigDecimal availableCash = BigDecimal.ZERO;
        int availableHoldings = 0;
        int maxAffordableQuantity = 0;

        if (username != null && !username.isBlank()) {
            User user = userRepository.findByUsername(username).orElse(null);
            if (user != null) {
                availableCash = user.getAvailableBalance();
                Portfolio portfolio = portfolioRepository.findByUserIdAndStockId(user.getId(), stock.getId()).orElse(null);
                if (portfolio != null) {
                    availableHoldings = portfolio.getAvailableQuantity();
                }

                if ("BUY".equals(side)) {
                    if (effectivePrice.compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal costPerShareWithFee = effectivePrice.multiply(BigDecimal.ONE.add(feeRate));
                        if (costPerShareWithFee.compareTo(BigDecimal.ZERO) > 0) {
                            int rawMax = availableCash.divide(costPerShareWithFee, 0, RoundingMode.DOWN).intValue();
                            maxAffordableQuantity = (rawMax / lotStep) * lotStep;
                        }
                    }
                } else {
                    maxAffordableQuantity = (availableHoldings / lotStep) * lotStep;
                }
            }
        }

        // Quy tắc kiểm tra tính hợp lệ nghiệp vụ
        boolean valid = true;
        String validationCode = "VALID";
        String validationMessage = "Lệnh hợp lệ";

        if (qty % lotStep != 0) {
            valid = false;
            validationCode = "INVALID_LOT_STEP";
            validationMessage = "Khối lượng phải là bội số của " + lotStep + " (Lô chẵn)";
        } else if (floorPrice != null && effectivePrice.compareTo(floorPrice) < 0) {
            valid = false;
            validationCode = "PRICE_BELOW_FLOOR";
            validationMessage = "Giá đặt (" + effectivePrice.toPlainString() + " ₫) thấp hơn giá sàn (" + floorPrice.toPlainString() + " ₫)";
        } else if (ceilingPrice != null && effectivePrice.compareTo(ceilingPrice) > 0) {
            valid = false;
            validationCode = "PRICE_ABOVE_CEILING";
            validationMessage = "Giá đặt (" + effectivePrice.toPlainString() + " ₫) cao hơn giá trần (" + ceilingPrice.toPlainString() + " ₫)";
        } else if ("BUY".equals(side) && username != null && availableCash.compareTo(totalAmount) < 0) {
            valid = false;
            validationCode = "INSUFFICIENT_FUNDS";
            validationMessage = "Số dư khả dụng (" + availableCash.toPlainString() + " ₫) không đủ thanh toán " + totalAmount.toPlainString() + " ₫";
        } else if ("SELL".equals(side) && username != null && availableHoldings < qty) {
            valid = false;
            validationCode = "INSUFFICIENT_HOLDINGS";
            validationMessage = "Số lượng cổ phiếu khả dụng (" + availableHoldings + ") không đủ để bán " + qty + " CP";
        }

        OrderEstimateResponse response = OrderEstimateResponse.builder()
                .ticker(stock.getTicker())
                .companyName(stock.getCompanyName())
                .side(side)
                .orderType(orderType)
                .quantity(qty)
                .price(request.getPrice())
                .effectivePrice(effectivePrice)
                .grossAmount(grossAmount)
                .feeRate(feeRate)
                .feeAmount(feeAmount)
                .totalAmount(totalAmount)
                .availableCash(availableCash)
                .availableHoldings(availableHoldings)
                .maxAffordableQuantity(maxAffordableQuantity)
                .ceilingPrice(ceilingPrice)
                .floorPrice(floorPrice)
                .referencePrice(refPrice)
                .valid(valid)
                .validationCode(validationCode)
                .validationMessage(validationMessage)
                .build();

        return ApiResponse.success("Ước tính giá trị lệnh thành công", response);
    }
}
