# Model Evaluation Report - v1

**Generated:** 2026-05-12 01:19
**Algorithm:** XGBoost (multi:softprob, 3-class)

## ML Metrics

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| BUY | 0.415 | 0.579 | 0.484 | 444 |
| HOLD | 0.295 | 0.186 | 0.228 | 220 |
| SELL | 0.440 | 0.353 | 0.392 | 476 |

**F1 Macro: 0.3679**

## Trading Metrics (Backtest)

| Metric | Value |
|---|---|
| N Trades | 1001 |
| Win Rate | 50.25% |
| Avg Return Per Trade | -0.35% |
| Avg Win | 0.040538 |
| Avg Loss | -0.047953 |
| Profit Factor | 0.8539 |
| Sharpe Ratio | -0.4045 |
| Max Drawdown | -571.33% |
| Benchmark Avg Return | -0.09% |
| Benchmark Sharpe | -0.1043 |

## Top Features

| Feature | Importance |
|---|---|
| bb_upper | 0.0717 |
| sma_20 | 0.0710 |
| ema_26 | 0.0701 |
| bb_lower | 0.0689 |
| volatility_20d | 0.0681 |
| sma_50 | 0.0668 |
| macd | 0.0660 |
| atr_14 | 0.0659 |
| ema_12 | 0.0641 |
| macd_signal | 0.0637 |

## Decision

> **DO NOT DEPLOY** - F1=0.3679 below threshold