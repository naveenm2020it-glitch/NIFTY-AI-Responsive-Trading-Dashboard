import csv
import io
import os
import sqlite3
import math
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
    db.execute("""
        CREATE TABLE IF NOT EXISTS option_quotes (
            symbol TEXT NOT NULL,
            snapshot_time TEXT NOT NULL,
            expiry TEXT NOT NULL,
            strike REAL NOT NULL,
            option_type TEXT NOT NULL,
            ltp REAL NOT NULL,
            oi REAL,
            volume REAL,
            iv REAL,
            spot REAL NOT NULL,
            source TEXT NOT NULL,
            PRIMARY KEY (symbol, snapshot_time, expiry, strike, option_type)
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




def parse_expiry(raw):
    return datetime.fromisoformat(raw.strip()).date()


def normal_cdf(value):
    return 0.5 * (1.0 + math.erf(value / math.sqrt(2.0)))


def calculate_greeks(spot, strike, days, iv_percent, option_type, rate=0.06):
    if days <= 0 or iv_percent is None or iv_percent <= 0:
        return None
    t = days / 365.0
    sigma = iv_percent / 100.0
    root_t = math.sqrt(t)
    d1 = (math.log(spot / strike) + (rate + 0.5 * sigma * sigma) * t) / (sigma * root_t)
    d2 = d1 - sigma * root_t
    pdf = math.exp(-0.5 * d1 * d1) / math.sqrt(2.0 * math.pi)
    discount = math.exp(-rate * t)
    if option_type == "CE":
        delta = normal_cdf(d1)
        theta = (-(spot * pdf * sigma) / (2 * root_t) - rate * strike * discount * normal_cdf(d2)) / 365.0
    else:
        delta = normal_cdf(d1) - 1.0
        theta = (-(spot * pdf * sigma) / (2 * root_t) + rate * strike * discount * normal_cdf(-d2)) / 365.0
    gamma = pdf / (spot * sigma * root_t)
    vega = spot * pdf * root_t / 100.0
    return {"delta": round(delta, 6), "gamma": round(gamma, 8), "theta_per_day": round(theta, 6), "vega_per_1_iv_point": round(vega, 6), "model": "Black-Scholes approximation", "risk_free_rate_assumption": rate}


@app.post("/api/v1/options/chain/upload")
async def upload_option_chain(
    file: UploadFile = File(...),
    symbol: str = Query(default="NIFTY", min_length=1, max_length=32),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a CSV file.")
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="CSV exceeds the 25 MB upload limit.")
    try:
        reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
        required = {"expiry", "strike", "option_type", "ltp", "spot"}
        headers = {h.strip().lower() for h in (reader.fieldnames or [])}
        if not required.issubset(headers):
            raise ValueError("CSV must contain expiry,strike,option_type,ltp,spot; oi,volume,iv,timestamp are optional.")
        parsed = []
        keys = set()
        default_snapshot = datetime.now(IST).isoformat()
        for line_number, original in enumerate(reader, start=2):
            row = {(key or "").strip().lower(): (value or "").strip() for key, value in original.items()}
            expiry = parse_expiry(row["expiry"]).isoformat()
            option_type = row["option_type"].upper()
            if option_type not in ("CE", "PE"):
                raise ValueError(f"Line {line_number}: option_type must be CE or PE.")
            strike, ltp, spot = float(row["strike"]), float(row["ltp"]), float(row["spot"])
            oi = float(row["oi"]) if row.get("oi") else None
            volume = float(row["volume"]) if row.get("volume") else None
            iv = float(row["iv"]) if row.get("iv") else None
            if min(strike, ltp, spot) <= 0 or (oi is not None and oi < 0) or (volume is not None and volume < 0) or (iv is not None and iv <= 0):
                raise ValueError(f"Line {line_number}: strike, LTP and spot must be positive; OI/volume non-negative; IV positive.")
            if iv is not None and iv > 500:
                raise ValueError(f"Line {line_number}: IV must be expressed as a percentage, not a decimal.")
            snapshot = parse_timestamp(row["timestamp"]).isoformat() if row.get("timestamp") else default_snapshot
            key = (expiry, strike, option_type, snapshot)
            if key in keys:
                raise ValueError(f"Line {line_number}: duplicate contract in snapshot.")
            keys.add(key)
            parsed.append((symbol.upper(), snapshot, expiry, strike, option_type, ltp, oi, volume, iv, spot, file.filename))
        if not parsed:
            raise ValueError("CSV contains no option quotes.")
        snapshots = {r[1] for r in parsed}
        expiries = {r[2] for r in parsed}
        spots = {r[9] for r in parsed}
        if len(snapshots) != 1 or len(spots) != 1:
            raise ValueError("Upload one consistent snapshot at a time with one timestamp and one underlying spot price.")
        with connect_db() as db:
            db.executemany(
                """INSERT INTO option_quotes(symbol,snapshot_time,expiry,strike,option_type,ltp,oi,volume,iv,spot,source)
                   VALUES(?,?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(symbol,snapshot_time,expiry,strike,option_type) DO UPDATE SET
                   ltp=excluded.ltp,oi=excluded.oi,volume=excluded.volume,iv=excluded.iv,spot=excluded.spot,source=excluded.source""",
                parsed,
            )
        return {"status": "imported", "symbol": symbol.upper(), "rows_received": len(parsed), "expiry_dates": sorted(expiries), "snapshot_time_ist": next(iter(snapshots)), "underlying_spot": next(iter(spots)), "validation": "passed", "note": "Uploaded CSV values only; this is not a live feed."}
    except (UnicodeDecodeError, csv.Error, ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/v1/options/chain")
def get_option_chain(
    expiry: str = Query(..., description="Expiry date YYYY-MM-DD"),
    symbol: str = Query(default="NIFTY", min_length=1, max_length=32),
    strikes_each_side: int = Query(default=10, ge=0, le=50),
):
    try:
        expiry_date = parse_expiry(expiry)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Expiry must be YYYY-MM-DD.") from exc
    with connect_db() as db:
        latest = db.execute(
            "SELECT MAX(snapshot_time) FROM option_quotes WHERE symbol=? AND expiry=?",
            (symbol.upper(), expiry_date.isoformat()),
        ).fetchone()[0]
        if not latest:
            return {"status": "no_data", "symbol": symbol.upper(), "expiry": expiry_date.isoformat(), "message": "Upload an authorized option-chain CSV snapshot first. No market values are generated."}
        rows = db.execute(
            """SELECT strike,option_type,ltp,oi,volume,iv,spot FROM option_quotes
               WHERE symbol=? AND expiry=? AND snapshot_time=? ORDER BY strike,option_type""",
            (symbol.upper(), expiry_date.isoformat(), latest),
        ).fetchall()
    spot_values = {r[6] for r in rows}
    if len(spot_values) != 1:
        raise HTTPException(status_code=409, detail="Snapshot has inconsistent underlying spot values.")
    spot = next(iter(spot_values))
    strikes = sorted({r[0] for r in rows})
    atm = min(strikes, key=lambda strike: abs(strike - spot))
    atm_index = strikes.index(atm)
    chosen = strikes[max(0, atm_index - strikes_each_side):atm_index + strikes_each_side + 1]
    expiry_days = (expiry_date - datetime.now(IST).date()).days
    quote_map = {(r[0], r[1]): r for r in rows}
    chain_rows = []
    for strike in chosen:
        item = {"strike": strike, "is_atm": strike == atm}
        for side in ("CE", "PE"):
            r = quote_map.get((strike, side))
            if r:
                item[side] = {"ltp": r[2], "oi": r[3], "volume": r[4], "iv_percent": r[5], "greeks": calculate_greeks(spot, strike, expiry_days, r[5], side)}
            else:
                item[side] = None
        chain_rows.append(item)
    return {"status": "ok", "symbol": symbol.upper(), "expiry": expiry_date.isoformat(), "snapshot_time_ist": latest, "spot": spot, "atm_strike": atm, "strikes_each_side": strikes_each_side, "expiry_days": expiry_days, "greeks_note": "Black-Scholes estimates using 6% assumed annual risk-free rate; not exchange-provided Greeks.", "chain": chain_rows}


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
