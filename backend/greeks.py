import math
import os
import sqlite3
from datetime import date, datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/v1/options", tags=["Option Greeks"])
IST = ZoneInfo("Asia/Kolkata")
DB_PATH = Path(os.getenv("NIFTY_DB_PATH", "/tmp/nifty_ai_data.sqlite3"))
RISK_FREE_RATE = 0.06


def _normal_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _normal_pdf(x: float) -> float:
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


def _expiry_years(expiry_date: date, now: datetime) -> float:
    # NSE index-option expiry session is modelled to end at 15:30 IST.
    expiry_cutoff = datetime.combine(expiry_date, time(15, 30), tzinfo=IST)
    seconds_left = max((expiry_cutoff - now.astimezone(IST)).total_seconds(), 0.0)
    return seconds_left / (365.0 * 24.0 * 60.0 * 60.0)


def _greeks(spot: float, strike: float, years: float, iv_percent: float, side: str):
    if spot <= 0 or strike <= 0 or years <= 0 or iv_percent <= 0:
        return None
    sigma = iv_percent / 100.0
    root_t = math.sqrt(years)
    d1 = (math.log(spot / strike) + (RISK_FREE_RATE + 0.5 * sigma * sigma) * years) / (sigma * root_t)
    d2 = d1 - sigma * root_t
    pdf = _normal_pdf(d1)
    discount = math.exp(-RISK_FREE_RATE * years)
    if side == "CE":
        delta = _normal_cdf(d1)
        theta_year = -(spot * pdf * sigma) / (2.0 * root_t) - RISK_FREE_RATE * strike * discount * _normal_cdf(d2)
        rho = strike * years * discount * _normal_cdf(d2) / 100.0
    else:
        delta = _normal_cdf(d1) - 1.0
        theta_year = -(spot * pdf * sigma) / (2.0 * root_t) + RISK_FREE_RATE * strike * discount * _normal_cdf(-d2)
        rho = -strike * years * discount * _normal_cdf(-d2) / 100.0
    gamma = pdf / (spot * sigma * root_t)
    vega = spot * pdf * root_t / 100.0
    return {
        "delta": round(delta, 6),
        "gamma": round(gamma, 9),
        "theta_per_day": round(theta_year / 365.0, 6),
        "vega_per_1_iv_point": round(vega, 6),
        "rho_per_1_rate_point": round(rho, 6),
    }


@router.get("/greeks")
def option_greeks(
    expiry: str = Query(..., description="Expiry date YYYY-MM-DD"),
    strike: float = Query(..., gt=0),
    option_type: str = Query(..., pattern="^(CE|PE)$"),
    symbol: str = Query(default="NIFTY", min_length=1, max_length=32),
    spot_move_points: float = Query(default=0, ge=-2000, le=2000),
    iv_change_points: float = Query(default=0, ge=-100, le=100),
    minutes_ahead: int = Query(default=0, ge=0, le=240),
):
    """Greeks and local premium sensitivity using the latest uploaded quote snapshot."""
    try:
        expiry_date = date.fromisoformat(expiry)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Expiry must be YYYY-MM-DD.") from exc

    with sqlite3.connect(DB_PATH) as db:
        latest = db.execute(
            "SELECT MAX(snapshot_time) FROM option_quotes WHERE symbol=? AND expiry=?",
            (symbol.upper(), expiry_date.isoformat()),
        ).fetchone()[0]
        if not latest:
            raise HTTPException(status_code=404, detail="No uploaded option-chain snapshot exists for this expiry.")
        quote = db.execute(
            """SELECT ltp,spot,iv FROM option_quotes
               WHERE symbol=? AND expiry=? AND snapshot_time=? AND strike=? AND option_type=?""",
            (symbol.upper(), expiry_date.isoformat(), latest, strike, option_type),
        ).fetchone()
    if not quote:
        raise HTTPException(status_code=404, detail="Contract is absent from the latest uploaded snapshot.")
    premium, spot, iv = map(float, quote)
    if iv <= 0:
        raise HTTPException(status_code=422, detail="Contract IV is missing or invalid; Greeks cannot be calculated.")

    now = datetime.now(IST)
    years = _expiry_years(expiry_date, now)
    greeks = _greeks(spot, strike, years, iv, option_type)
    if greeks is None:
        raise HTTPException(status_code=422, detail="Greeks are undefined at or after the expiry cutoff.")
    ds = float(spot_move_points)
    div = float(iv_change_points)
    dt_days = minutes_ahead / 1440.0
    delta_effect = greeks["delta"] * ds
    gamma_effect = 0.5 * greeks["gamma"] * ds * ds
    vega_effect = greeks["vega_per_1_iv_point"] * div
    theta_effect = greeks["theta_per_day"] * dt_days
    change = delta_effect + gamma_effect + vega_effect + theta_effect
    return {
        "status": "scenario_estimate",
        "symbol": symbol.upper(),
        "expiry": expiry_date.isoformat(),
        "strike": strike,
        "option_type": option_type,
        "snapshot_time_ist": latest,
        "spot": spot,
        "premium_ltp": premium,
        "time_to_expiry_minutes": round(years * 365.0 * 24.0 * 60.0, 2),
        "greeks": greeks,
        "scenario": {
            "spot_move_points": ds,
            "iv_change_points": div,
            "minutes_ahead": minutes_ahead,
            "delta_effect_points": round(delta_effect, 4),
            "gamma_effect_points": round(gamma_effect, 4),
            "vega_effect_points": round(vega_effect, 4),
            "theta_effect_points": round(theta_effect, 4),
            "estimated_premium_change_points": round(change, 4),
            "estimated_premium": round(max(0.0, premium + change), 4),
        },
        "model": "Black-Scholes local sensitivity approximation",
        "assumptions": {
            "risk_free_rate_annual": RISK_FREE_RATE,
            "expiry_cutoff": "15:30 Asia/Kolkata",
            "iv_unit": "percentage points",
        },
        "warning": "Not a forecast, probability or trading signal. Assumes locally constant Greeks and omits volatility-surface shifts, jumps, spreads, liquidity and path dependency.",
    }
