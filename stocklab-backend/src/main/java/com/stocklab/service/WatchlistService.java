package com.stocklab.service;

import com.stocklab.presentation.dto.ApiResponse;
import com.stocklab.presentation.dto.WatchlistResponse;
import com.stocklab.domain.model.Stock;
import com.stocklab.domain.model.User;
import com.stocklab.domain.model.Watchlist;
import com.stocklab.infrastructure.repository.StockRepository;
import com.stocklab.infrastructure.repository.UserRepository;
import com.stocklab.infrastructure.repository.WatchlistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WatchlistService {

    private final WatchlistRepository watchlistRepository;
    private final UserRepository userRepository;
    private final StockRepository stockRepository;

    /**
     * Thêm CP vào watchlist
     */
    @Transactional
    public ApiResponse<WatchlistResponse> addStock(String username, String ticker) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return ApiResponse.error("Không tìm thấy người dùng");

        Stock stock = stockRepository.findByTicker(ticker.toUpperCase()).orElse(null);
        if (stock == null) return ApiResponse.error("Không tìm thấy cổ phiếu: " + ticker);

        if (watchlistRepository.existsByUserIdAndStockTicker(user.getId(), ticker.toUpperCase())) {
            return ApiResponse.error("Cổ phiếu " + ticker.toUpperCase() + " đã có trong danh sách theo dõi");
        }

        Watchlist watchlist = Watchlist.builder()
                .user(user)
                .stock(stock)
                .build();
        watchlistRepository.save(watchlist);

        return ApiResponse.success("Đã thêm " + stock.getTicker() + " vào danh sách theo dõi",
                toWatchlistResponse(watchlist));
    }

    /**
     * Xóa CP khỏi watchlist
     */
    @Transactional
    public ApiResponse<String> removeStock(String username, String ticker) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return ApiResponse.error("Không tìm thấy người dùng");

        Stock stock = stockRepository.findByTicker(ticker.toUpperCase()).orElse(null);
        if (stock == null) return ApiResponse.error("Không tìm thấy cổ phiếu: " + ticker);

        Watchlist watchlist = watchlistRepository.findByUserIdAndStockId(user.getId(), stock.getId())
                .orElse(null);
        if (watchlist == null) {
            return ApiResponse.error("Cổ phiếu " + ticker.toUpperCase() + " không có trong danh sách theo dõi");
        }

        watchlistRepository.delete(watchlist);
        return ApiResponse.success("Đã xóa " + stock.getTicker() + " khỏi danh sách theo dõi", null);
    }

    /**
     * Danh sách CP đang theo dõi
     */
    public ApiResponse<List<WatchlistResponse>> getWatchlist(String username) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return ApiResponse.error("Không tìm thấy người dùng");

        List<WatchlistResponse> list = watchlistRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::toWatchlistResponse)
                .collect(Collectors.toList());

        return ApiResponse.success("Lấy danh sách theo dõi thành công", list);
    }

    /**
     * Kiểm tra CP có trong watchlist không
     */
    public ApiResponse<Boolean> isWatched(String username, String ticker) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return ApiResponse.error("Không tìm thấy người dùng");

        boolean watched = watchlistRepository.existsByUserIdAndStockTicker(user.getId(), ticker.toUpperCase());
        return ApiResponse.success("OK", watched);
    }

    private WatchlistResponse toWatchlistResponse(Watchlist w) {
        Stock stock = w.getStock();
        return WatchlistResponse.builder()
                .id(w.getId())
                .ticker(stock.getTicker())
                .companyName(stock.getCompanyName())
                .exchange(stock.getExchange())
                .currentPrice(stock.getCurrentPrice())
                .change(stock.getChange())
                .changePercent(stock.getChangePercent())
                .addedAt(w.getCreatedAt())
                .build();
    }
}
