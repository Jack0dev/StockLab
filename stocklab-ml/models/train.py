#!/usr/bin/env python3
"""
StockLab ML -- Model Training Pipeline
[P2-01] Build training dataset with 3-class labels (BUY/SELL/HOLD)
[P2-02] Time-based train/test split
[P2-03] Train XGBoost classifier
[P2-04] Evaluate with ML metrics + Trading metrics
[P2-04b] Backtest baseline strategy
[P2-05] Save model artifact
[P2-06] Generate evaluation report

Usage:
    cd stocklab-ml
    set PYTHONIOENCODING=utf-8
    .venv\\Scripts\\python.exe models/train.py
"""
import sys
import os
import json
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.preprocessing import StandardScaler
import xgboost as xgb
import joblib

# --- Config ---
LARAGON_DB_URL = "mysql+pymysql://root:@localhost:3306/stock_lap?charset=utf8mb4"
MODEL_VERSION = "v1"
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)))

# Label thresholds
BUY_THRESHOLD = 0.01   # returns_5d > +1%
SELL_THRESHOLD = -0.01  # returns_5d < -1%

# Train/Test split: last 3 months = test
TEST_MONTHS = 3

# Feature columns (same as ml_features table)
FEATURE_COLS = [
    "sma_10", "sma_20", "sma_50", "ema_12", "ema_26",
    "rsi_14", "macd", "macd_signal", "bb_upper", "bb_lower",
    "atr_14", "returns_1d", "returns_5d", "volatility_20d",
    "volume_change_1d", "momentum_10"
]

LABEL_MAP = {0: "BUY", 1: "HOLD", 2: "SELL"}
LABEL_MAP_INV = {"BUY": 0, "HOLD": 1, "SELL": 2}


# ============================================
# [P2-01] Build Training Dataset
# ============================================
def build_dataset(engine):
    """Load features + build 3-class labels from future 5d returns."""
    print("[P2-01] Building dataset...")

    query = text("""
        SELECT mf.stock_id, mf.trading_date,
               mf.sma_10, mf.sma_20, mf.sma_50, mf.ema_12, mf.ema_26,
               mf.rsi_14, mf.macd, mf.macd_signal, mf.bb_upper, mf.bb_lower,
               mf.atr_14, mf.returns_1d, mf.returns_5d, mf.volatility_20d,
               mf.volume_change_1d, mf.momentum_10,
               s.ticker
        FROM ml_features mf
        JOIN stocks s ON s.id = mf.stock_id
        ORDER BY mf.stock_id, mf.trading_date
    """)

    with engine.connect() as conn:
        df = pd.read_sql(query, conn)

    print(f"  Loaded {len(df):,} feature rows for {df['ticker'].nunique()} stocks")

    # Build labels: look-ahead 5-day returns
    # For each stock, shift close prices to get future return
    labels = []
    for stock_id, group in df.groupby("stock_id"):
        group = group.sort_values("trading_date")
        # Future 5d return = returns_5d shifted back by 5 rows
        # Actually, we need to compute from price data
        # returns_5d at time t already = (close_t - close_{t-5}) / close_{t-5}
        # We need FUTURE return = (close_{t+5} - close_t) / close_t
        # = returns_5d shifted by -5
        future_5d = group["returns_5d"].shift(-5)
        labels.append(future_5d)

    df["future_return_5d"] = pd.concat(labels).values

    # Drop rows without future returns (last 5 days per stock)
    df = df.dropna(subset=["future_return_5d"])

    # Create 3-class label
    df["label"] = 1  # HOLD
    df.loc[df["future_return_5d"] > BUY_THRESHOLD, "label"] = 0   # BUY
    df.loc[df["future_return_5d"] < SELL_THRESHOLD, "label"] = 2   # SELL

    # Class distribution
    class_counts = df["label"].value_counts().sort_index()
    total = len(df)
    print(f"  Dataset size: {total:,} rows")
    print(f"  Label distribution:")
    for label_id, count in class_counts.items():
        pct = count / total * 100
        print(f"    {LABEL_MAP[label_id]:>4}: {count:>5} ({pct:.1f}%)")

    return df


def normalize_features(train_df, test_df, feature_cols):
    """Normalize features using StandardScaler fit on train only."""
    scaler = StandardScaler()
    train_df[feature_cols] = scaler.fit_transform(train_df[feature_cols])
    test_df[feature_cols] = scaler.transform(test_df[feature_cols])
    return train_df, test_df, scaler


