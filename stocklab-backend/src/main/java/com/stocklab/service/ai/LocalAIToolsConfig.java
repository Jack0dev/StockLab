package com.stocklab.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Description;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Declares AITools as standard java.util.function.Function Beans
 * so Spring AI (Ollama) can discover and call them natively.
 */
@Configuration
@Slf4j
public class LocalAIToolsConfig {

    private final ToolExecutor toolExecutor;
    private final ObjectMapper objectMapper;

    public LocalAIToolsConfig(ToolExecutor toolExecutor) {
        this.toolExecutor = toolExecutor;
        this.objectMapper = new ObjectMapper();
    }

    private void sendToolStartEvent(String toolName) {
        LocalAIContextHolder.LocalAIContext ctx = LocalAIContextHolder.getContext();
        if (ctx != null && ctx.getEmitter() != null) {
            try {
                synchronized (ctx.getEmitter()) {
                    ctx.getEmitter().send(SseEmitter.event().name("tool_start").data(Map.of("tool", toolName)));
                }
            } catch (Exception e) {
                log.warn("Failed to send tool_start event for {}", toolName);
            }
        }
    }

    private void sendSourceEvent(String source) {
        LocalAIContextHolder.LocalAIContext ctx = LocalAIContextHolder.getContext();
        if (ctx != null && ctx.getEmitter() != null && source != null) {
            try {
                synchronized (ctx.getEmitter()) {
                    ctx.getEmitter().send(SseEmitter.event().name("source").data(Map.of("sources", List.of(source))));
                }
            } catch (Exception e) {
                log.warn("Failed to send source event for {}", source);
            }
        }
    }

    public record GetStockPriceRequest(String ticker) {}

    @Bean
    @Description("Lấy giá hiện tại và thông tin thị trường của một mã cổ phiếu. Bao gồm giá mở cửa, cao nhất, thấp nhất, tham chiếu, khối lượng, và % thay đổi. Cần cung cấp mã cổ phiếu, ví dụ: VCB, FPT, VNM.")
    public Function<GetStockPriceRequest, String> getStockPrice() {
        return request -> {
            sendToolStartEvent("get_stock_price");
            ObjectNode args = objectMapper.createObjectNode();
            args.put("ticker", request.ticker());
            
            UserContext userContext = LocalAIContextHolder.getContext() != null ? LocalAIContextHolder.getContext().getUserContext() : null;
            ToolCallResult result = toolExecutor.execute("get_stock_price", args, userContext);
            sendSourceEvent(result.getSource());
            
            try {
                return objectMapper.writeValueAsString(result.getResult());
            } catch (Exception e) {
                return "{\"error\": \"Lỗi parse kết quả\"}";
            }
        };
    }

    public record GetStockSignalRequest(String ticker) {}

    @Bean
    @Description("Lấy tín hiệu dự đoán AI (Machine Learning) cho một mã cổ phiếu. Trả về tín hiệu BUY/SELL/HOLD, độ tin cậy và lý do dự đoán. Cần cung cấp mã cổ phiếu, ví dụ: VCB, FPT.")
    public Function<GetStockSignalRequest, String> getStockSignal() {
        return request -> {
            sendToolStartEvent("get_stock_signal");
            ObjectNode args = objectMapper.createObjectNode();
            args.put("ticker", request.ticker());

            UserContext userContext = LocalAIContextHolder.getContext() != null ? LocalAIContextHolder.getContext().getUserContext() : null;
            ToolCallResult result = toolExecutor.execute("get_stock_signal", args, userContext);
            sendSourceEvent(result.getSource());

            try {
                return objectMapper.writeValueAsString(result.getResult());
            } catch (Exception e) {
                return "{\"error\": \"Lỗi parse kết quả\"}";
            }
        };
    }

    public record GetPortfolioRequest() {}

    @Bean
    @Description("Lấy danh mục đầu tư (portfolio) hiện tại của người dùng. Bao gồm số lượng cổ phiếu đang nắm giữ, giá mua trung bình, giá hiện tại, lợi nhuận (lãi/lỗ). Không cần tham số đầu vào.")
    public Function<GetPortfolioRequest, String> getPortfolio() {
        return request -> {
            sendToolStartEvent("get_portfolio");
            ObjectNode args = objectMapper.createObjectNode();

            UserContext userContext = LocalAIContextHolder.getContext() != null ? LocalAIContextHolder.getContext().getUserContext() : null;
            ToolCallResult result = toolExecutor.execute("get_portfolio", args, userContext);
            sendSourceEvent(result.getSource());

            try {
                return objectMapper.writeValueAsString(result.getResult());
            } catch (Exception e) {
                return "{\"error\": \"Lỗi parse kết quả\"}";
            }
        };
    }

    public record GetFinancialNewsRequest(String ticker) {}

    @Bean
    @Description("Lấy danh sách tin tức tài chính mới nhất cho một mã cổ phiếu cụ thể từ các trang báo tài chính. Cần cung cấp mã cổ phiếu.")
    public Function<GetFinancialNewsRequest, String> getFinancialNews() {
        return request -> {
            sendToolStartEvent("get_financial_news");
            ObjectNode args = objectMapper.createObjectNode();
            args.put("ticker", request.ticker());

            UserContext userContext = LocalAIContextHolder.getContext() != null ? LocalAIContextHolder.getContext().getUserContext() : null;
            ToolCallResult result = toolExecutor.execute("get_financial_news", args, userContext);
            sendSourceEvent(result.getSource());

            try {
                return objectMapper.writeValueAsString(result.getResult());
            } catch (Exception e) {
                return "{\"error\": \"Lỗi parse kết quả\"}";
            }
        };
    }

    public record GetMarketOverviewRequest() {}

    @Bean
    @Description("Lấy tổng quan thị trường hôm nay, top 20 cổ phiếu hoạt động tốt nhất cùng với tín hiệu AI của chúng. Không cần tham số đầu vào.")
    public Function<GetMarketOverviewRequest, String> getMarketOverview() {
        return request -> {
            sendToolStartEvent("get_market_overview");
            ObjectNode args = objectMapper.createObjectNode();

            UserContext userContext = LocalAIContextHolder.getContext() != null ? LocalAIContextHolder.getContext().getUserContext() : null;
            ToolCallResult result = toolExecutor.execute("get_market_overview", args, userContext);
            sendSourceEvent(result.getSource());

            try {
                return objectMapper.writeValueAsString(result.getResult());
            } catch (Exception e) {
                return "{\"error\": \"Lỗi parse kết quả\"}";
            }
        };
    }
}
