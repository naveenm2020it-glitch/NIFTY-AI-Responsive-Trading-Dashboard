import csv
import io
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

IST = ZoneInfo("Asia/Kolkata")
DB_PATH = Path(os.getenv("NIFTY_DB_PATH", "/tmp/nifty_ai_data.sqlite3"))
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

app = FastAPI(
    title="NIFTY AI Trading Dashboard API",
    version="0.2.0",
    description="Validated CSV candle ingestion foundation. No live market feed or trained AI model is assumed.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def connect_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.execute("""
        CREATE TABLE IF NOT EXISTS candles (
            symbol TEXT NOT NULL,
            timeframe TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            open REAL NOT NULL,
            high REAL NOT NULL,
            low REAL NOT NULL,
            close REAL NOT NULL,
            volume REAL,
            source TEXT NOT NULL,
            PRIMARY KEY (symbol, timeframe, timestamp)
        )
    """)
    db.commit()
    return db


def parse_timestamp(raw):
    value = datetime.fromisoformat(raw.strip().replace("Z", "+00:00"))
    if value.tzinfo is None:
        value = value.replace(tzinfo=IST)
    return value.astimezone(IST)


def parse_candle(row, line_number):
    required = ("timestamp", "open", "high", "low", "close")
    missing = [key for key in required if not row.get(key)]
    if missing:
        raise ValueError(f"Line {line_number}: missing {', '.join(missing)}")
    stamp = parse_timestamp(row["timestamp"])
    values = {key: float(row[key]) for key in ("open", "high", "low", "close")}
    volume = float(row["volume"]) if row.get("volume") not in (None, "") else None
    if any(value <= 0 for value in values.values()):
        raise ValueError(f"Line {line_number}: OHLC values must be positive")
    if values["high"] < max(values["open"], values["close"], values["low"]):
        raise ValueError(f"Line {line_number}: high is below another OHLC value")
    if values["low"] > min(values["open"], values["close"], values["high"]):
        raise ValueError(f"Line {line_number}: low is above another OHLC value")
    if volume is not None and volume < 0:
        raise ValueError(f"Line {line_number}: volume cannot be negative")
    if stamp.minute % 5 != 0 or stamp.second != 0:
        raise ValueError(f"Line {line_number}: timestamp is not aligned to a 5-minute boundary")
    return stamp.isoformat(), values, volume


@app.get("/")
def root():
    return {
        "name": "NIFTY AI Trading Dashboard API",
        "status": "operational",
        "market_data": "not_configured",
        "ai_predictions": "not_configured",
        "paper_trading": "disabled",
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "timezone": "Asia/Kolkata"}


@app.get("/api/v1/system/status")
def system_status():
    with connect_db() as db:
        count = db.execute("SELECT COUNT(*) FROM candles").fetchone()[0]
    return {
        "api": "online",
        "historical_candles": {"status": "available" if count else "empty", "rows": count},
        "live_market_data": {"status": "not_configured", "source": None},
        "option_chain": {"status": "not_configured"},
        "prediction_engine": {"status": "not_trained"},
        "paper_trading": {"status": "disabled", "reason": "Requires validated live/replay data and backend risk controls"},
        "safety": {"live_orders": False, "synthetic_market_data": False, "synthetic_predictions": False},
        "database": "SQLite; ephemeral unless NIFTY_DB_PATH points to a persistent mounted disk",
    }


@app.post("/api/v1/data/candles/upload")
async def upload_candles(
    file: UploadFile = File(...),
    symbol: str = Query(default="NIFTY50", min_length=1, max_length=32),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a CSV file.")
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="CSV exceeds the 25 MB upload limit.")
    try:
        text = raw.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        headers = {h.strip().lower() for h in (reader.fieldnames or [])}
        required = {"timestamp", "open", "high", "low", "close"}
        if not required.issubset(headers):
            raise ValueError("CSV must contain timestamp, open, high, low, close; volume is optional.")
        rows = []
        seen = set()
        for line_number, original in enumerate(reader, start=2):
            row = {(key or "").strip().lower(): (value or "").strip() for key, value in original.items()}
            stamp, ohlc, volume = parse_candle(row, line_number)
            if stamp in seen:
                raise ValueError(f"Line {line_number}: duplicate timestamp in uploaded file")
            seen.add(stamp)
            rows.append((symbol.upper(), "5m", stamp, ohlc["open"], ohlc["high"], ohlc["low"], ohlc["close"], volume, file.filename))
        if not rows:
            raise ValueError("CSV contains no candle rows.")
        rows.sort(key=lambda item: item[2])
        with connect_db() as db:
            db.executemany(
                """INSERT INTO candles(symbol,timeframe,timestamp,open,high,low,close,volume,source)
                   VALUES(?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(symbol,timeframe,timestamp) DO UPDATE SET
                   open=excluded.open, high=excluded.high, low=excluded.low,
                   close=excluded.close, volume=excluded.volume, source=excluded.source""",
                rows,
            )
        return {
            "status": "imported",
            "symbol": symbol.upper(),
            "timeframe": "5m",
            "rows_received": len(rows),
            "first_timestamp_ist": rows[0][2],
            "last_timestamp_ist": rows[-1][2],
            "validation": "passed",
            "note": "This import endpoint accepts aligned 5-minute candles only. Data may be ephemeral on the free Render filesystem.",
        }
    except (UnicodeDecodeError, csv.Error, ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/v1/data/candles")
def get_candles(
    symbol: str = Query(default="NIFTY50", min_length=1, max_length=32),
    limit: int = Query(default=500, ge=1, le=5000),
):
    with connect_db() as db:
        rows = db.execute(
            """SELECT timestamp,open,high,low,close,volume FROM candles
               WHERE symbol=? AND timeframe='5m' ORDER BY timestamp DESC LIMIT ?""",
            (symbol.upper(), limit),
        ).fetchall()
    rows.reverse()
    return {
        "symbol": symbol.upper(),
        "timeframe": "5m",
        "timezone": "Asia/Kolkata",
        "count": len(rows),
        "candles": [
            {"timestamp": r[0], "open": r[1], "high": r[2], "low": r[3], "close": r[4], "volume": r[5]}
            for r in rows
        ],
    }