# ============================================
# [P2-02] Time-Based Train/Test Split
# ============================================
def time_split(df, test_months=3):
    """Split by date: last N months = test."""
    print(f"\n[P2-02] Time-based split (last {test_months} months = test)...")

    max_date = df["trading_date"].max()
    split_date = max_date - timedelta(days=test_months * 30)

    train = df[df["trading_date"] < split_date].copy()
    test = df[df["trading_date"] >= split_date].copy()

    print(f"  Split date: {split_date}")
    print(f"  Train: {len(train):,} rows ({train['trading_date'].min()} -> {train['trading_date'].max()})")
    print(f"  Test:  {len(test):,} rows ({test['trading_date'].min()} -> {test['trading_date'].max()})")

    return train, test


# ============================================
# [P2-03] Train XGBoost
# ============================================
def train_model(train_df):
    """Train XGBoost 3-class classifier."""
    print("\n[P2-03] Training XGBoost...")

    X_train = train_df[FEATURE_COLS].values
    y_train = train_df["label"].values

    # Handle class imbalance with sample weights
    class_counts = np.bincount(y_train, minlength=3)
    total = len(y_train)
    class_weights = total / (3 * class_counts + 1)
    sample_weights = np.array([class_weights[y] for y in y_train])

    model = xgb.XGBClassifier(
        objective="multi:softprob",
        num_class=3,
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
        gamma=0.1,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        use_label_encoder=False,
        eval_metric="mlogloss",
        verbosity=0,
    )

    model.fit(X_train, y_train, sample_weight=sample_weights,
              eval_set=[(X_train, y_train)], verbose=False)
    print(f"  Model trained: {model.n_estimators} trees, depth={model.max_depth}")

    # Feature importance
    importances = model.feature_importances_
    feat_imp = sorted(zip(FEATURE_COLS, importances), key=lambda x: x[1], reverse=True)
    print("  Top 5 features:")
    for name, imp in feat_imp[:5]:
        print(f"    {name:<20} {imp:.4f}")

    return model, feat_imp


# ============================================
# [P2-04] Evaluate Model
# ============================================
def evaluate_model(model, test_df):
    """Evaluate with ML metrics + trading metrics."""
    print("\n[P2-04] Evaluating model...")

    X_test = test_df[FEATURE_COLS].values
    y_test = test_df["label"].values
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)

    # --- ML Metrics ---
    print("\n  === ML Metrics ===")
    report = classification_report(
        y_test, y_pred,
        target_names=["BUY", "HOLD", "SELL"],
        output_dict=True
    )
    report_str = classification_report(
        y_test, y_pred,
        target_names=["BUY", "HOLD", "SELL"]
    )
    print(report_str)

    f1_macro = f1_score(y_test, y_pred, average="macro")
    print(f"  F1 Macro: {f1_macro:.4f}")

    cm = confusion_matrix(y_test, y_pred)
    print(f"\n  Confusion Matrix:")
    print(f"  {'':>8} Pred_BUY  Pred_HOLD  Pred_SELL")
    for i, row_name in enumerate(["BUY", "HOLD", "SELL"]):
        print(f"  {row_name:>8} {cm[i][0]:>8}  {cm[i][1]:>9}  {cm[i][2]:>9}")

    return report, f1_macro, y_pred, y_prob


