import yfinance as yf
import pandas as pd

def test_fetch(ticker, period="10y"):
    print(f"--- Testing {ticker} for {period} ---")
    try:
        data = yf.Ticker(ticker)
        df = data.history(period=period)
        print(f"Rows: {len(df)}")
        if not df.empty:
            print(f"Start: {df.index[0]}")
            print(f"End: {df.index[-1]}")
            print(df.tail())
        else:
            print("Empty DataFrame returned.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_fetch("^TWII", "10y")
    test_fetch("WTX=F", "10y")
    test_fetch("0050.TW", "10y")
