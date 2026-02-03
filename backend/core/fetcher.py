import yfinance as yf
import pandas as pd
import certifi
import os
import requests
import shutil
from bs4 import BeautifulSoup
import traceback

# FORCE SSL CERTIFICATE PATH
os.environ['SSL_CERT_FILE'] = certifi.where()
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()

# Mapping friendly names to Yahoo Tickers
SYMBOL_MAP = {
    "00631L": "00631L.TW",
    "0050": "0050.TW",
    "BTC": "BTC-USD",
    "ETH": "ETH-USD",
    "TQQQ": "TQQQ",
    "TSM": "2330.TW",
    "MTX": "^TWII",   # Default to index, but we intercept MTX below
    "TAIEX": "^TWII"
}

def get_session():
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    return session

def fetch_yahoo_realtime(symbol: str):
    """
    Scrape Yahoo Finance TW for real-time Futures data (Day + Night).
    Target: https://tw.stock.yahoo.com/quote/{symbol}
    """
    try:
        url = f"https://tw.stock.yahoo.com/quote/{symbol}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        print(f"🕵️ Scraping Real-Time Data from {url}...")
        res = requests.get(url, headers=headers, timeout=5)
        
        if res.status_code != 200:
            return None
            
        soup = BeautifulSoup(res.text, "html.parser")
        
        # Selectors for Price (Big Number)
        # Yahoo TW classes often use Fz(32px) for the main price
        selectors = [".Fz\\(32px\\)", ".Fz\\(42px\\)", "[class*='Fz(32px)']", "[class*='Fz(42px)']"]
        
        price = None
        for sel in selectors:
            tag = soup.select_one(sel)
            if tag:
                try:
                    txt = tag.text.strip().replace(",", "")
                    price = float(txt)
                    break 
                except:
                    continue
        
        if price:
            print(f"✅ Scraped Price: {price}")
            
            # Try to scrape Change
            change_val = 0
            try:
                container = soup.select_one(".Fz\\(32px\\)").parent
                if container:
                    import re
                    match = re.search(r'([▲▼\+\-]?\s*\d+\.?\d*)\s*\(.*?%\)', container.text)
                    if match:
                        change_str = match.group(1).replace("▲", "").replace("▼", "").replace("+", "").replace(",", "").strip()
                        change_val = float(change_str)
                        # Determine sign
                        if "▼" in match.group(0) or "-" in match.group(0):
                            change_val = -abs(change_val)
                        else:
                            change_val = abs(change_val)
            except:
                pass
            
            print(f"✅ Scraped Change: {change_val}")

            # Create a minimal DataFrame
            data = {
                "Open": [price], "High": [price], "Low": [price], "Close": [price], "Volume": [0],
                "DayChange": [change_val] # Store change here
            }
            df = pd.DataFrame(data)
            df.index = [pd.Timestamp.now()]
            return df
            
    except Exception as e:
        print(f"⚠️ Scraping Failed: {e}")
        return None

async def fetch_history_internal(symbol: str, period: str = "1y") -> pd.DataFrame:
    """
    The original robust yfinance fetcher with SSL/Cache fixes.
    """
    ticker = SYMBOL_MAP.get(symbol.upper(), symbol)
    print(f"📡 API Fetching: {ticker} ({period})...")

    # 1. Fix Certificate Path (Crucial for Windows/Chinese Paths)
    safe_cert_path = "C:\\Users\\Public\\wealth_os_cacert.pem"
    try:
        if not os.path.exists(safe_cert_path):
            shutil.copy(certifi.where(), safe_cert_path)
        os.environ['CURL_CA_BUNDLE'] = safe_cert_path
        os.environ['SSL_CERT_FILE'] = safe_cert_path
        os.environ['REQUESTS_CA_BUNDLE'] = safe_cert_path
    except Exception as e:
        print(f"⚠️ SSL Fix Failed: {e}")

    # 2. Fix Cache Path
    try:
        safe_cache_path = "C:\\Users\\Public\\yfinance_cache"
        if not os.path.exists(safe_cache_path):
             os.makedirs(safe_cache_path)
        os.environ['YFINANCE_CACHE_DIR'] = safe_cache_path
    except Exception as e:
        print(f"⚠️ Cache Fix Failed: {e}")

    try:
        data = yf.Ticker(ticker)
        df = data.history(period=period)
        
        if df.empty:
            print(f"⚠️ Empty data, retrying {ticker}...")
            data = yf.Ticker(ticker)
            df = data.history(period=period)
        
        if df.empty:
             raise ValueError(f"No data found for {ticker}")
            
        return df
        
    except Exception as e:
        traceback.print_exc()
        print(f"❌ Error fetching {ticker}: {e}")
        raise e

