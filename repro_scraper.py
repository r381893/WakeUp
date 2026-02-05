
import requests
from bs4 import BeautifulSoup
import re

def fetch_yahoo_realtime(symbol):
    url = f"https://tw.stock.yahoo.com/quote/{symbol}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    print(f"🕵️ Scraping Real-Time Data from {url}...")
    res = requests.get(url, headers=headers, timeout=5)
    
    if res.status_code != 200:
        print("Status code not 200")
        return None
        
    soup = BeautifulSoup(res.text, "html.parser")
    
    # Selectors for Price (Big Number)
    selectors = [".Fz\\(32px\\)", ".Fz\\(42px\\)", "[class*='Fz(32px)']", "[class*='Fz(42px)']"]
    
    for sel in selectors:
        tag = soup.select_one(sel)
        if tag:
            print(f"--- Price Element Found ({sel}) ---")
            print(f"Price Text: {tag.text}")
            
            container = tag.parent
            if container:
                print(f"--- Container HTML ---")
                print(container.prettify())
                
                # Check for trend classes
                down = container.select_one('[class*="C($c-trend-down)"]')
                up = container.select_one('[class*="C($c-trend-up)"]')
                
                if down: print("📉 Detected Down Trend Class")
                if up: print("📈 Detected Up Trend Class")
                
            break

if __name__ == "__main__":
    # Test on a known index or stock
    fetch_yahoo_realtime("WTX%26")
