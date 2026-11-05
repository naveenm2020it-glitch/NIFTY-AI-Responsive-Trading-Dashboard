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


## Option-chain CSV snapshot import
The Option Chain tab supports uploading one CSV snapshot through the backend. Required columns:
`expiry,strike,option_type,ltp,spot`
Optional columns: `oi,volume,iv,timestamp`.
- `expiry` format: `YYYY-MM-DD`
- `option_type`: `CE` or `PE`
- `iv`: percentage value (for example, 18.5 means 18.5%)
- `timestamp`: optional ISO timestamp; naive timestamps are interpreted as IST. If omitted, one shared upload timestamp is assigned to all rows.
- Upload one expiry and one underlying spot/snapshot time per file.
- The chain endpoint returns the nearest listed strike to spot as ATM and up to 10 available strikes on either side.
- Greeks are Black-Scholes estimates using an explicitly disclosed 6% annual risk-free-rate assumption; they are not exchange-provided Greeks.
- A CSV upload is a historical/manual snapshot, not a live or automatically refreshing market feed.
- Missing contracts are left blank; no quotes are synthesized.

Endpoints:
- `POST /api/v1/options/chain/upload?symbol=NIFTY`
- `GET /api/v1/options/chain?symbol=NIFTY&expiry=YYYY-MM-DD&strikes_each_side=10`


## Paper-trading safety engine (snapshot-driven)
Backend endpoints:
- `GET /api/v1/paper/status` — recent paper positions and execution constraints.
- `POST /api/v1/paper/positions/open?expiry=YYYY-MM-DD&strike=...&option_type=CE&quantity=1` — opens only when a matching contract exists in the latest uploaded option snapshot.
- `POST /api/v1/paper/positions/refresh` — checks the open position against the latest uploaded snapshot and closes at +20 premium points or -10 premium points when crossed.
Safety rules: one open position globally, long CE/PE only, no broker order routing. This is snapshot-driven paper execution, not live automatic monitoring; it requires fresh uploaded quotes and a manual refresh request. The SQLite database remains ephemeral on the current Render filesystem.
