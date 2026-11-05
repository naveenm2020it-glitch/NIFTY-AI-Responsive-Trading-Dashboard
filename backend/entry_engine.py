import os
import sqlite3
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query

from backend.greeks import _expiry_years, _greeks

router = APIRouter(prefix="/api/v1/entry-engine", tags=["Entry opportunity engine"])
IST = ZoneInfo("Asia/Kolkata")
DB_PATH = Path(os.getenv("NIFTY_DB_PATH", "/tmp/nifty_ai_data.sqlite3"))


def _number(value):
    return float(value) if value is not None else None


@router.get("/evaluate")
def evaluate_entry(
    expiry: str = Query(..., description="Contract expiry YYYY-MM-DD"),
    strike: float = Query(..., gt=0),
    option_type: str = Query(..., pattern="^(CE|PE)$"),
    symbol: str = Query(default="NIFTY", min_length=1, max_length=32),
):
    """Evidence-based setup score. It does not create a probability or place trades."""
    try:
        expiry_date = date.fromisoformat(expiry)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Expiry must be YYYY-MM-DD.") from exc

    symbol = symbol.upper()
    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row
        snapshots = db.execute(
            "SELECT DISTINCT snapshot_time FROM option_quotes WHERE symbol=? AND expiry=? ORDER BY snapshot_time DESC LIMIT 2",
            (symbol, expiry_date.isoformat()),
        ).fetchall()
        if not snapshots:
            raise HTTPException(status_code=404, detail="No option-chain snapshots uploaded for this expiry.")
        latest_time = snapshots[0]["snapshot_time"]
        previous_time = snapshots[1]["snapshot_time"] if len(snapshots) > 1 else None
        current = db.execute(
            """SELECT ltp,oi,volume,iv,spot FROM option_quotes
               WHERE symbol=? AND expiry=? AND snapshot_time=? AND strike=? AND option_type=?""",
            (symbol, expiry_date.isoformat(), latest_time, strike, option_type),
        ).fetchone()
        previous = db.execute(
            """SELECT ltp,oi,volume,iv,spot FROM option_quotes
               WHERE symbol=? AND expiry=? AND snapshot_time=? AND strike=? AND option_type=?""",
            (symbol, expiry_date.isoformat(), previous_time, strike, option_type),
        ).fetchone() if previous_time else None
        candles = db.execute(
            """SELECT timestamp,open,high,low,close,volume FROM candles
               WHERE symbol IN (?, 'NIFTY', 'NIFTY50') AND timeframe='5m'
               ORDER BY timestamp DESC LIMIT 8""",
            (symbol,),
        ).fetchall()

    if not current:
        raise HTTPException(status_code=404, detail="Selected contract is missing from the latest option-chain snapshot.")

    premium = float(current["ltp"])
    spot = float(current["spot"])
    iv = _number(current["iv"])
    now = datetime.now(IST)
    years = _expiry_years(expiry_date, now)
    greeks = _greeks(spot, strike, years, iv, option_type) if iv and years > 0 else None

    points = 0
    max_points = 100
    evidence = []
    missing = []

    if previous and previous["ltp"] and float(previous["ltp"]) > 0:
        premium_change_pct = (premium / float(previous["ltp"]) - 1) * 100
        aligned = premium_change_pct > 0.15
        points += 20 if aligned else 0
        evidence.append({"factor": "premium_momentum", "value_pct": round(premium_change_pct, 3), "points": 20 if aligned else 0, "max_points": 20, "supports_side": aligned})
    else:
        premium_change_pct = None
        missing.append("A previous option-chain snapshot for premium momentum")

    if previous and current["oi"] is not None and previous["oi"] is not None:
        oi_change_pct = ((float(current["oi"]) - float(previous["oi"])) / max(abs(float(previous["oi"])), 1)) * 100
        # Rising premium + rising OI is treated as a supporting, not conclusive, long-option signal.
        oi_support = premium_change_pct is not None and premium_change_pct > 0 and oi_change_pct > 0
        points += 15 if oi_support else 0
        evidence.append({"factor": "open_interest_change", "value_pct": round(oi_change_pct, 3), "points": 15 if oi_support else 0, "max_points": 15, "interpretation": "Premium and OI both rising" if oi_support else "No long-build-up confirmation"})
    else:
        oi_change_pct = None
        missing.append("Two OI observations for the selected contract")

    if previous and current["volume"] is not None and previous["volume"] is not None:
        volume_delta = float(current["volume"]) - float(previous["volume"])
        volume_support = volume_delta > 0
        points += 10 if volume_support else 0
        evidence.append({"factor": "volume_increase", "value": volume_delta, "points": 10 if volume_support else 0, "max_points": 10, "supports_side": volume_support})
    else:
        volume_delta = None
        missing.append("Two volume observations for the selected contract")

    if greeks:
        delta_strength = abs(greeks["delta"])
        delta_ok = delta_strength >= 0.35
        gamma_ok = greeks["gamma"] > 0
        points += 15 if delta_ok else 0
        points += 5 if gamma_ok else 0
        evidence.extend([
            {"factor": "delta_exposure", "value": greeks["delta"], "points": 15 if delta_ok else 0, "max_points": 15, "supports_side": delta_ok},
            {"factor": "gamma", "value": greeks["gamma"], "points": 5 if gamma_ok else 0, "max_points": 5, "supports_side": gamma_ok},
        ])
        theta_cost = abs(greeks["theta_per_day"]) * (15 / 1440)
        theta_ok = theta_cost < max(premium * 0.01, 0.25)
        points += 10 if theta_ok else 0
        evidence.append({"factor": "theta_drag_15m_estimate", "value_points": round(theta_cost, 4), "points": 10 if theta_ok else 0, "max_points": 10, "supports_side": theta_ok})
        vega = greeks["vega_per_1_iv_point"]
        evidence.append({"factor": "vega_sensitivity", "value_per_iv_point": vega, "points": 0, "max_points": 0, "interpretation": "Context only; IV direction must be observed, not assumed."})
    else:
        missing.append("Valid IV and time-to-expiry for Greeks")

    candles = list(reversed(candles))
    if len(candles) >= 6:
        first_close = float(candles[0]["close"])
        last_close = float(candles[-1]["close"])
        spot_change = last_close - first_close
        side_aligned = (option_type == "CE" and spot_change > 0) or (option_type == "PE" and spot_change < 0)
        points += 25 if side_aligned else 0
        evidence.append({"factor": "spot_5m_direction", "change_points": round(spot_change, 2), "points": 25 if side_aligned else 0, "max_points": 25, "supports_side": side_aligned, "bars": len(candles)})
    else:
        spot_change = None
        missing.append("At least six recent NIFTY 5-minute candles")

    # Scores are only meaningful when the minimum evidence set exists.
    has_minimum = previous is not None and greeks is not None and len(candles) >= 6
    state = "WAITING_FOR_DATA"
    if has_minimum:
        state = "EARLY_WARNING" if points >= 35 else "NO_SETUP"
        if points >= 65 and premium_change_pct is not None and premium_change_pct > 0.15 and spot_change is not None:
            state = "CONFIRMATION_CANDIDATE"

    return {
        "status": "evaluated",
        "symbol": symbol,
        "expiry": expiry_date.isoformat(),
        "strike": strike,
        "option_type": option_type,
        "snapshot_time_ist": latest_time,
        "previous_snapshot_time_ist": previous_time,
        "premium_ltp": premium,
        "spot": spot,
        "evidence_score": points if has_minimum else None,
        "score_scale": "0-100 evidence points; not a probability or win rate",
        "entry_state": state,
        "target_points": 20,
        "stop_points": 10,
        "risk_reward": "2:1 before costs and slippage",
        "greeks": greeks,
        "observations": {
            "premium_change_pct": round(premium_change_pct, 3) if premium_change_pct is not None else None,
            "oi_change_pct": round(oi_change_pct, 3) if oi_change_pct is not None else None,
            "volume_delta": volume_delta,
            "spot_change_over_recent_5m_bars": round(spot_change, 2) if spot_change is not None else None,
        },
        "evidence": evidence,
        "missing_inputs": missing,
        "target_first_probability": None,
        "stop_first_probability": None,
        "paper_entry_authorized": False,
        "reason": "A confirmation candidate is not an order. Probability calibration and historical option-premium validation are still required before automated paper entry.",
        "synthetic_data_used": False,
    }
