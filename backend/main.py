from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="NIFTY AI Trading Dashboard API",
    version="0.1.0",
    description="Backend foundation. Market data and model outputs remain unavailable until an authorized data source and validated models are configured.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "name": "NIFTY AI Trading Dashboard API",
        "status": "operational",
        "mode": "backend-foundation",
        "market_data": "not_configured",
        "ai_predictions": "not_configured",
        "paper_trading": "disabled_until_data_validation",
    }

@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/api/v1/system/status")
def system_status():
    return {
        "api": "online",
        "market_data": {"status": "not_configured", "source": None, "last_update": None},
        "option_chain": {"status": "not_configured"},
        "prediction_engine": {"status": "not_trained"},
        "paper_trading": {"status": "disabled", "reason": "Requires validated market feed and risk controls"},
        "safety": {
            "live_orders": False,
            "synthetic_market_data": False,
            "synthetic_predictions": False,
        },
    }
