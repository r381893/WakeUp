import yfinance as yf
import requests
import traceback

print("Testing yfinance with User-Agent Session...")

def get_session():
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    return session

try:
    # Use the session
    ticker = yf.Ticker("00631L.TW", session=get_session())
    print(f"Ticker created: {ticker}")
    
    df = ticker.history(period="1mo")
    print("History fetched type:", type(df))
    
    if df.empty:
        print("Data is empty!")
    else:
        print(df.head())
        print("✅ Data fetched successfully! Rate Limit Bypassed.")

except Exception:
    traceback.print_exc()
