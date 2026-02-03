import yfinance as yf
try:
    ticker = "00631L.TW"
    print(f"Fetching {ticker}...")
    df = yf.Ticker(ticker).history(period="5d")
    if df.empty:
        print(f"Empty DF for {ticker}")
    else:
        print(f"Success! Latest {ticker} price: {df['Close'].iloc[-1]}")
except Exception as e:
    print(f"Error: {e}")
