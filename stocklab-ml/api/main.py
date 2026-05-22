#!/usr/bin/env python3
"""
StockLab ML -- FastAPI Prediction Service
[P2-07] REST API for ML predictions.

Endpoints:
    GET  /health          -> service status
    POST /predict         -> single symbol prediction
    POST /predict/batch   -> batch prediction
    POST /admin/train     -> trigger retrain (protected)

Usage:
    cd stocklab-ml
    set PYTHONIOENCODING=utf-8
    .venv\\Scripts\\python.exe -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
"""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

# --- App ---
app = FastAPI(
    title="StockLab ML Service",
    description="AI-powered stock signal prediction API",
    version="1.0.0",
)

# CORS (allow Spring Boot backend to call this)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global state ---
predictor = None
startup_time = None


# --- Request/Response models ---
class PredictRequest(BaseModel):
    symbol: str


class BatchPredictRequest(BaseModel):
    symbols: List[str]


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str
    uptime_seconds: float


# --- Startup ---
@app.on_event("startup")
async def startup():
    global predictor, startup_time
    startup_time = time.time()

    try:
        from models.predict import Predictor
        predictor = Predictor(model_version="v1")
        print("[OK] Model loaded successfully")
    except Exception as e:
        print(f"[WARN] Model failed to load: {e}")
        predictor = None


# --- Endpoints ---
@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        model_loaded=predictor is not None,
        model_version=predictor.version if predictor else "none",
        uptime_seconds=round(time.time() - startup_time, 1) if startup_time else 0,
    )


@app.post("/predict")
async def predict(req: PredictRequest):
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    symbol = req.symbol.upper().strip()
    result = predictor.predict_symbol(symbol)

    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@app.post("/predict/batch")
async def predict_batch(req: BatchPredictRequest):
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    symbols = [s.upper().strip() for s in req.symbols]
    if len(symbols) > 50:
        raise HTTPException(status_code=400, detail="Max 50 symbols per request")

    start = time.time()
    results = predictor.predict_batch(symbols)
    elapsed_ms = (time.time() - start) * 1000

    return {
        "predictions": results,
        "count": len(results),
        "latency_ms": round(elapsed_ms, 1),
    }


@app.post("/admin/train")
async def admin_train(x_admin_token: Optional[str] = Header(None)):
    """Trigger model retraining. Protected by X-Admin-Token header."""
    expected_token = os.getenv("ML_ADMIN_TOKEN", "change_me_too")

    if not x_admin_token or x_admin_token != expected_token:
        raise HTTPException(status_code=403, detail="Invalid or missing X-Admin-Token")

    # In production, disable this endpoint
    if os.getenv("ENVIRONMENT", "development") == "production":
        raise HTTPException(status_code=403, detail="Training disabled in production")

    return {
        "status": "accepted",
        "message": "Training triggered. This is a placeholder - run models/train.py manually for now.",
    }


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    print(f"  {request.method} {request.url.path} -> {response.status_code} ({elapsed*1000:.0f}ms)")
    return response
