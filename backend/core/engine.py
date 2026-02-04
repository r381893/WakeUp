import pandas as pd

def calculate_ma_strategy(df: pd.DataFrame, short_ma: int = 20, long_ma: int = 60) -> dict:
    """
    The Universal Logic Engine.
    Applies the "Traffic Light" logic to ANY asset dataframe.
    """
    # 1. Calculate Indicators
    df['MA_Ultra_Short'] = df['Close'].rolling(window=10).mean() # MA10
    df['MA_Short'] = df['Close'].rolling(window=short_ma).mean()
    df['MA_Long'] = df['Close'].rolling(window=long_ma).mean()

    # --- ADVANCED INDICATORS (V3) ---
    
    # 1. RSI (Relative Strength Index)
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    # 2. MACD (Moving Average Convergence Divergence)
    ema12 = df['Close'].ewm(span=12, adjust=False).mean()
    ema26 = df['Close'].ewm(span=26, adjust=False).mean()
    df['MACD'] = ema12 - ema26
    df['Signal_Line'] = df['MACD'].ewm(span=9, adjust=False).mean()
    
    # 2. Get Latest State
    latest = df.iloc[-1]
    price = latest['Close']
    ma_us = latest['MA_Ultra_Short']
    ma_s = latest['MA_Short']
    ma_l = latest['MA_Long']
    rsi = latest['RSI']
    macd = latest['MACD']
    signal_line = latest['Signal_Line']
    
    # --- LOGIC BOARD ---
    # Logic: 
    # Green: Price > Short MA (Bullish)
    # Yellow: Price < Short MA but > Long MA (Conflicted/Correction)
    # Red: Price < Long MA (Bearish/Hedge)
    
    if price > ma_s:
        status = "BULL"
        color = "neon-green"
        action = "HOLD / ADD"
    elif price > ma_l:
        status = "WARNING"
        color = "neon-yellow"
        action = "WATCH"
    else:
        status = "BEAR"
        color = "neon-red"
        action = "HEDGE / SELL"
    
    # --- AI REPORT GENERATION ---
    report = []
    report.append(f"Price is {'ABOVE' if price > ma_s else 'BELOW'} MA20.")
    
    item_rsi = f"RSI is {round(rsi, 1)}."
    if rsi > 70: item_rsi += " (Overbought 🔴)"
    elif rsi < 30: item_rsi += " (Oversold 🟢)"
    else: item_rsi += " (Neutral)"
    report.append(item_rsi)
    
    if macd > signal_line:
        report.append("MACD Bullish Crossover 📈.")
    else:
        report.append("MACD Bearish Divergence 📉.")
        
    ai_report = " ".join(report)

    # Prepare Chart Data (Last 90 days)
    chart_df = df.tail(90).copy()
    chart_data = []
    
    # Check for direct 'DayChange' from Scraper
    direct_change = None
    if 'DayChange' in df.columns and not pd.isna(df['DayChange'].iloc[-1]):
        direct_change = float(df['DayChange'].iloc[-1])

    for index, row in chart_df.iterrows():
        chart_data.append({
            "date": str(index.date()),
            "open": round(row['Open'], 2),
            "high": round(row['High'], 2),
            "low": round(row['Low'], 2),
            "close": round(row['Close'], 2),
            "price": round(row['Close'], 2), # Keep for backward compatibility
            "ma_ultra_short": round(row['MA_Ultra_Short'], 2) if not pd.isna(row['MA_Ultra_Short']) else None,
            "ma_short": round(row['MA_Short'], 2) if not pd.isna(row['MA_Short']) else None,
            "ma_long": round(row['MA_Long'], 2) if not pd.isna(row['MA_Long']) else None
        })

    return {
        "price": round(price, 2),
        "ma_short": round(ma_s, 2),
        "ma_long": round(ma_l, 2),
        "status": status,
        "ui_color": color,
        "suggested_action": action,
        "timestamp": str(latest.name),
        "rsi": round(rsi, 2) if not pd.isna(rsi) else 50,
        "macd": round(macd, 2) if not pd.isna(macd) else 0,
        "ai_report": ai_report,
        "chart_data": chart_data,
        "direct_change": direct_change # Pass this to UI
    }

