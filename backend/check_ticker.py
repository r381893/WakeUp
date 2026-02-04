
import yfinance as yf

candidates = ["^TWII", "WTX=F", "TX=F", "MTX=F", "TIM=F", "TWE=F"]
print("Checking tickers...")
for t in candidates:
    try:
        data = yf.Ticker(t).history(period="1d")
        if not data.empty:
            print(f"[SUCCESS] {t} found! Last price: {data['Close'].iloc[-1]}")
        else:
            print(f"[FAIL] {t} returned empty data.")
    except Exception as e:
        print(f"[ERROR] {t}: {e}")
