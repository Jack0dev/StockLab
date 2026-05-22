package com.stocklab.service.ai.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.stocklab.dto.ApiResponse;
import com.stocklab.dto.PortfolioResponse;
import com.stocklab.service.OrderService;
import com.stocklab.service.ai.AITool;
import com.stocklab.service.ai.UserContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Tool: get_portfolio
 * Retrieves user's portfolio holdings.
 * NOTE: userId is injected from auth context — Gemini NEVER controls this.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GetPortfolioTool implements AITool {

    private final OrderService orderService;
    private final ObjectMapper objectMapper;

    @Override
    public String getName() {
        return "get_portfolio";
    }

    @Override
    public String getDescription() {
        return "Lấy danh mục đầu tư hiện tại của người dùng đang chat. " +
                "Bao gồm các cổ phiếu đang nắm giữ, số lượng, giá mua trung bình, giá hiện tại, lãi/lỗ. " +
                "Sử dụng khi người dùng hỏi về danh mục, portfolio, tài sản đầu tư của họ, hoặc lãi/lỗ.";
    }

    @Override
    public JsonNode getParameterSchema() {
        // NO parameters — userId comes from auth context, not from Gemini
        ObjectNode schema = objectMapper.createObjectNode();
        schema.put("type", "OBJECT");
        schema.putObject("properties");
        return schema;
    }

    @Override
    public JsonNode execute(JsonNode args, UserContext context) {
        log.info("[Tool] get_portfolio: user={}", context.getUsername());

        ApiResponse<List<PortfolioResponse>> response = orderService.getPortfolio(context.getUsername());

        ObjectNode result = objectMapper.createObjectNode();
        if (response.isSuccess() && response.getData() != null) {
            List<PortfolioResponse> holdings = response.getData();
            ArrayNode holdingsArray = result.putArray("holdings");

            double totalValue = 0;
            double totalPnL = 0;

            for (PortfolioResponse p : holdings) {
                ObjectNode holding = holdingsArray.addObject();
                holding.put("ticker", p.getTicker());
                holding.put("companyName", p.getCompanyName());
                holding.put("quantity", p.getQuantity());
                holding.put("avgBuyPrice", p.getAvgBuyPrice() != null ? p.getAvgBuyPrice().doubleValue() : 0);
                holding.put("currentPrice", p.getCurrentPrice() != null ? p.getCurrentPrice().doubleValue() : 0);
                holding.put("totalValue", p.getTotalValue() != null ? p.getTotalValue().doubleValue() : 0);
                holding.put("profitLoss", p.getProfitLoss() != null ? p.getProfitLoss().doubleValue() : 0);
                holding.put("profitLossPercent", p.getProfitLossPercent());

                totalValue += p.getTotalValue() != null ? p.getTotalValue().doubleValue() : 0;
                totalPnL += p.getProfitLoss() != null ? p.getProfitLoss().doubleValue() : 0;
            }

            result.put("totalHoldings", holdings.size());
            result.put("totalPortfolioValue", totalValue);
            result.put("totalProfitLoss", totalPnL);
        } else {
            result.put("error", "Không thể lấy danh mục đầu tư");
            result.putArray("holdings");
            result.put("totalHoldings", 0);
        }

        return result;
    }

    @Override
    public int getTimeoutSeconds() {
        return 1;
    }

    @Override
    public int getCacheTtlSeconds() {
        return 0; // No cache — portfolio is user-specific and real-time
    }
}
