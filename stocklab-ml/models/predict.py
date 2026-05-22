#!/usr/bin/env python3
"""
StockLab ML -- Prediction Module
Load model and generate predictions for stocks.
"""
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import xgboost as xgb
import joblib
import redis

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
from config.settings import settings

REDIS_HOST = settings.REDIS_HOST
REDIS_PORT = settings.REDIS_PORT
FEATURE_VERSION = "v1"

LABEL_MAP = {0: "BUY", 1: "HOLD", 2: "SELL"}
FEATURE_COLS = [
    "sma_10", "sma_20", "sma_50", "ema_12", "ema_26",
    "rsi_14", "macd", "macd_signal", "bb_upper", "bb_lower",
    "atr_14", "returns_1d", "returns_5d", "volatility_20d",
    "volume_change_1d", "momentum_10"
]


class Predictor:
    """Loads model and generates predictions from Redis features."""

    def __init__(self, model_version="v1"):
        self.version = model_version
        self.model = None
        self.metadata = None
        self.redis = None
        self._load_model()
        self._connect_redis()

    def _load_model(self):
        model_path = os.path.join(MODEL_DIR, f"xgboost_{self.version}.json")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found: {model_path}")

        self.model = xgb.XGBClassifier()
        self.model.load_model(model_path)

        meta_path = os.path.join(MODEL_DIR, f"metadata_{self.version}.json")
        if os.path.exists(meta_path):
            with open(meta_path, "r") as f:
                self.metadata = json.load(f)

    def _connect_redis(self):
        self.redis = redis.Redis(
            host=REDIS_HOST, port=REDIS_PORT,
            decode_responses=True, socket_connect_timeout=5
        )

    def predict_symbol(self, symbol):
        """Predict signal for a single stock symbol."""
        key = f"features:{FEATURE_VERSION}:{symbol}"
        cached = self.redis.get(key)

        if cached is None:
            return {
                "symbol": symbol,
                "error": f"No features found for {symbol}",
                "signal": None,
            }

        data = json.loads(cached)

        # Build feature vector
        features = []
        for col in FEATURE_COLS:
            val = data.get(col)
            features.append(float(val) if val is not None else 0.0)

        X = np.array([features])
        proba = self.model.predict_proba(X)[0]
        pred_class = int(np.argmax(proba))

        # Top 3 reasons (feature contributions)
        reasons = self._get_reasons(data)

        return {
            "symbol": symbol,
            "stock_id": data.get("stock_id"),
            "signal": LABEL_MAP[pred_class],
            "confidence": round(float(proba[pred_class]), 4),
            "probabilities": {
                "BUY": round(float(proba[0]), 4),
                "HOLD": round(float(proba[1]), 4),
                "SELL": round(float(proba[2]), 4),
            },
            "trading_date": data.get("trading_date"),
            "model_version": self.version,
            "reasons": reasons,
        }

    def _get_reasons(self, data):
        """Generate human-readable reasons based on key indicators."""
        reasons = []
        rsi = data.get("rsi_14", 50)
        macd = data.get("macd", 0)
        macd_signal = data.get("macd_signal", 0)
        returns_1d = data.get("returns_1d", 0)
        volatility = data.get("volatility_20d", 0)

        if rsi < 30:
            reasons.append(f"RSI={rsi:.1f} (oversold)")
        elif rsi > 70:
            reasons.append(f"RSI={rsi:.1f} (overbought)")
        else:
            reasons.append(f"RSI={rsi:.1f} (neutral)")

        if macd > macd_signal:
            reasons.append(f"MACD bullish crossover ({macd:.4f} > signal {macd_signal:.4f})")
        else:
            reasons.append(f"MACD bearish ({macd:.4f} < signal {macd_signal:.4f})")

        if returns_1d > 0.02:
            reasons.append(f"Strong momentum +{returns_1d:.1%} today")
        elif returns_1d < -0.02:
            reasons.append(f"Sharp decline {returns_1d:.1%} today")

        if volatility > 0.03:
            reasons.append(f"High volatility ({volatility:.1%})")

        return reasons[:3]

    def predict_batch(self, symbols):
        """Predict signals for multiple symbols."""
        return [self.predict_symbol(s) for s in symbols]
