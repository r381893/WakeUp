from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from core.fetcher import fetch_price_history
from core.engine import calculate_ma_strategy, run_backtest_simulation
from core.portfolio import get_portfolio_summary, add_position, delete_position
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Wealth-OS Brain")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for now to simplify deployment
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"system": "Wealth-OS", "status": "Online"}

@app.get("/api/analyze/{symbol}")
async def analyze_asset(symbol: str, ma_short: int = 20, ma_long: int = 60):
    """
    Monitor Mode: Get real-time status of an asset.
    """
    try:
        # Fetch 6 months data to ensure MA calculation is accurate
        df = await fetch_price_history(symbol, period="6mo")
        result = calculate_ma_strategy(df, short_ma=ma_short, long_ma=ma_long)
        result['symbol'] = symbol.upper()
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/simulate/{symbol}")
async def simulate_strategy(symbol: str, strategy: str = 'ma_trend', capital: float = 1000000, ma_period: int = 60, leverage: float = 1.0):
    """
    Lab Mode: Run a quick backtest.
    Includes comparison against 0050.TW (Benchmark)
    """
    try:
        # Fetch target and benchmark data
        df = await fetch_price_history(symbol, period="5y")
        try:
            benchmark_df = await fetch_price_history("0050.TW", period="5y")
        except:
            benchmark_df = None
            
        result = run_backtest_simulation(
            df, 
            initial_capital=capital, 
            strategy_type=strategy, 
            ma_period=ma_period, 
            leverage=leverage,
            benchmark_df=benchmark_df
        )
        result['symbol'] = symbol.upper()
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# --- PORTFOLIO API ---

class PositionRequest(BaseModel):
    symbol: str
    shares: float
    avg_cost: float

@app.get("/api/portfolio")
async def get_portfolio():
    items = get_portfolio_summary()
    enriched_items = []
    for item in items:
        try:
            # Special Handling for CASH
            if item['symbol'] == "CASH":
                item.update({
                    "current_price": 1.0,
                    "daily_change_pct": 0,
                    "market_value": round(item['shares'], 0),
                    "pnl": 0,
                    "pnl_pct": 0
                })
                enriched_items.append(item)
                continue

            # Fetch real-time data (small period for speed)
            df = await fetch_price_history(item['symbol'], period="5d")
            
            if not df.empty and len(df) >= 2:
                latest = df.iloc[-1]
                prev = df.iloc[-2]
                
                current_price = float(latest['Close'])
                prev_close = float(prev['Close'])
                change_pct = ((current_price - prev_close) / prev_close) * 100
                
                # Apply Multiplier (Default 1)
                # MTX (Mini Taiex) = 50 TWD per point
                MULTIPLIERS = { "MTX": 50 }
                multiplier = MULTIPLIERS.get(item['symbol'], 1)

                if item['symbol'] == "MTX":
                    # For Futures, we only count the PnL as part of the total asset value
                    # to avoid skewing Net Worth with millions of notional value.
                    unrealized_pnl = (current_price - item['avg_cost']) * item['shares'] * 50
                    market_value = unrealized_pnl
                else:
                    market_value = current_price * item['shares'] * multiplier
                    cost_basis = item['avg_cost'] * item['shares'] * multiplier
                    unrealized_pnl = market_value - cost_basis
                
                # Avoid division by zero
                cost_basis_ref = item['avg_cost'] * abs(item['shares']) * multiplier
                pnl_pct = (unrealized_pnl / cost_basis_ref) * 100 if cost_basis_ref != 0 else 0
                
                item.update({
                    "current_price": round(current_price, 2),
                    "daily_change_pct": round(change_pct, 2),
                    "market_value": round(market_value, 0),
                    "pnl": round(unrealized_pnl, 0),
                    "pnl_pct": round(pnl_pct, 2)
                })
            else:
                # Fallback if no data
                item.update({
                    "current_price": 0, "daily_change_pct": 0, "market_value": 0, "pnl": 0, "pnl_pct": 0
                })
                
        except Exception as e:
            print(f"Error enriching {item['symbol']}: {e}")
            item.update({
                "current_price": 0, "daily_change_pct": 0, "market_value": 0, "pnl": 0, "pnl_pct": 0
            })
        
        enriched_items.append(item)
        
    return enriched_items

@app.post("/api/portfolio")
def add_portfolio_item(item: PositionRequest):
    return add_position(item.symbol, item.shares, item.avg_cost)

@app.delete("/api/portfolio/{position_id}")
def remove_portfolio_item(position_id: str):
    return delete_position(position_id)

@app.get("/api/options")
async def get_options_data():
    """
    Advisor Mode: Get nearest OTM Put prices for hedging.
    """
    try:
        # Get latest index price first
        df = await fetch_price_history("MTX", period="1d")
        if df.empty:
            raise ValueError("Could not fetch index price")
        
        index_price = float(df['Close'].iloc[-1])
        from core.fetcher import fetch_options_summary
        data = await fetch_options_summary(index_price)
        return {**data, "index_price": index_price}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- SETTINGS API ---
SETTINGS_FILE = "data/sim_settings.json"

@app.get("/api/settings")
def get_settings():
    if not os.path.exists(SETTINGS_FILE):
        return {}
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading settings: {e}")
        return {}

@app.post("/api/settings")
async def save_settings(settings: dict):
    try:
        os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=4)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
