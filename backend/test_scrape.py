
import requests
from bs4 import BeautifulSoup
import re

url = "https://tw.stock.yahoo.com/quote/WTX%26"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

try:
    print(f"Scraping {url}...")
    res = requests.get(url, headers=headers)
    print(f"Status Code: {res.status_code}")
    
    # Try to find the price in plain HTML (unlikely if it's SPA, but worth a shot)
    soup = BeautifulSoup(res.text, "html.parser")
    
    # Look for the big price number usually in classes like Fz(32px)
    soup = BeautifulSoup(res.text, "html.parser")
    price_tag = soup.select_one(".Fz\(32px\)")
    if price_tag:
        print(f"Price: {price_tag.text}")
        
        # Try to find the change (usually in the parent or nearby)
        # Use simple text search in the container
        container = price_tag.parent
        if container:
            text = container.text
            print(f"Container Text: {text}")
            import re
            # Match pattern like "▲335 (1.05%)"
            match = re.search(r'([▲▼\+\-]?\s*\d+\.?\d*)\s*\(.*?%\)', text)
            if match:
                print(f"Extracted Change: {match.group(1)}")
            else:
                print("Change not found in container text.")
    else:
        print("Price tag not found.")
       
except Exception as e:
    print(f"Error: {e}")
