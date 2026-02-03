import asyncio
from core.fetcher import fetch_price_history
from core.portfolio import get_portfolio_summary

async def test():
    items = get_portfolio_summary()
    total_val = 0
    print("Enriching Portfolio...")
    for item in items:
        try:
            df = await fetch_price_history(item['symbol'], period="5d")
            price = df['Close'].iloc[-1]
            mult = 50 if item['symbol'] == 'MTX' else 1
            val = price * item['shares'] * mult
            total_val += val
            print(f"- {item['symbol']}: Price={round(price,2)}, Shares={item['shares']}, Value={round(val,0)}")
        except Exception as e:
            print(f"Error for {item['symbol']}: {e}")
    
    print(f"\nTotal Net Worth: {round(total_val, 0)}")

asyncio.run(test())
