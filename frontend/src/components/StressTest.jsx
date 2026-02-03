import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';

const StressTest = ({ portfolio, indexPrice = 23000 }) => {
    const [marketChange, setMarketChange] = useState(0); // Points: -2000 to +2000
    const [simulatedPnL, setSimulatedPnL] = useState(0);
    const [simulatedNetWorth, setSimulatedNetWorth] = useState(0);

    const currentNetWorth = portfolio.reduce((sum, item) => sum + (item.market_value || 0), 0);
    const INDEX_PRICE = indexPrice; // Use prop

    useEffect(() => {
        let totalImpact = 0;
        const pctChange = marketChange / INDEX_PRICE;

        portfolio.forEach(item => {
            let impact = 0;
            // Logic: 
            // 00631L (2X Bull) => Market % * 2 * Value
            // 0050 (1X) => Market % * 1 * Value
            // MTX (Futures) => Points * 50 * Shares
            // CASH => 0

            if (item.symbol.includes('00631L')) {
                impact = (item.market_value || 0) * pctChange * 2;
            } else if (item.symbol === 'MTX') {
                // Futures move directly with points
                impact = item.shares * marketChange * 50;
            } else if (item.symbol === 'CASH') {
                impact = 0;
            } else {
                // Default 1x correlation for 0050/Stocks
                impact = (item.market_value || 0) * pctChange;
            }
            totalImpact += impact;
        });
        setSimulatedPnL(totalImpact);
        setSimulatedNetWorth(currentNetWorth + totalImpact);
    }, [marketChange, portfolio, currentNetWorth]);

    return (
        <div className="glass-card p-6 border-red-500/30 bg-red-900/10">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="text-red-500" />
                Stress Test (資產壓力測試)
            </h3>

            <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Market Scenario (大盤漲跌點數)</span>
                    <span className={`font-bold ${marketChange > 0 ? 'text-green-400' : marketChange < 0 ? 'text-red-400' : 'text-gray-200'}`}>
                        {marketChange > 0 ? '+' : ''}{marketChange} 點
                    </span>
                </div>
                <input
                    type="range"
                    min="-2000"
                    max="2000"
                    step="50"
                    value={marketChange}
                    onChange={(e) => setMarketChange(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>CRASH (-2000)</span>
                    <span>FLAT (0)</span>
                    <span>BOOM (+2000)</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-black/40 rounded-xl border border-white/10">
                    <div className="text-xs text-gray-400 uppercase">Simulated PnL</div>
                    <div className={`text-2xl font-bold flex items-center gap-2 ${simulatedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {simulatedPnL >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                        ${Math.round(simulatedPnL).toLocaleString()}
                    </div>
                </div>
                <div className="p-4 bg-black/40 rounded-xl border border-white/10">
                    <div className="text-xs text-gray-400 uppercase">Final Net Worth</div>
                    <div className="text-2xl font-bold text-white">
                        ${Math.round(simulatedNetWorth).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                        Current: ${Math.round(currentNetWorth).toLocaleString()}
                    </div>
                </div>
            </div>

            <div className="mt-4 text-xs text-gray-500 italic text-center">
                * 假設大盤基數 {INDEX_PRICE}, 00631L 為 2 倍槓桿, 期貨每點 $50.
            </div>
        </div>
    );
};

export default StressTest;