def run_backtest_simulation(df: pd.DataFrame, initial_capital: float = 100000, strategy_type: str = 'ma_trend', ma_period: int = 60, leverage: float = 1.0, benchmark_df: pd.DataFrame = None):
    """
    Vectorized Backtest Engine (V5 - Pro)
    Strategies: 'ma_trend', 'ma_long', 'buy_hold'
    Features: Custom MA, Leverage, MDD, Win Rate, Benchmark Comparison, Trade Logs, Yearly Stats
    """
    # ... (same indicator and signal calculation) ...
    col_name = f'MA_{ma_period}'
    if col_name not in df.columns:
        df[col_name] = df['Close'].rolling(window=ma_period).mean()

    df['Signal'] = 0
    if strategy_type == 'ma_trend':
        df.loc[df['Close'] > df[col_name], 'Signal'] = 1
        df.loc[df['Close'] < df[col_name], 'Signal'] = -1
    elif strategy_type == 'ma_long':
        df.loc[df['Close'] > df[col_name], 'Signal'] = 1
    else:
        df['Signal'] = 1
    
    # --- TRADE LOG GENERATION ---
    trades = []
    position = 0
    entry_price = 0
    entry_date = None
    
    # Iterate for trade logs (Hybrid approach: Vectorized for perf, Loop for logs)
    # Note: For strict vectorization we'd skip this, but logs are requested.
    # To keep it fast, we only loop if needed or just reconstruct from signals.
    # Let's use reconstruction from signal changes.
    
    df['Prev_Signal'] = df['Signal'].shift(1).fillna(0)
    # Entry: Signal becomes non-zero
    # Exit: Signal becomes zero OR Signal flips (reversal)
    
    # Simple loop for robust log generation
    for date, row in df.iterrows():
        signal = row['Signal']
        price = row['Close']
        
        # Open Position
        if position == 0 and signal != 0:
            position = signal
            entry_price = price
            entry_date = date
        
        # Close Position (Signal changed or became 0)
        elif position != 0 and signal != position:
            exit_price = price
            pnl_pct = (exit_price - entry_price) / entry_price * position * leverage
            pnl_amount = initial_capital * pnl_pct # Not exact compounding but ok for log display
            
            trades.append({
                "entry_date": str(entry_date.date()),
                "entry_price": round(entry_price, 2),
                "type": "LONG" if position == 1 else "SHORT",
                "exit_date": str(date.date()),
                "exit_price": round(exit_price, 2),
                "pnl_pct": round(pnl_pct * 100, 2),
                "duration": (date - entry_date).days
            })
            
            # Re-entry if signal flips directly (e.g. Long to Short)
            if signal != 0:
                position = signal
                entry_price = price
                entry_date = date
            else:
                position = 0

    # --- PERFORMANCE CALCULATION ---
    df['Returns'] = df['Close'].pct_change()
    df['Strategy_Returns'] = df['Returns'] * df['Signal'].shift(1) * leverage
    df['Equity'] = (1 + df['Strategy_Returns'].fillna(0)).cumprod() * initial_capital
    final_equity = df['Equity'].iloc[-1]
    
    days = len(df)
    cagr = ((final_equity / initial_capital) ** (365 / days) - 1) * 100 if days > 0 else 0

    # 1. MDD (Max Drawdown)
    rolling_max = df['Equity'].cummax()
    drawdown = (df['Equity'] - rolling_max) / rolling_max
    mdd = drawdown.min() * 100 
    
    # 2. Trades & Win Rate
    # trades list is already built
    total_trades = len(trades)
    winning_trades = len([t for t in trades if t['pnl_pct'] > 0])
    win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
    
    # 3. Yearly Stats
    df['Year'] = df.index.year
    yearly_stats = []
    
    # Group by Year
    for year, group in df.groupby('Year'):
        if len(group) < 10: continue
        
        start_eq = group['Equity'].iloc[0]
        end_eq = group['Equity'].iloc[-1]
        
        # Year Return - Approximate based on equity curve within that year
        # Note: The first day of year might inherit position from prev year
        # Better: (End / Start) - 1
        year_return = ((end_eq - start_eq) / start_eq) * 100
        
        # Year MDD
        g_roll = group['Equity'].cummax()
        g_dd = (group['Equity'] - g_roll) / g_roll
        year_mdd = g_dd.min() * 100
        
        yearly_stats.append({
            "year": int(year),
            "return_pct": round(year_return, 2),
            "mdd_pct": round(year_mdd, 2),
            "profit": round(end_eq - start_eq, 0)
        })
        
    yearly_stats.reverse() # Newest first

    # --- BENCHMARK CALCULATION ---
    benchmark_cagr = 0
    benchmark_mdd = 0
    if benchmark_df is not None and not benchmark_df.empty:
        # Align dates with the strategy df
        b_df = benchmark_df[benchmark_df.index.isin(df.index)].copy()
        if not b_df.empty:
            b_df['Returns'] = b_df['Close'].pct_change()
            b_df['Equity'] = (1 + b_df['Returns'].fillna(0)).cumprod() * initial_capital
            b_final = b_df['Equity'].iloc[-1]
            benchmark_cagr = ((b_final / initial_capital) ** (365 / len(b_df)) - 1) * 100
            
            b_rolling_max = b_df['Equity'].cummax()
            b_drawdown = (b_df['Equity'] - b_rolling_max) / b_rolling_max
            benchmark_mdd = b_drawdown.min() * 100

    return {
        "final_equity": round(final_equity, 0),
        "cagr_percent": round(cagr, 2),
        "mdd_percent": round(mdd, 2),
        "win_rate": round(win_rate, 2),
        "total_trades": int(total_trades),
        "benchmark_cagr": round(benchmark_cagr, 2),
        "benchmark_mdd": round(benchmark_mdd, 2),
        "equity_curve": df['Equity'].fillna(initial_capital).tolist()[-100:],
        "trade_list": trades[::-1], # Newest first
        "yearly_stats": yearly_stats,
        "period_start": str(df.index[0].date()),
        "period_end": str(df.index[-1].date()),
        "duration_years": round(days / 365.25, 1)
    }
