import math
import numpy as np
import pandas as pd
from typing import List, Dict

# --- BLACK-SCHOLES ENGINE ---

def cnd(x):
    """Cumulative Normal Distribution"""
    return (1.0 + math.erf(x / math.sqrt(2.0))) / 2.0

def calculate_bs_price(S, K, T, r, sigma, option_type="call"):
    """
    Calculate Option Price (Call or Put)
    """
    if T <= 0 or sigma <= 0: 
        if option_type == "call": return max(0, S - K)
        else: return max(0, K - S)
    
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    
    if option_type == "call":
        price = S * cnd(d1) - K * math.exp(-r * T) * cnd(d2)
    else:
        price = K * math.exp(-r * T) * cnd(-d2) - S * cnd(-d1)
        
    return max(0, price)

def run_vol_backtest(df: pd.DataFrame, initial_capital: float = 100000, strategy_days: int = 7) -> dict:
    """
    Simulate Options Volatility Strategy based on HV20 signals.
    """
    # 1. Ensure HV20 exists
    if 'HV20' not in df.columns:
        df['Log_Ret'] = np.log(df['Close'] / df['Close'].shift(1))
        df['HV20'] = df['Log_Ret'].rolling(window=20).std() * np.sqrt(252) * 100

    # 2. Parameters
    r = 0.015 # 1.5% Risk Free Rate
    
    trades = []
    equity_curve = [initial_capital]
    active_trade = None
    
    # Iterate through history
    # We simulate entering a trade and holding it for "strategy_days" or until signal flips?
    # Let's simple: Fixed duration trade (Weekly Options logic)
    
    for i in range(20, len(df) - strategy_days):
        date = df.index[i]
        row = df.iloc[i]
        
        # Check if we have an active trade expiring today
        if active_trade and i == active_trade['exit_idx']:
            # CLOSE TRADE
            exit_S = row['Close']
            exit_vol = row['HV20'] / 100 # Use realized vol at exit as proxy for IV? 
            # Or use initial vol? For PnL attribution, usually implied vol change matters.
            # Simplified: Assume IV reverted to mean or use current HV.
            # Let's use current HV as proxy for IV at exit.
            
            T_remaining = 0 # Expired
            
            # Theoretical Exit Price (Intrinsinc Value if T=0)
            call_exit = calculate_bs_price(exit_S, active_trade['strike'], 0, r, exit_vol, "call")
            put_exit = calculate_bs_price(exit_S, active_trade['strike'], 0, r, exit_vol, "put")
            
            total_exit_value = 0
            
            if active_trade['type'] == 'LONG_STRADDLE':
                # Bought Call + Put. Value is what we sell them for.
                total_exit_value = call_exit + put_exit
                pnl = (total_exit_value - active_trade['entry_cost']) * 50 # 50 = Multiplier (Mini-Index)
                
            elif active_trade['type'] == 'SHORT_STRANGLE':
                # Sold Call + Put. Cost is what we buy them back for.
                # Here we assume we held to expiration (0 days).
                # PnL = Credit Received - Buyback Cost
                buyback_cost = call_exit + put_exit
                pnl = (active_trade['credit_received'] - buyback_cost) * 50
                
            active_trade['pnl'] = pnl
            active_trade['exit_price'] = exit_S
            active_trade['exit_date'] = str(date.date())
            trades.append(active_trade)
            
            current_equity = equity_curve[-1] + pnl
            equity_curve.append(current_equity)
            active_trade = None
            continue
            
        # If no active trade, look for entry
        if active_trade is None:
            hv = row['HV20']
            S = row['Close']
            
            # SIGNAL LOGIC
            signal = "NEUTRAL"
            if hv < 15: signal = "LONG_STRADDLE" # Low Vol -> Buy
            elif hv > 25: signal = "SHORT_STRANGLE" # High Vol -> Sell
            
            if signal != "NEUTRAL":
                # ENTER TRADE
                # 7 Days to maturity
                T = strategy_days / 365.0
                sigma = hv / 100.0 # Use current HV as proxy for IV pricing
                
                # ATM Strike
                strike = round(S / 50) * 50
                
                if signal == "LONG_STRADDLE":
                    c_price = calculate_bs_price(S, strike, T, r, sigma, "call")
                    p_price = calculate_bs_price(S, strike, T, r, sigma, "put")
                    cost = c_price + p_price
                    
                    active_trade = {
                        "entry_idx": i,
                        "exit_idx": i + strategy_days,
                        "entry_date": str(date.date()),
                        "type": "LONG_STRADDLE",
                        "strike": strike,
                        "entry_S": S,
                        "entry_vol": hv,
                        "entry_cost": cost,
                        "pnl": 0
                    }
                    
                elif signal == "SHORT_STRANGLE":
                    # Sell OTM Strangle (approx Delta 0.2? Simpler: 200 points out)
                    c_strike = strike + 200
                    p_strike = strike - 200
                    
                    c_price = calculate_bs_price(S, c_strike, T, r, sigma, "call")
                    p_price = calculate_bs_price(S, p_strike, T, r, sigma, "put")
                    credit = c_price + p_price
                    
                    active_trade = {
                        "entry_idx": i,
                        "exit_idx": i + strategy_days,
                        "entry_date": str(date.date()),
                        "type": "SHORT_STRANGLE",
                        "strike": strike, # Base strike for ref
                        "entry_S": S,
                        "entry_vol": hv,
                        "credit_received": credit,
                        "pnl": 0
                    }
        else:
             # Just mark equity unchanged for today (simplified)
             equity_curve.append(equity_curve[-1])

    # Stats
    wins = len([t for t in trades if t['pnl'] > 0])
    total = len(trades)
    win_rate = (wins / total * 100) if total > 0 else 0
    
    return {
        "final_equity": round(equity_curve[-1], 0),
        "total_trades": total,
        "win_rate": round(win_rate, 2),
        "equity_curve": equity_curve,
        "trades": trades[-50:] # Last 50 trades
    }
