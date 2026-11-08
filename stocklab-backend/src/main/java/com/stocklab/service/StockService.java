package com.stocklab.service;

import com.stocklab.presentation.dto.*;
import com.stocklab.domain.model.Stock;
import com.stocklab.domain.model.StockPriceHistory;
import com.stocklab.domain.model.TradingConstants;
import com.stocklab.infrastructure.repository.StockPriceHistoryRepository;
import com.stocklab.infrastructure.repository.StockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StockService {

    private final StockRepository stockRepository;
    private final StockPriceHistoryRepository priceHistoryRepository;

    /**
     * Lấy danh sách cổ phiếu có phân trang
     */
    public ApiResponse<Page<StockResponse>> getAllStocks(Pageable pageable) {
        Page<StockResponse> stocks = stockRepository.findAll(pageable)
                .map(this::toStockResponse);
        return ApiResponse.success("Lấy danh sách cổ phiếu thành công", stocks);
    }

    /**
     * Lấy danh sách cổ phiếu theo sàn có phân trang
     */
    public ApiResponse<Page<StockResponse>> getStocksByExchange(String exchange, Pageable pageable) {
        Page<StockResponse> stocks = stockRepository.findByExchange(exchange, pageable)
                .map(this::toStockResponse);
        return ApiResponse.success("Lấy danh sách cổ phiếu theo sàn thành công", stocks);
    }

    /**
     * Lấy chi tiết cổ phiếu theo ticker
     */
    public ApiResponse<StockResponse> getStockByTicker(String ticker) {
        Stock stock = stockRepository.findByTicker(ticker.toUpperCase())
                .orElse(null);

        if (stock == null) {
            return ApiResponse.error("Không tìm thấy cổ phiếu: " + ticker);
        }

        return ApiResponse.success("Lấy thông tin cổ phiếu thành công", toStockResponse(stock));
    }

    /**
     * Tìm kiếm cổ phiếu theo keyword (ticker hoặc tên công ty)
     */
    public ApiResponse<List<StockResponse>> searchStocks(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return ApiResponse.error("Từ khóa tìm kiếm không được để trống");
        }

        List<StockResponse> results = stockRepository.searchByKeyword(keyword.trim())
                .stream()
                .map(this::toStockResponse)
                .collect(Collectors.toList());

        return ApiResponse.success("Tìm kiếm thành công", results);
    }

    /**
     * Lấy lịch sử giá theo ticker và range
     * Range: 1W, 1M, 3M, 6M, 1Y, ALL
     */
    public ApiResponse<List<StockPriceHistoryResponse>> getPriceHistory(String ticker, String range) {
        // Kiểm tra stock tồn tại
        Stock stock = stockRepository.findByTicker(ticker.toUpperCase()).orElse(null);
        if (stock == null) {
            return ApiResponse.error("Không tìm thấy cổ phiếu: " + ticker);
        }

        List<StockPriceHistory> allHistory = priceHistoryRepository.findByStockTickerOrderByTradingDateDesc(ticker.toUpperCase());
        if (allHistory == null || allHistory.isEmpty()) {
            List<StockPriceHistoryResponse> singleList = new ArrayList<>();
            syncTodayBar(singleList, stock);
            return ApiResponse.success("Lấy lịch sử giá thành công", singleList);
        }

        if (range == null || "ALL".equalsIgnoreCase(range)) {
            List<StockPriceHistoryResponse> responses = allHistory.stream()
                    .map(this::toPriceHistoryResponse)
                    .collect(Collectors.toList());
            Collections.reverse(responses);
            syncTodayBar(responses, stock);
            return ApiResponse.success("Lấy lịch sử giá thành công", responses);
        }

        // Lấy ngày mới nhất trong DB làm mốc kết thúc (tránh lệch thời gian hệ thống)
        LocalDate latestDate = allHistory.get(0).getTradingDate();
        LocalDate startDate = calculateStartDate(latestDate, range);

        List<StockPriceHistoryResponse> history = priceHistoryRepository
                .findByStockTickerAndTradingDateBetweenOrderByTradingDateAsc(
                        ticker.toUpperCase(), startDate, latestDate)
                .stream()
                .map(this::toPriceHistoryResponse)
                .collect(Collectors.toList());

        // Fallback: nếu khoảng lọc ra rỗng, trả về toàn bộ dữ liệu theo thứ tự tăng dần
        if (history.isEmpty()) {
            List<StockPriceHistoryResponse> fallback = allHistory.stream()
                    .map(this::toPriceHistoryResponse)
                    .collect(Collectors.toList());
            Collections.reverse(fallback);
            syncTodayBar(fallback, stock);
            return ApiResponse.success("Lấy lịch sử giá thành công", fallback);
        }

        syncTodayBar(history, stock);
        return ApiResponse.success("Lấy lịch sử giá thành công", history);
    }

    private void syncTodayBar(List<StockPriceHistoryResponse> list, Stock stock) {
        if (list == null || stock == null || stock.getCurrentPrice() == null) return;
        LocalDate today = LocalDate.now();
        boolean hasToday = false;
        for (StockPriceHistoryResponse item : list) {
            if (today.equals(item.getTradingDate())) {
                hasToday = true;
                item.setClose(stock.getCurrentPrice());
                if (stock.getHighPrice() != null && (item.getHigh() == null || stock.getHighPrice().compareTo(item.getHigh()) > 0)) {
                    item.setHigh(stock.getHighPrice());
                }
                if (stock.getLowPrice() != null && (item.getLow() == null || stock.getLowPrice().compareTo(item.getLow()) < 0)) {
                    item.setLow(stock.getLowPrice());
                }
                if (stock.getVolume() != null) {
                    item.setVolume(Math.max(item.getVolume() != null ? item.getVolume() : 0L, stock.getVolume()));
                }
                break;
            }
        }
        if (!hasToday) {
            list.add(StockPriceHistoryResponse.builder()
                    .tradingDate(today)
                    .open(stock.getOpenPrice() != null ? stock.getOpenPrice() : stock.getCurrentPrice())
                    .high(stock.getHighPrice() != null ? stock.getHighPrice() : stock.getCurrentPrice())
                    .low(stock.getLowPrice() != null ? stock.getLowPrice() : stock.getCurrentPrice())
                    .close(stock.getCurrentPrice())
                    .volume(stock.getVolume() != null ? stock.getVolume() : 0L)
                    .build());
        }
    }

    // ===== Admin Thao tác (ADM-3) =====

    @Transactional
    public ApiResponse<StockResponse> createStock(CreateStockRequest request) {
        if (stockRepository.existsByTicker(request.getTicker().toUpperCase())) {
            return ApiResponse.error("Mã cổ phiếu đã tồn tại!");
        }

        Stock stock = Stock.builder()
                .ticker(request.getTicker().toUpperCase())
                .companyName(request.getCompanyName())
                .exchange(request.getExchange())
                .currentPrice(request.getBasePrice())
                .referencePrice(request.getBasePrice())
                .build();

        stockRepository.save(stock);
        return ApiResponse.success("Thêm mã cổ phiếu thành công!", toStockResponse(stock));
    }

    @Transactional
    public ApiResponse<StockResponse> updateStock(Long id, CreateStockRequest request) {
         Stock stock = stockRepository.findById(id).orElse(null);
         if (stock == null) return ApiResponse.error("Không tìm thấy cổ phiếu!");
         
         if (!stock.getTicker().equalsIgnoreCase(request.getTicker()) && 
             stockRepository.existsByTicker(request.getTicker().toUpperCase())) {
             return ApiResponse.error("Mã cổ phiếu mới đã tồn tại!");
         }
         
         stock.setTicker(request.getTicker().toUpperCase());
         stock.setCompanyName(request.getCompanyName());
         stock.setExchange(request.getExchange());
         // Tuỳ chọn update giá cơ sở (optional)
         stock.setReferencePrice(request.getBasePrice());
         
         stockRepository.save(stock);
         
         return ApiResponse.success("Cập nhật mã cổ phiếu thành công!", toStockResponse(stock));
    }

    @Transactional
    public ApiResponse<String> toggleStockStatus(Long id) {
         Stock stock = stockRepository.findById(id).orElse(null);
         if (stock == null) return ApiResponse.error("Không tìm thấy cổ phiếu!");
         
         stock.setActive(!stock.isActive());
         stockRepository.save(stock);
         String action = stock.isActive() ? "Mở khoá" : "Khoá";
         return ApiResponse.success(action + " mã cổ phiếu " + stock.getTicker() + " thành công!");
    }

    @Transactional
    public ApiResponse<String> deleteStock(Long id) {
         Stock stock = stockRepository.findById(id).orElse(null);
         if (stock == null) return ApiResponse.error("Không tìm thấy cổ phiếu!");
         try {
             stockRepository.delete(stock);
             stockRepository.flush(); // Bắt buộc lưu ngay xuống DB để tóm lỗi Foreign Key
             return ApiResponse.success("Xóa vĩnh viễn mã cổ phiếu " + stock.getTicker() + " thành công!");
         } catch (Exception e) {
             return ApiResponse.error("Không thể xóa vĩnh viễn cổ phiếu này vì đã dính líu đến các bản ghi Lịch sử giá hoặc Giao dịch!");
         }
    }

    // ===== Helper Methods =====

    private LocalDate calculateStartDate(LocalDate endDate, String range) {
        if (range == null) range = "1M";

        return switch (range.toUpperCase()) {
            case "1W" -> endDate.minusWeeks(1);
            case "1M" -> endDate.minusMonths(1);
            case "3M" -> endDate.minusMonths(3);
            case "6M" -> endDate.minusMonths(6);
            case "1Y" -> endDate.minusYears(1);
            case "ALL" -> null;
            default -> endDate.minusMonths(1);
        };
    }

    private StockResponse toStockResponse(Stock stock) {
        BigDecimal ref = stock.getReferencePrice() != null ? stock.getReferencePrice() : stock.getCurrentPrice();
        BigDecimal ceiling = TradingConstants.calculateCeilingPrice(ref, stock.getExchange());
        BigDecimal floor = TradingConstants.calculateFloorPrice(ref, stock.getExchange());

        return StockResponse.builder()
                .id(stock.getId())
                .ticker(stock.getTicker())
                .companyName(stock.getCompanyName())
                .exchange(stock.getExchange())
                .currentPrice(stock.getCurrentPrice())
                .openPrice(stock.getOpenPrice())
                .highPrice(stock.getHighPrice())
                .lowPrice(stock.getLowPrice())
                .referencePrice(stock.getReferencePrice())
                .ceilingPrice(ceiling)
                .floorPrice(floor)
                .volume(stock.getVolume())
                .change(stock.getChange())
                .changePercent(stock.getChangePercent())
                .isActive(stock.isActive())
                .build();
    }

    private StockPriceHistoryResponse toPriceHistoryResponse(StockPriceHistory history) {
        return StockPriceHistoryResponse.builder()
                .tradingDate(history.getTradingDate())
                .open(history.getOpenPrice())
                .high(history.getHighPrice())
                .low(history.getLowPrice())
                .close(history.getClosePrice())
                .volume(history.getVolume())
                .build();
    }
}
