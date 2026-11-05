# NIFTY AI Responsive Trading Dashboard

Responsive React + Vite dashboard with a FastAPI backend foundation.

## Frontend
- Install: `npm install`
- Development: `npm run dev`
- Production build: `npm run build`

## Backend
- Install: `pip install -r requirements.txt`
- Run: `uvicorn backend.main:app --reload`
- Health: `GET /api/health`
- System status: `GET /api/v1/system/status`

## Current implementation status
- Dashboard UI source is included under `src/`.
- FastAPI service foundation and health/status endpoints are included under `backend/`.
- No live market feed, option-chain feed, trained prediction model, or paper execution engine is connected yet.
- The API deliberately reports unavailable capabilities instead of generating fabricated market values or predictions.
- No live broker orders are implemented.

## Next engineering milestones
1. Select and validate an authorized NSE/NIFTY market-data source.
2. Implement instrument master, expiry selection, ATM ±10 strike normalization and option-chain ingestion.
3. Add candle storage, timestamp/OHLC validation, gap detection and replay.
4. Train and validate CPU-friendly models with walk-forward testing and calibrated probabilities.
5. Add backend-enforced paper-trading risk controls: +20 premium target, -10 stop, one concurrent position, CE/PE long-only.
6. Add monitoring, audit logs and frontend API integration.


## Validated historical candle CSV import
The API accepts aligned 5-minute OHLC CSV uploads at `POST /api/v1/data/candles/upload?symbol=NIFTY50`.
Required columns: `timestamp,open,high,low,close`; optional: `volume`.
- Naive timestamps are interpreted as Asia/Kolkata; timezone-aware timestamps are converted to IST.
- OHLC values, non-negative volume, duplicate timestamps and 5-minute timestamp alignment are checked.
- Read imported rows from `GET /api/v1/data/candles?symbol=NIFTY50&limit=500`.
- The default SQLite database is on Render's ephemeral filesystem. Configure `NIFTY_DB_PATH` to a persistent mounted disk before relying on storage across restarts.
- Live market/option-chain feeds, AI predictions and paper execution remain disabled until separately implemented and validated.