async def fetch_price_history(symbol: str, period: str = "1y") -> pd.DataFrame:
    """
    Main Entry Point. Routes symbols to scrapers if yfinance fails or is rate-limited.
    """
    # Special Handling for Mini-Taiex (Live Night Session)
    if symbol == "MTX":
        print("🌙 Fetching Night Market Data for Mini-Taiex...")
        live_df = fetch_yahoo_realtime("WTX%26") 
        history_df = None
        try:
            history_df = await fetch_history_internal("MTX", period=period)
        except:
            pass
            
        if live_df is not None and history_df is not None:
             last_idx = history_df.index[-1]
             live_price = live_df['Close'].iloc[0]
             history_df.at[last_idx, 'Close'] = live_price
             history_df.at[last_idx, 'High'] = max(history_df.at[last_idx, 'High'], live_price)
             history_df.at[last_idx, 'Low'] = min(history_df.at[last_idx, 'Low'], live_price)
             if 'DayChange' in live_df.columns:
                 if 'DayChange' not in history_df.columns: history_df['DayChange'] = pd.NA
                 history_df.at[last_idx, 'DayChange'] = live_df['DayChange'].iloc[0]
             return history_df
        elif live_df is not None:
            return live_df
        elif history_df is not None:
            return history_df

    # Normal Flow with Scraper Fallback for Taiwan Stocks
    try:
        return await fetch_history_internal(symbol, period)
    except Exception as e:
        # If yfinance fails and it's a Taiwan stock, try the scraper
        if ".TW" in str(SYMBOL_MAP.get(symbol.upper(), symbol)):
            print(f"⚠️ yfinance failed for {symbol}, trying scraper fallback...")
            ticker = SYMBOL_MAP.get(symbol.upper(), symbol)
            live_df = fetch_yahoo_realtime(ticker)
            if live_df is not None:
                return live_df
        # Re-raise if no fallback worked
        raise e

async def fetch_options_summary(index_price: float):
    """
    V5 Helper: Calculate nearest OTM Puts for insurance.
    Returns Weekly, Monthly 500, and Monthly 1000 OTM targets.
    """
    try:
        # Round to nearest 100
        base_strike = round(index_price / 100) * 100
        
        # Weekly OTM (approx 200 points out)
        w_strike = base_strike - 200
        # Monthly OTM 500
        m500_strike = base_strike - 500
        # Monthly OTM 1000
        m1000_strike = base_strike - 1000
        
        return {
            "weekly": {
                "strike": f"{w_strike} P",
                "price": round(max(20, (index_price - w_strike) * 0.12), 1),
                "iv": 18.5
            },
            "monthly_500": {
                "label": "月 500 避險",
                "strike": f"{m500_strike} P",
                "price": round(max(150, (index_price - m500_strike) * 0.35), 1),
                "iv": 16.8
            },
            "monthly_1000": {
                "label": "月 1000 避險",
                "strike": f"{m1000_strike} P",
                "price": round(max(60, (index_price - m1000_strike) * 0.18), 1),
                "iv": 15.2
            }
        }
    except:
        return None

# Normal Flow
    return await fetch_history_internal(symbol, period)
