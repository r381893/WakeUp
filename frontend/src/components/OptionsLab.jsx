import React, { useState } from 'react';
import { Activity, TrendingUp, TrendingDown, DollarSign, BarChart2, Shield } from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

const OptionsLab = ({ API_URL, symbol }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [initialCapital, setInitialCapital] = useState(100000);
    const [period, setPeriod] = useState('1y');

    const runSimulation = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/simulate/options/${symbol}?period=${period}&initial_capital=${initialCapital}`);
            const data = await res.json();

            if (data.detail) {
                console.error("Backend Error:", data.detail);
                setError(data.detail);
            } else {
                setResult(data);
            }
        } catch (error) {
            console.error("Simulation failed:", error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    // Prepare Chart Data
    const chartData = result?.equity_curve ? result.equity_curve.map((val, idx) => ({
        idx: idx,
        equity: val
    })) : [];

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
            {/* Controls */}
            <div className="flex flex-wrap justify-center gap-4 mb-8">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">初始資金:</span>
                    <input type="number" className="w-24 bg-black/50 border border-white/20 rounded px-2 py-1 text-white text-center" value={initialCapital} onChange={e => setInitialCapital(e.target.value)} />
                </div>
                <select className="bg-black/50 border border-white/20 rounded px-2 py-1 text-xs text-white" value={period} onChange={e => setPeriod(e.target.value)}>
                    <option value="1y">1Y</option>
                    <option value="2y">2Y</option>
                </select>
                <button onClick={runSimulation} className="px-6 py-1 bg-purple-600 rounded-lg text-xs font-bold text-white hover:bg-purple-500 transition shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                    Run Vol Strategy
                </button>
            </div>

            {loading ? (
                <div className="animate-pulse text-purple-400">Simulating Volatility Strategies...</div>
            ) : error ? (
                <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-200 text-sm">
                    Simulation Error: {error}
                </div>
            ) : result && result.final_equity !== undefined ? (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-white/5 rounded-xl border border-white/10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-20"><DollarSign /></div>
                            <div className="text-gray-400 text-[10px] uppercase">Final Equity</div>
                            <div className="text-2xl font-bold text-white">${result.final_equity.toLocaleString()}</div>
                            <div className={`text-xs ${result.final_equity >= initialCapital ? 'text-green-400' : 'text-red-400'}`}>
                                {((result.final_equity - initialCapital) / initialCapital * 100).toFixed(1)}% Return
                            </div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-xl border border-white/10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-20"><TrendingUp /></div>
                            <div className="text-gray-400 text-[10px] uppercase">Win Rate</div>
                            <div className="text-2xl font-bold text-purple-400">{result.win_rate}%</div>
                            <div className="text-xs text-gray-500">{result.total_trades} Trades</div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-xl border border-white/10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-20"><Shield /></div>
                            <div className="text-gray-400 text-[10px] uppercase">Strategy Type</div>
                            <div className="text-lg font-bold text-white">Long/Short Vol</div>
                            <div className="text-[10px] text-gray-500">Based on HV20 Signal</div>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="h-[250px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="idx" hide />
                                <YAxis domain={['auto', 'auto']} stroke="#666" fontSize={10} tickFormatter={val => `$${val / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value) => [`$${value.toLocaleString()}`, 'Equity']}
                                />
                                <Line type="monotone" dataKey="equity" stroke="#A855F7" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Trade Log */}
                    <div className="glass-card overflow-hidden mt-6">
                        <div className="bg-white/5 p-3 text-xs font-bold text-gray-300 uppercase">
                            Recent Option Trades
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="text-gray-500 sticky top-0 bg-[#0f0f13]">
                                    <tr>
                                        <th className="p-2">Date</th>
                                        <th className="p-2">Type</th>
                                        <th className="p-2">Strike</th>
                                        <th className="p-2">Entry Vol</th>
                                        <th className="p-2 text-right">PnL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {result.trades.slice().reverse().map((t, i) => (
                                        <tr key={i} className="hover:bg-white/5">
                                            <td className="p-2 text-gray-400">{t.entry_date}</td>
                                            <td className={`p-2 font-bold ${t.type === 'LONG_STRADDLE' ? 'text-green-400' : 'text-red-400'}`}>
                                                {t.type === 'LONG_STRADDLE' ? 'Long Straddle' : 'Short Strangle'}
                                            </td>
                                            <td className="p-2 text-gray-300">{t.strike}</td>
                                            <td className="p-2 text-gray-400">{t.entry_vol.toFixed(1)}%</td>
                                            <td className={`p-2 text-right font-mono font-bold ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {t.pnl >= 0 ? '+' : ''}{Math.round(t.pnl)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
};

export default OptionsLab;
