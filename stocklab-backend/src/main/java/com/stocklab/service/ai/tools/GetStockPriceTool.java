package com.stocklab.service.ai.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.stocklab.dto.ApiResponse;
import com.stocklab.dto.StockResponse;
import com.stocklab.service.StockService;
import com.stocklab.service.ai.AITool;
import com.stocklab.service.ai.UserContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Tool: get_stock_price
 * Retrieves current price and market data for a specific stock ticker.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GetStockPriceTool implements AITool {

    private final StockService stockService;
    private final ObjectMapper objectMapper;

    @Override
    public String getName() {
        return "get_stock_price";
    }

    @Override
    public String getDescription() {
        return "Lấy giá hiện tại và thông tin thị trường của một mã cổ phiếu. " +
               "Bao gồm giá mở cửa, cao nhất, thấp nhất, tham chiếu, khối lượng, và % thay đổi. " +
               "Sử dụng khi người dùng hỏi về giá cổ phiếu, biến động giá trong ngày.";
    }

    @Override
    public JsonNode getParameterSchema() {
        ObjectNode schema = objectMapper.createObjectNode();
        schema.put("type", "OBJECT");

        ObjectNode properties = schema.putObject("properties");
        ObjectNode ticker = properties.putObject("ticker");
        ticker.put("type", "STRING");
        ticker.put("description", "Mã cổ phiếu Việt Nam, ví dụ: VCB, FPT, VNM, HPG, MWG");

        schema.putArray("required").add("ticker");
        return schema;
    }

    @Override
    public JsonNode execute(JsonNode args, UserContext context) {
        String ticker = args.get("ticker").asText().toUpperCase().trim();
        log.info("[Tool] get_stock_price: ticker={}, user={}", ticker, context.getUsername());

        ApiResponse<StockResponse> response = stockService.getStockByTicker(ticker);

        ObjectNode result = objectMapper.createObjectNode();
        if (response.isSuccess() && response.getData() != null) {
            StockResponse stock = response.getData();
            result.put("ticker", stock.getTicker());
            result.put("companyName", stock.getCompanyName());
            result.put("exchange", stock.getExchange());
            result.put("currentPrice", stock.getCurrentPrice() != null ? stock.getCurrentPrice().doubleValue() : 0);
            result.put("openPrice", stock.getOpenPrice() != null ? stock.getOpenPrice().doubleValue() : 0);
            result.put("highPrice", stock.getHighPrice() != null ? stock.getHighPrice().doubleValue() : 0);
            result.put("lowPrice", stock.getLowPrice() != null ? stock.getLowPrice().doubleValue() : 0);
            result.put("referencePrice", stock.getReferencePrice() != null ? stock.getReferencePrice().doubleValue() : 0);
            result.put("volume", stock.getVolume() != null ? stock.getVolume() : 0);
            result.put("change", stock.getChange() != null ? stock.getChange().doubleValue() : 0);
            result.put("changePercent", stock.getChangePercent() != null ? stock.getChangePercent().doubleValue() : 0);
        } else {
            result.put("error", "Không tìm thấy cổ phiếu: " + ticker);
        }

        return result;
    }

    @Override
    public int getTimeoutSeconds() {
        return 5;
    }

    @Override
    public int getCacheTtlSeconds() {
        return 30;
    }
}
