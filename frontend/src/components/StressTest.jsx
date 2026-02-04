import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';

const StressTest = ({ portfolio, indexPrice = 23000 }) => {
    const [marketChange, setMarketChange] = useState(0); // Points: -2000 to +2000
    const [simulatedPnL, setSimulatedPnL] = useState(0);
    const [simulatedNetWorth, setSimulatedNetWorth] = useState(0);

    const currentNetWorth = portfolio.reduce((sum, item) => sum + (item.market_value || 0), 0);
    const INDEX_PRICE = indexPrice; // Use prop


    // Detailed Breakdown State
    const [breakdown, setBreakdown] = useState([]);

    useEffect(() => {
        let totalImpact = 0;
        const pctChange = marketChange / INDEX_PRICE;
        const newBreakdown = [];

        portfolio.forEach(item => {
            let impact = 0;
            let leverage = 1;
            let note = "";

            // Normalize Symbol for robust check
            const sym = String(item.symbol || "").toUpperCase().trim();

            if (sym.includes('00631L')) {
                leverage = 2;
                impact = (item.market_value || 0) * pctChange * 2;
                note = "2x Lev";
            } else if (sym === 'MTX' || sym === 'TX') {
                // Futures move directly with points
                leverage = 50; // Points multiplier
                impact = item.shares * marketChange * 50;
                note = "$50/Pt";
            } else if (sym === 'CASH') {
                impact = 0;
                leverage = 0;
                note = "Risk Free";
            } else {
                // Default 1x correlation for 0050/Stocks
                impact = (item.market_value || 0) * pctChange;
                note = "1x Beta";
            }

            totalImpact += impact;

            newBreakdown.push({
                ...item,
                leverageLabel: note,
                estPnL: impact
            });
        });

        setBreakdown(newBreakdown);
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

            <div className="grid grid-cols-2 gap-4 mb-6">
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

            {/* Detailed Breakdown Table */}
            <div className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
                <table className="w-full text-xs text-left">
                    <thead className="bg-white/5 text-gray-400 uppercase">
                        <tr>
                            <th className="p-2">Asset</th>
                            <th className="p-2 text-right">Value</th>
                            <th className="p-2 text-center">Factor</th>
                            <th className="p-2 text-right">Est. Impact</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {breakdown.map((item, idx) => (
                            <tr key={idx} className="hover:bg-white/5">
                                <td className="p-2 font-bold text-gray-300">{item.symbol}</td>
                                <td className="p-2 text-right font-mono text-gray-400">${Math.round(item.market_value || 0).toLocaleString()}</td>
                                <td className="p-2 text-center text-blue-400 font-bold bg-blue-900/20 rounded px-1">{item.leverageLabel}</td>
                                <td className={`p-2 text-right font-bold ${item.estPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    ${Math.round(item.estPnL).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 text-[10px] text-gray-500 italic text-center opacity-70">
                * Calculation based on Index Base: {INDEX_PRICE}.
                00631L assumed 2x leverage.
            </div>
        </div>
    );
};

export default StressTest;