# ============================================
# [P2-04b] Backtest Baseline Strategy
# ============================================
def backtest(test_df, y_pred):
    """
    Backtest strategy:
    - BUY signal -> hold 5 days -> collect future_return_5d
    - SELL signal -> short simulation (invert return)
    - HOLD -> no trade
    """
    print("\n[P2-04b] Backtesting baseline strategy...")

    test = test_df.copy()
    test["predicted"] = y_pred

    # Filter only BUY and SELL signals
    trades = test[test["predicted"] != 1].copy()  # Not HOLD
    trades["trade_return"] = trades["future_return_5d"]
    # For SELL signals, invert return (short simulation)
    trades.loc[trades["predicted"] == 2, "trade_return"] = -trades.loc[trades["predicted"] == 2, "future_return_5d"]

    if len(trades) == 0:
        print("  No trades generated!")
        return {}

    # --- Trading Metrics ---
    returns = trades["trade_return"]

    # Metrics: use average per-trade return (not compound, since trades overlap)
    total_return_avg = returns.mean()  # average per-trade return
    n_trades = len(trades)
    win_trades = (returns > 0).sum()
    win_rate = win_trades / n_trades
    avg_win = returns[returns > 0].mean() if win_trades > 0 else 0
    avg_loss = returns[returns <= 0].mean() if (returns <= 0).sum() > 0 else 0
    profit_factor = abs(avg_win * win_trades / (avg_loss * (n_trades - win_trades))) if avg_loss != 0 and (n_trades - win_trades) > 0 else float('inf')

    # Sharpe Ratio (annualized, ~50 trade periods per year with 5d holding)
    sharpe = returns.mean() / (returns.std() + 1e-10) * np.sqrt(252 / 5)

    # Max Drawdown (on cumulative sum, not product, to avoid compound artifacts)
    cum_pnl = returns.cumsum()
    peak = cum_pnl.cummax()
    drawdown = cum_pnl - peak
    max_drawdown = drawdown.min()

    # Benchmark: average per-trade return if we buy everything
    bench_returns = test["future_return_5d"]
    bench_avg = bench_returns.mean()
    bench_sharpe = bench_returns.mean() / (bench_returns.std() + 1e-10) * np.sqrt(252 / 5)

    print(f"\n  === Trading Metrics ===")
    print(f"  Total trades:      {n_trades}")
    print(f"  Win rate:          {win_rate:.1%}")
    print(f"  Avg return/trade:  {total_return_avg:.4f} ({total_return_avg:.2%})")
    print(f"  Avg win:           {avg_win:.4f}")
    print(f"  Avg loss:          {avg_loss:.4f}")
    print(f"  Profit factor:     {profit_factor:.2f}")
    print(f"  Sharpe ratio:      {sharpe:.2f}")
    print(f"  Max drawdown:      {max_drawdown:.4f}")
    print(f"\n  === Benchmark (Buy-All) ===")
    print(f"  Benchmark avg/trade: {bench_avg:.4f} ({bench_avg:.2%})")
    print(f"  Benchmark Sharpe:    {bench_sharpe:.2f}")
    print(f"\n  Strategy vs Benchmark: {'OUTPERFORM' if total_return_avg > bench_avg else 'UNDERPERFORM'}")

    metrics = {
        "n_trades": n_trades,
        "win_rate": round(win_rate, 4),
        "avg_return_per_trade": round(total_return_avg, 6),
        "avg_win": round(avg_win, 6),
        "avg_loss": round(avg_loss, 6),
        "profit_factor": round(min(profit_factor, 999), 4),
        "sharpe_ratio": round(sharpe, 4),
        "max_drawdown": round(max_drawdown, 6),
        "benchmark_avg_return": round(bench_avg, 6),
        "benchmark_sharpe": round(bench_sharpe, 4),
    }

    return metrics


