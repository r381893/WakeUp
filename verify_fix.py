
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from core.fetcher import fetch_yahoo_realtime
    
    print("Testing fetch_yahoo_realtime for WTX& (Mini-Taiex Future)...")
    df = fetch_yahoo_realtime("WTX%26")
    
    if df is not None:
        print("\n--- Result ---")
        print(df)
        change = df['DayChange'].iloc[0]
        print(f"\nExtracted DayChange: {change}")
        
        if change < 0:
            print("✅ SUCCESS: Negative change detected!")
        else:
            print("❓ WARNING: Positive change. Ensure the market is actually up? If market is down, this is a fail.")
    else:
        print("❌ Failed to fetch data.")

except Exception as e:
    print(f"❌ Error: {e}")
