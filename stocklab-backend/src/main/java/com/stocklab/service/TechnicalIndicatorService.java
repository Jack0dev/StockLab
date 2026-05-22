package com.stocklab.service;

import com.stocklab.dto.ApiResponse;
import com.stocklab.dto.TechnicalIndicatorsResponse;
import com.stocklab.model.StockPriceHistory;
import com.stocklab.model.Stock;
import com.stocklab.repository.StockPriceHistoryRepository;
import com.stocklab.repository.StockRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Tính toán các chỉ số kỹ thuật từ dữ liệu giá trong DB.
 * RSI, MACD, SMA, EMA, Bollinger Bands, Volume ratio.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TechnicalIndicatorService {

    private final StockPriceHistoryRepository priceHistoryRepository;
    private final StockRepository stockRepository;

    public ApiResponse<TechnicalIndicatorsResponse> getIndicators(String ticker) {
        Stock stock = stockRepository.findByTicker(ticker.toUpperCase()).orElse(null);
        if (stock == null) {
            return ApiResponse.error("Không tìm thấy cổ phiếu: " + ticker);
        }

        // Lấy 200 ngày gần nhất để tính đầy đủ SMA50 + MACD
        List<StockPriceHistory> history = priceHistoryRepository
                .findByStockTickerOrderByTradingDateDesc(ticker.toUpperCase());

        if (history.size() < 14) {
            return ApiResponse.error("Không đủ dữ liệu lịch sử để tính chỉ số kỹ thuật (cần tối thiểu 14 ngày)");
        }

        // Reverse to ascending order for calculation
        List<StockPriceHistory> asc = history.reversed();

        double[] closes = asc.stream()
                .mapToDouble(h -> h.getClosePrice().doubleValue())
                .toArray();

        long[] volumes = asc.stream()
                .mapToLong(StockPriceHistory::getVolume)
                .toArray();

        TechnicalIndicatorsResponse.TechnicalIndicatorsResponseBuilder builder =
                TechnicalIndicatorsResponse.builder()
                        .ticker(ticker.toUpperCase())
                        .currentPrice(stock.getCurrentPrice())
                        .currentVolume(stock.getVolume());

        // RSI 14
        builder.rsi14(calculateRSI(closes, 14));

        // MACD (12, 26, 9)
        double[] ema12Arr = calculateEMAArray(closes, 12);
        double[] ema26Arr = calculateEMAArray(closes, 26);
        if (ema12Arr.length > 0 && ema26Arr.length > 0) {
            double[] macdLine = new double[Math.min(ema12Arr.length, ema26Arr.length)];
            int offset = ema26Arr.length > ema12Arr.length ? 0 : 0;
            for (int i = 0; i < macdLine.length; i++) {
                int idx12 = ema12Arr.length - macdLine.length + i;
                int idx26 = ema26Arr.length - macdLine.length + i;
                macdLine[i] = ema12Arr[idx12] - ema26Arr[idx26];
            }
            double[] signalArr = calculateEMAArray(macdLine, 9);
            if (signalArr.length > 0) {
                double macd = macdLine[macdLine.length - 1];
                double signal = signalArr[signalArr.length - 1];
                builder.macdLine(round(macd, 2));
                builder.signalLine(round(signal, 2));
                builder.histogram(round(macd - signal, 2));
            }

            builder.ema12(toBigDecimal(ema12Arr[ema12Arr.length - 1]));
            builder.ema26(toBigDecimal(ema26Arr[ema26Arr.length - 1]));
        }

        // SMA 20
        if (closes.length >= 20) {
            builder.sma20(toBigDecimal(calculateSMA(closes, 20)));
        }

        // SMA 50
        if (closes.length >= 50) {
            builder.sma50(toBigDecimal(calculateSMA(closes, 50)));
        }

        // Bollinger Bands (20, 2)
        if (closes.length >= 20) {
            double sma20 = calculateSMA(closes, 20);
            double stdDev = calculateStdDev(closes, 20);
            builder.bollingerMiddle(toBigDecimal(sma20));
            builder.bollingerUpper(toBigDecimal(sma20 + 2 * stdDev));
            builder.bollingerLower(toBigDecimal(sma20 - 2 * stdDev));
        }

        // Volume average 20 days
        if (volumes.length >= 20) {
            long sum = 0;
            for (int i = volumes.length - 20; i < volumes.length; i++) {
                sum += volumes[i];
            }
            long avgVol = sum / 20;
            builder.avgVolume20(avgVol);
            if (avgVol > 0 && stock.getVolume() != null) {
                builder.volumeRatio(round((double) stock.getVolume() / avgVol, 2));
            }
        }

        // 52-week high/low
        int lookback = Math.min(closes.length, 252);
        double high52 = Double.MIN_VALUE;
        double low52 = Double.MAX_VALUE;
        for (int i = closes.length - lookback; i < closes.length; i++) {
            double h = asc.get(i).getHighPrice().doubleValue();
            double l = asc.get(i).getLowPrice().doubleValue();
            if (h > high52) high52 = h;
            if (l < low52) low52 = l;
        }
        builder.weekHigh52(toBigDecimal(high52));
        builder.weekLow52(toBigDecimal(low52));

        return ApiResponse.success("OK", builder.build());
    }

    // ===== Calculation helpers =====

    private Double calculateRSI(double[] closes, int period) {
        if (closes.length < period + 1) return null;

        double avgGain = 0, avgLoss = 0;

        // First average
        for (int i = 1; i <= period; i++) {
            double change = closes[i] - closes[i - 1];
            if (change > 0) avgGain += change;
            else avgLoss += Math.abs(change);
        }
        avgGain /= period;
        avgLoss /= period;

        // Smooth with Wilder's method
        for (int i = period + 1; i < closes.length; i++) {
            double change = closes[i] - closes[i - 1];
            double gain = change > 0 ? change : 0;
            double loss = change < 0 ? Math.abs(change) : 0;
            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
        }

        if (avgLoss == 0) return 100.0;
        double rs = avgGain / avgLoss;
        return round(100 - (100 / (1 + rs)), 2);
    }

    private double calculateSMA(double[] data, int period) {
        double sum = 0;
        for (int i = data.length - period; i < data.length; i++) {
            sum += data[i];
        }
        return sum / period;
    }

    private double[] calculateEMAArray(double[] data, int period) {
        if (data.length < period) return new double[0];

        double[] ema = new double[data.length - period + 1];
        double multiplier = 2.0 / (period + 1);

        // First EMA = SMA
        double sum = 0;
        for (int i = 0; i < period; i++) {
            sum += data[i];
        }
        ema[0] = sum / period;

        for (int i = 1; i < ema.length; i++) {
            ema[i] = (data[period - 1 + i] - ema[i - 1]) * multiplier + ema[i - 1];
        }
        return ema;
    }

    private double calculateStdDev(double[] data, int period) {
        double mean = calculateSMA(data, period);
        double sumSq = 0;
        for (int i = data.length - period; i < data.length; i++) {
            sumSq += (data[i] - mean) * (data[i] - mean);
        }
        return Math.sqrt(sumSq / period);
    }

    private double round(double value, int places) {
        return BigDecimal.valueOf(value).setScale(places, RoundingMode.HALF_UP).doubleValue();
    }

    private BigDecimal toBigDecimal(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }
}