# ============================================
# [P2-05] Save Model Artifact
# ============================================
def save_model(model, feat_imp, ml_report, backtest_metrics):
    """Save model + metadata."""
    print(f"\n[P2-05] Saving model artifacts...")

    # Save model
    model_path = os.path.join(MODEL_DIR, f"xgboost_{MODEL_VERSION}.json")
    model.save_model(model_path)
    print(f"  Model: {model_path}")

    # Save model with joblib too (for sklearn compatibility)
    joblib_path = os.path.join(MODEL_DIR, f"xgboost_{MODEL_VERSION}.pkl")
    joblib.dump(model, joblib_path)
    print(f"  Joblib: {joblib_path}")

    # Save metadata
    metadata = {
        "version": MODEL_VERSION,
        "trained_at": datetime.now().isoformat(),
        "algorithm": "XGBoost",
        "objective": "multi:softprob",
        "n_classes": 3,
        "classes": ["BUY", "HOLD", "SELL"],
        "features": FEATURE_COLS,
        "feature_importances": {name: round(float(imp), 6) for name, imp in feat_imp},
        "thresholds": {
            "buy": BUY_THRESHOLD,
            "sell": SELL_THRESHOLD,
        },
        "hyperparameters": {
            "n_estimators": model.n_estimators,
            "max_depth": model.max_depth,
            "learning_rate": model.learning_rate,
        },
        "ml_metrics": {
            k: v for k, v in ml_report.items()
            if k in ["BUY", "HOLD", "SELL", "macro avg", "weighted avg", "accuracy"]
        },
        "backtest_metrics": backtest_metrics,
    }

    meta_path = os.path.join(MODEL_DIR, f"metadata_{MODEL_VERSION}.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2, default=str)
    print(f"  Metadata: {meta_path}")

    return model_path, meta_path


# ============================================
# [P2-06] Generate Evaluation Report
# ============================================
def generate_report(ml_report, f1_macro, backtest_metrics, feat_imp):
    """Write evaluation report markdown."""
    report_path = os.path.join(MODEL_DIR, f"evaluation_{MODEL_VERSION}.md")

    lines = [
        f"# Model Evaluation Report - {MODEL_VERSION}",
        f"",
        f"**Generated:** {datetime.now():%Y-%m-%d %H:%M}",
        f"**Algorithm:** XGBoost (multi:softprob, 3-class)",
        f"",
        f"## ML Metrics",
        f"",
        f"| Class | Precision | Recall | F1 | Support |",
        f"|---|---|---|---|---|",
    ]

    for cls in ["BUY", "HOLD", "SELL"]:
        m = ml_report[cls]
        lines.append(f"| {cls} | {m['precision']:.3f} | {m['recall']:.3f} | {m['f1-score']:.3f} | {int(m['support'])} |")

    lines.extend([
        f"",
        f"**F1 Macro: {f1_macro:.4f}**",
        f"",
        f"## Trading Metrics (Backtest)",
        f"",
        f"| Metric | Value |",
        f"|---|---|",
    ])

    if backtest_metrics:
        for k, v in backtest_metrics.items():
            display_k = k.replace("_", " ").title()
            if "rate" in k or "return" in k or "drawdown" in k:
                lines.append(f"| {display_k} | {v:.2%} |")
            else:
                lines.append(f"| {display_k} | {v} |")

    lines.extend([
        f"",
        f"## Top Features",
        f"",
        f"| Feature | Importance |",
        f"|---|---|",
    ])
    for name, imp in feat_imp[:10]:
        lines.append(f"| {name} | {imp:.4f} |")

    lines.extend([
        f"",
        f"## Decision",
        f"",
    ])

    if f1_macro >= 0.45 and backtest_metrics.get("sharpe_ratio", 0) > 0:
        lines.append(f"> **DEPLOY** - F1={f1_macro:.4f} >= 0.45, Sharpe={backtest_metrics['sharpe_ratio']:.2f} > 0")
    elif f1_macro >= 0.40:
        lines.append(f"> **CAUTIOUS DEPLOY** - F1={f1_macro:.4f} marginal, monitor closely")
    else:
        lines.append(f"> **DO NOT DEPLOY** - F1={f1_macro:.4f} below threshold")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\n[P2-06] Report: {report_path}")
    return report_path


# ============================================
# Main Pipeline
# ============================================
def main():
    print("=" * 60)
    print("StockLab ML -- Training Pipeline")
    print(f"Model version: {MODEL_VERSION}")
    print("=" * 60)

    engine = create_engine(LARAGON_DB_URL)

    # [P2-01] Build dataset
    df = build_dataset(engine)

    # [P2-02] Split
    train_df, test_df = time_split(df, TEST_MONTHS)

    # Normalize features (fit on train, transform both)
    train_df, test_df, scaler = normalize_features(train_df, test_df, FEATURE_COLS)
    print(f"  Features normalized with StandardScaler")

    # [P2-03] Train
    model, feat_imp = train_model(train_df)

    # [P2-04] Evaluate
    ml_report, f1_macro, y_pred, y_prob = evaluate_model(model, test_df)

    # [P2-04b] Backtest
    bt_metrics = backtest(test_df, y_pred)

    # [P2-05] Save
    model_path, meta_path = save_model(model, feat_imp, ml_report, bt_metrics)

    # [P2-06] Report
    report_path = generate_report(ml_report, f1_macro, bt_metrics, feat_imp)

    # Final summary
    print()
    print("=" * 60)
    print("TRAINING COMPLETE")
    print("=" * 60)
    print(f"  F1 Macro:     {f1_macro:.4f} {'PASS' if f1_macro >= 0.45 else 'BELOW TARGET'}")
    print(f"  Sharpe Ratio: {bt_metrics.get('sharpe_ratio', 'N/A')}")
    print(f"  Model:        {model_path}")
    print(f"  Report:       {report_path}")

    if f1_macro >= 0.40 and bt_metrics.get("sharpe_ratio", 0) > 0:
        print("\n[PASS] Model ready for deployment!")
    else:
        print("\n[WARN] Model needs improvement before deployment.")


if __name__ == "__main__":
    main()
