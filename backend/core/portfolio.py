import json
import os
import uuid
from datetime import datetime

# Define data path
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
PORTFOLIO_FILE = os.path.join(DATA_DIR, "portfolio.json")

# Ensure data directory exists
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

def load_portfolio():
    if not os.path.exists(PORTFOLIO_FILE):
        return []
    try:
        with open(PORTFOLIO_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return []

def save_portfolio(data):
    with open(PORTFOLIO_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)

def add_position(symbol: str, shares: float, avg_cost: float):
    portfolio = load_portfolio()
    new_position = {
        "id": str(uuid.uuid4()),
        "symbol": symbol.upper(),
        "shares": float(shares),
        "avg_cost": float(avg_cost),
        "created_at": datetime.now().isoformat()
    }
    portfolio.append(new_position)
    save_portfolio(portfolio)
    return new_position

def delete_position(position_id: str):
    portfolio = load_portfolio()
    portfolio = [p for p in portfolio if p['id'] != position_id]
    save_portfolio(portfolio)
    return {"status": "success", "id": position_id}

def get_portfolio_summary():
    """
    Returns the list of holdings. 
    Note: Real-time price calculation happens in the API layer or Engine, 
    this just returns the inventory.
    """
    return load_portfolio()
