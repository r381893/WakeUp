import yfinance as yf
import traceback

print("Testing yfinance for 00631L.TW...")
try:
    ticker = yf.Ticker("00631L.TW")
    print(f"Ticker created: {ticker}")
    
    df = ticker.history(period="1mo")
    print("History fetched type:", type(df))
    
    if df.empty:
        print("Data is empty!")
    else:
        print(df.head())
        print("Data fetched successfully!")

except Exception:
    traceback.print_exc()
