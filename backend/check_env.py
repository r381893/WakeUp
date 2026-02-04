print("--- Python Environment Check ---")
import sys
print(f"Python Version: {sys.version}")

try:
    print("Checking FastAPI...")
    import fastapi
    print("✅ FastAPI Installed")
except ImportError as e:
    print(f"❌ FastAPI Missing: {e}")

try:
    print("Checking Pandas...")
    import pandas
    print("✅ Pandas Installed")
except ImportError as e:
    print(f"❌ Pandas Missing: {e}")

try:
    print("Checking yfinance...")
    import yfinance
    print("✅ yfinance Installed")
except ImportError as e:
    print(f"❌ yfinance Missing: {e}")

print("--- End Check ---")
