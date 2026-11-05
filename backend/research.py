import os
import sqlite3
from collections import defaultdict
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/v1/research", tags=["Historical research"])
DB_PATH = Path(os.getenv("NIFTY_DB_PATH", "/tmp/nifty_ai_data.sqlite3"))


def _load_candles(symbol: str, limit: int):
    if not DB_PATH.exists():
        return []
    with sqlite3.connect(DB_PATH) as db:
        return db.execute(
            """SELECT timestamp,open,high,low,close,volume FROM candles
               WHERE symbol=? AND timeframe='5m' ORDER BY timestamp ASC LIMIT ?""",
            (symbol.upper(), limit),
        ).fetchall()


def _classify(o, h, l, c, prev=None):
    span = max(h - l, 1e-9)
    body = abs(c - o)
    upper = h - max(o, c)
    lower = min(o, c) - l
    labels = []
    if body / span <= 0.10:
        labels.append("doji")
    if lower >= body * 2 and upper <= body * 0.75 and c >= o:
        labels.append("hammer")
    if upper >= body * 2 and lower <= body * 0.75 and c <= o:
        labels.append("shooting_star")
    if prev:
        po, pc = prev[1], prev[4]
        if c > o and pc < po and o <= pc and c >= po:
            labels.append("bullish_engulfing")
        if c < o and pc > po and o >= pc and c <= po:
            labels.append("bearish_engulfing")
    return labels


@router.get("/patterns")
def historical_pattern_statistics(
    symbol: str = Query(default="NIFTY50", min_length=1, max_length=32),
    forward_bars: int = Query(default=3, ge=1, le=12),
    limit: int = Query(default=100000, ge=100, le=500000),
):
    """Descriptive statistics from uploaded 5-minute candles; not a predictive model."""
    rows = _load_candles(symbol, limit)
    if len(rows) < forward_bars + 30:
        return {
            "status": "insufficient_data",
            "symbol": symbol.upper(),
            "candles_loaded": len(rows),
            "required_minimum": forward_bars + 30,
            "message": "Upload genuine historical 5-minute candles before running research.",
            "synthetic_data_used": False,
        }

    stats = defaultdict(lambda: {"samples": 0, "up": 0, "down": 0, "flat": 0})
    for i in range(1, len(rows) - forward_bars):
        current = rows[i]
        previous = rows[i - 1]
        labels = _classify(current[1], current[2], current[3], current[4], previous)
        if not labels:
            continue
        future_close = rows[i + forward_bars][4]
        base_close = current[4]
        threshold = max(base_close * 0.0001, 0.05)
        outcome = "up" if future_close - base_close > threshold else "down" if base_close - future_close > threshold else "flat"
        for label in labels:
            stats[label]["samples"] += 1
            stats[label][outcome] += 1

    result = []
    for label, item in sorted(stats.items()):
        n = item["samples"]
        result.append({
            "pattern": label,
            "samples": n,
            "up_follow_through_pct": round(100 * item["up"] / n, 2),
            "down_follow_through_pct": round(100 * item["down"] / n, 2),
            "flat_pct": round(100 * item["flat"] / n, 2),
            "interpretation": "Descriptive historical frequency only; not trade win probability.",
            "small_sample_warning": n < 100,
        })
    return {
        "status": "ok",
        "symbol": symbol.upper(),
        "timeframe": "5m",
        "timezone": "Asia/Kolkata",
        "candles_loaded": len(rows),
        "forward_bars": forward_bars,
        "forward_horizon": f"{forward_bars * 5} minutes",
        "patterns": result,
        "method": "Rule-based candle morphology; outcome is close direction after the selected horizon.",
        "synthetic_data_used": False,
        "limitations": [
            "No fees, slippage, level context, trend regime or intrabar path is modelled.",
            "This is exploratory descriptive analysis, not a trained AI prediction.",
            "Do not use these frequencies as standalone trading signals.",
        ],
    }


@router.get("/readiness")
def research_readiness(symbol: str = Query(default="NIFTY50", min_length=1, max_length=32)):
    rows = _load_candles(symbol, 500000)
    return {
        "symbol": symbol.upper(),
        "historical_candle_count": len(rows),
        "research_ready": len(rows) >= 1000,
        "minimum_recommended_candles": 1000,
        "trained_model_available": False,
        "live_feed_available": False,
        "synthetic_data_used": False,
    }
