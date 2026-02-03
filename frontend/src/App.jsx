import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    LineChart as LineChartIcon,
    Wallet,
    FlaskConical,
    Plus,
    Trash2,
    ChevronUp,
    ChevronDown,
    Zap,
    Shield,
    Activity,
    Cpu,
    ShieldAlert,
    BrainCircuit,
    BarChart2,
    RotateCcw,
    Table
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// --- Black-Scholes Helper ---
const calculateOptionPrice = (type, S, K, T, r, sigma) => {
    if (!K || !S || !sigma || isNaN(K) || isNaN(S) || isNaN(sigma)) return 0;
    const CND = (x) => {
        const a1 = 0.31938153, a2 = -0.356563782, a3 = 1.781477937;
        const a4 = -1.821255978, a5 = 1.330274429;
        const p = 0.2316419;
        const k = 1 / (1 + p * Math.abs(x));
        const t = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
        const val = t * (a1 * k + a2 * Math.pow(k, 2) + a3 * Math.pow(k, 3) + a4 * Math.pow(k, 4) + a5 * Math.pow(k, 5));
        return x >= 0 ? 1 - val : val;
    };

    try {
        const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
        if (!isFinite(d1)) return 0;
        const d2 = d1 - sigma * Math.sqrt(T);
        const price = type === 'call'
            ? S * CND(d1) - K * Math.exp(-r * T) * CND(d2)
            : K * Math.exp(-r * T) * CND(-d2) - S * CND(-d1);
        return isNaN(price) ? 0 : price;
    } catch (e) {
        return 0;
    }
};
import Dashboard from './components/Dashboard';
import StressTest from './components/StressTest';

// V3 API URL
const API_URL = 'http://localhost:8000';

const ASSETS = [
    { id: '00631L', name: '00631L (2X Bull)' },
    { id: 'MTX', name: 'Mini Taiex (小台)' },
    { id: '0050', name: '0050 (TW50)' },
    { id: 'TSM', name: 'TSMC (2330)' },
    { id: 'BTC', name: 'Bitcoin' },
    { id: 'CASH', name: 'Cash (TWD)' }
];

import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

function App() {
    const [activeTab, setActiveTab] = useState('monitor');
    const [selectedAsset, setSelectedAsset] = useState('00631L');

    // Data States
    const [monitorData, setMonitorData] = useState(null);
    const [labData, setLabData] = useState(null);
    const [portfolio, setPortfolio] = useState([]);
    const [optionsData, setOptionsData] = useState(null);

    // Simulation State
    const [isSimulating, setIsSimulating] = useState(() => {
        return localStorage.getItem('isSimulating') === 'true';
    });
    const [simOptions, setSimOptions] = useState(null);

    // Parameter States
    const [strategy, setStrategy] = useState('ma_long');
    const [maPeriod, setMaPeriod] = useState(60);
    const [leverage, setLeverage] = useState(1);
    const [customSymbol, setCustomSymbol] = useState('');

    // UI States
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);

    // Scenario Analysis State
    const [analysisTarget, setAnalysisTarget] = useState(null); // { label, strike, iv, side, expiry, index_price }

    // Form State
    const [newPos, setNewPos] = useState({ symbol: '00631L', shares: '', avg_cost: '' });
    const [side, setSide] = useState('long');

    // --- Fetchers ---

    const fetchMonitorData = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_URL}/api/analyze/${selectedAsset}?t=${Date.now()}`);
            if (!res.ok) throw new Error("Backend Error");
            const json = await res.json();
            setMonitorData(json);
        } catch (e) {
            console.error(e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // Firebase: Load Portfolio
    const fetchPortfolio = async () => {
        try {
            // First try fetching real-time data from backend to enrich prices
            const res = await fetch(`${API_URL}/api/portfolio?t=${Date.now()}`);
            if (res.ok) {
                const json = await res.json();
                setPortfolio(json);
            }

            // Overwrite with Firebase Data if available (Sync)
            // Ideally we should merge: Firebase stores shares/cost, Backend enriches price.
            // For now, let's keep using backend for Portfolio as it calculates live PnL.
            // But we should SAVE new positions to Backend (which saves to local JSON) OR Firebase.
            // User requested Firebase to solve data loss. 
            // Strategy: 
            // 1. Settings (simOptions) -> Firebase (Critical)
            // 2. Portfolio -> Backend (JSON) is fine if moved to HDD. 
            // Let's focus on Settings first which was the main complaint.
        } catch (e) { console.error(e); }
    };

    const fetchOptionsData = async () => {
        try {
            const res = await fetch(`${API_URL}/api/options?t=${Date.now()}`);
            if (res.ok) {
                const json = await res.json();
                setOptionsData(json);
                if (!simOptions) {
                    // Try convert to default if nothing saved
                    setSimOptions(json);
                }
            }
        } catch (e) { console.error(e); }
    };

    const fetchLabData = async () => {
        try {
            setLoading(true);
            setLabData(null);
            const targetSymbol = customSymbol.trim() || selectedAsset;
            const res = await fetch(`${API_URL}/api/simulate/${targetSymbol}?strategy=${strategy}&ma_period=${maPeriod}&leverage=${leverage}&t=${Date.now()}`);
            if (!res.ok) throw new Error("Simulation Failed");
            const json = await res.json();
            setLabData(json);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddPosition = async (e) => {
        e.preventDefault();
        try {
            const finalShares = side === 'short' ? -Math.abs(Number(newPos.shares)) : Math.abs(Number(newPos.shares));
            const payload = { ...newPos, shares: finalShares };
            await fetch(`${API_URL}/api/portfolio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            setShowAddModal(false);
            setNewPos({ symbol: '00631L', shares: '', avg_cost: '' });
            setSide('long');
            fetchPortfolio();
        } catch (e) { alert("Failed to add"); }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this position?")) return;
        await fetch(`${API_URL}/api/portfolio/${id}`, { method: 'DELETE' });
        fetchPortfolio();
    };

    // --- Effects ---

    useEffect(() => {
        localStorage.setItem('isSimulating', isSimulating);
    }, [isSimulating]);

    // LOAD Settings from Firebase
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const docRef = doc(db, "settings", "user_default");
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    console.log("Loaded settings from Firebase:", docSnap.data());
                    setSimOptions(docSnap.data());
                } else {
                    console.log("No settings found in Firebase, loading from Backend...");
                    // Fallback to Backend API
                    fetch(`${API_URL}/api/settings`)
                        .then(res => res.json())
                        .then(data => {
                            if (data && (data.weekly || data.index_price)) {
                                setSimOptions(data);
                            }
                        });
                }
            } catch (e) {
                console.error("Firebase Load Error:", e);
                // Fallback on error
                fetch(`${API_URL}/api/settings`)
                    .then(res => res.json())
                    .then(data => setSimOptions(data));
            }
        };
        loadSettings();
    }, []);

    // SAVE Settings to Firebase (Debounced)
    useEffect(() => {
        if (!simOptions) return;
        const timer = setTimeout(async () => {
            try {
                // Save to Backend (Backup)
                fetch(`${API_URL}/api/settings`, {
                    method: 'POST',
                    body: JSON.stringify(simOptions),
                    headers: { 'Content-Type': 'application/json' }
                });

                // Save to Firebase (Primary Persistence)
                await setDoc(doc(db, "settings", "user_default"), simOptions);
                console.log("Saved to Firebase");
            } catch (e) {
                console.error("Firebase Save Error:", e);
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [simOptions]);

    useEffect(() => {
        if (activeTab === 'monitor') {
            fetchMonitorData();
            const interval = setInterval(fetchMonitorData, 10000);
            return () => clearInterval(interval);
        } else if (activeTab === 'lab') {
            fetchLabData();
        } else if (activeTab === 'portfolio') {
            fetchPortfolio();
        } else if (activeTab === 'advisor') {
            fetchPortfolio();
            fetchMonitorData();
            fetchOptionsData();
        }
    }, [activeTab, selectedAsset]);

    // --- Helpers ---

    const getStatusColor = (status) => {
        if (status === 'BULL') return '#00ff9d';
        if (status === 'BEAR') return '#ff0055';
        return '#ffdd00';
    };

    const activeOptions = isSimulating ? simOptions : optionsData;

    return (
        <div className="container mx-auto p-4 md:p-6 max-w-6xl min-h-screen text-gray-200 pb-20 md:pb-6 font-sans">

            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2 tracking-tighter text-white">
                    <Cpu className="text-blue-500 w-6 h-6 md:w-8 md:h-8" /> WEALTH-OS <span className="text-xs opacity-50 px-2 py-1 bg-white/10 rounded">V3 PRO</span>
                </h1>

                {/* Asset Selector */}
                {activeTab !== 'portfolio' && activeTab !== 'advisor' && (
                    <div className="flex bg-black/40 rounded-full p-1 border border-white/10 backdrop-blur-md overflow-x-auto max-w-full">
                        {ASSETS.map(asset => (
                            <button
                                key={asset.id}
                                onClick={() => setSelectedAsset(asset.id)}
                                className={`px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm whitespace-nowrap rounded-full transition-all ${selectedAsset === asset.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                {asset.name}
                            </button>
                        ))}
                    </div>
                )}
            </header>

            {/* Navigation Tabs */}
            <div className="fixed bottom-0 left-0 w-full md:relative md:w-auto md:bg-transparent md:border-none bg-black/90 border-t border-white/10 backdrop-blur-xl z-50 p-2 md:p-0 flex justify-center md:justify-end gap-2 md:mb-8">
                {[
                    { id: 'monitor', label: '及時監控', icon: <Activity size={18} /> },
                    { id: 'portfolio', label: '投資組合', icon: <Wallet size={18} /> },
                    { id: 'lab', label: '策略實驗室', icon: <Zap size={18} /> },
                    { id: 'advisor', label: '智能顧問', icon: <Shield size={18} /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 md:py-2 rounded-xl transition font-medium border ${activeTab === tab.id ? 'bg-white/10 text-white border-white/20' : 'border-transparent text-gray-500 hover:text-white'}`}
                    >
                        {tab.icon}
                        <span className="text-sm">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Error Banner */}
            {error && <div className="mb-6 p-3 bg-red-500/10 border border-red-500/40 rounded-xl text-red-200 text-sm flex items-center gap-2"><ShieldAlert size={16} /> {error}</div>}

            <AnimatePresence mode="wait">

                {/* --- MONITOR TAB (DASHBOARD) --- */}
                {activeTab === 'monitor' && (
                    <Dashboard
                        monitorData={monitorData}
                        portfolio={portfolio}
                        activeOptions={activeOptions}
                    />
                )}

                {/* --- PORTFOLIO TAB --- */}
                {activeTab === 'portfolio' && (
                    <motion.div key="portfolio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="grid md:grid-cols-2 gap-4 mb-6">
                            <div className="glass-card p-6 flex items-center justify-between">
                                <div><div className="text-gray-400 text-xs uppercase mb-1">Total Positions</div><div className="text-3xl font-bold text-white">{portfolio.length}</div></div>
                                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400"><Wallet /></div>
                            </div>
                            <div className="glass-card p-6 flex items-center justify-center cursor-pointer hover:bg-white/5 transition" onClick={() => setShowAddModal(true)}>
                                <div className="flex flex-col items-center gap-2 text-blue-400"><Plus size={32} /><span className="font-bold">Add Position</span></div>
                            </div>
                        </div>

                        <div className="glass-card overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-white/5 text-gray-400 text-xs uppercase">
                                    <tr>
                                        <th className="p-4">商品 (Asset)</th>
                                        <th className="p-4 text-right">成本 (Cost)</th>
                                        <th className="p-4 text-right">現價 (Price)</th>
                                        <th className="p-4 text-right">數量 (Shares)</th>
                                        <th className="p-4 text-right">損益 (PnL)</th>
                                        <th className="p-4 text-right">動作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {portfolio.map(item => (
                                        <tr key={item.id} className="hover:bg-white/5 transition">
                                            <td className="p-4 font-bold text-white">{item.symbol}</td>
                                            <td className="p-4 text-right text-gray-400 font-mono">${item.avg_cost?.toLocaleString()}</td>
                                            <td className="p-4 text-right text-white font-mono font-bold">${item.current_price?.toLocaleString()}</td>
                                            <td className="p-4 text-right text-yellow-400">{item.shares}</td>
                                            <td className={`p-4 text-right font-bold ${item.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                <div className="flex flex-col items-end">
                                                    <span>${item.pnl?.toLocaleString()}</span>
                                                    <span className="text-[10px] opacity-70">({item.pnl_pct}%)</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right"><button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {/* --- LAB TAB --- */}
                {activeTab === 'lab' && (
                    <motion.div key="lab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass-card p-6 md:p-8 text-center">
                        <h2 className="text-2xl font-bold text-white mb-6">Strategy Simulator</h2>
                        <div className="flex flex-wrap justify-center gap-4 mb-8">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">Ticker:</span>
                                <input type="text" className="w-20 bg-black/50 border border-white/20 rounded px-2 py-1 text-white uppercase" value={customSymbol} onChange={e => setCustomSymbol(e.target.value)} placeholder={selectedAsset} />
                            </div>
                            <select className="bg-black/50 border border-white/20 rounded px-2 py-1 text-xs text-white" value={strategy} onChange={e => setStrategy(e.target.value)}>
                                <option value="ma_trend">MA Trend</option><option value="ma_long">MA Long</option><option value="buy_hold">Buy & Hold</option>
                            </select>
                            <input type="number" className="w-16 bg-black/50 border border-white/20 rounded px-2 py-1 text-white text-center" value={maPeriod} onChange={e => setMaPeriod(e.target.value)} />
                            <button onClick={fetchLabData} className="px-6 py-1 bg-blue-600 rounded-lg text-xs font-bold text-white">Backtest</button>
                        </div>

                        {loading ? <div className="animate-pulse text-blue-400">Processing...</div> : labData && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div className="text-gray-400 text-[10px] uppercase">Final Equity</div>
                                    <div className="text-xl font-bold text-green-400">${labData.final_equity?.toLocaleString()}</div>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div className="text-gray-400 text-[10px] uppercase">CAGR</div>
                                    <div className="text-xl font-bold text-blue-400">{labData.cagr_percent}%</div>
                                    <div className="text-[10px] text-gray-500">BM: {labData.benchmark_cagr}%</div>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div className="text-gray-400 text-[10px] uppercase">MDD</div>
                                    <div className="text-xl font-bold text-red-400">{labData.mdd_percent}%</div>
                                    <div className="text-[10px] text-gray-500">BM: {labData.benchmark_mdd}%</div>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div className="text-gray-400 text-[10px] uppercase">Analytics</div>
                                    <div className="text-xl font-bold text-purple-400">{labData.win_rate}%</div>
                                    <div className="text-[10px] text-gray-500">{labData.total_trades} Trades</div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* --- ADVISOR TAB --- */}
                {activeTab === 'advisor' && (
                    <motion.div key="advisor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">

                        {/* Stress Test Module */}
                        <StressTest portfolio={portfolio} indexPrice={monitorData?.price || 23000} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Hedge Tool */}
                            <div className="glass-card p-6">
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Shield className="text-purple-400" /> Hedge Advisor</h3>
                                {portfolio.some(p => p.symbol === '00631L') ? (
                                    <div className="space-y-4">
                                        {portfolio.filter(p => p.symbol === '00631L').map(p => {
                                            const mtxPrice = activeOptions?.index_price || 23000;
                                            const reqMtx = (p.market_value / (mtxPrice * 50)) * 2;
                                            return (
                                                <div key={p.id} className="p-4 bg-white/5 rounded-xl border border-white/10">
                                                    <div className="flex justify-between text-xs mb-1"><span className="text-gray-400">Current Position (00631L)</span> <span className="text-purple-400 font-bold">Delta Neutral</span></div>
                                                    <div className="text-2xl font-bold text-white">{reqMtx.toFixed(2)} <span className="text-xs text-gray-400">Contracts (MTX)</span></div>
                                                    <p className="text-[10px] text-gray-500 mt-2">Short ~{Math.round(reqMtx)} MTX to hedge this position against market crashes.</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : <div className="text-center py-6 text-gray-600 italic text-sm">No 00631L positions in portfolio.</div>}
                            </div>

                            {/* Rebalance Tool */}
                            <div className="glass-card p-6">
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Zap className="text-yellow-400" /> Smart Rebalance (80/20)</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-sm"><span className="text-gray-400">Net Worth</span> <span className="text-white font-bold">${portfolio.reduce((s, p) => s + (p.market_value || 0), 0).toLocaleString()}</span></div>
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                        <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden mb-2"><div className="bg-blue-500 h-full" style={{ width: '80%' }}></div></div>
                                        <div className="flex justify-between text-[10px] text-gray-500"><span>EQUITY (Target 80%)</span><span>CASH (Target 20%)</span></div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const total = portfolio.reduce((s, p) => s + (p.market_value || 0), 0);
                                            const currentEquity = portfolio.filter(p => p.symbol !== 'CASH').reduce((s, p) => s + (p.market_value || 0), 0);
                                            const target = total * 0.8;
                                            const diff = target - currentEquity;
                                            const etfPrice = monitorData?.price || 200;
                                            const shares = Math.round(diff / etfPrice);
                                            alert(`再平衡計畫：\n總資產: $${total.toLocaleString()}\n目標股票市值: $${target.toLocaleString()}\n當前股票市值: $${currentEquity.toLocaleString()}\n\n操作建議: ${diff > 0 ? '買入' : '賣出'} ${Math.abs(shares)} 股 00631L`);
                                        }}
                                        className="w-full py-3 rounded-lg bg-blue-600/20 border border-blue-500/50 text-blue-400 font-bold hover:bg-blue-600/30 transition-all font-sans"
                                    >
                                        計算再平衡建議
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 選擇權監控 */}
                        {/* 選擇權監控 */}
                        <div className="glass-card p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Activity className="text-blue-400" /> 選擇權監控 (保險成本)
                                </h3>
                                <div className="flex gap-2">
                                    {/* Buttons Replaced by Scenario Analysis Table */}
                                    {/* Reset Button */}

                                    <button
                                        onClick={() => {
                                            // Force Reset to Market Data
                                            if (optionsData) {
                                                setSimOptions(JSON.parse(JSON.stringify(optionsData)));
                                                setIsSimulating(true);
                                            } else {
                                                alert("尚無市場資料可供重置 (No Market Data)");
                                            }
                                        }}
                                        className="px-3 py-1 rounded-full text-xs font-bold bg-gray-700 text-gray-300 hover:bg-gray-600 transition flex items-center gap-2"
                                        title="重置為市場現況"
                                    >
                                        <RotateCcw size={14} />
                                        重置 (Reset)
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!isSimulating && optionsData) setSimOptions(JSON.parse(JSON.stringify(optionsData)));
                                            setIsSimulating(!isSimulating);
                                        }}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-2 ${isSimulating ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
                                    >
                                        <BrainCircuit size={14} />
                                        {isSimulating ? '模擬中 (ON)' : '開啟模擬 (OFF)'}
                                    </button>
                                </div>
                            </div>


                            {/* Simulation Context - Index Price */}
                            {isSimulating && (
                                <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg flex flex-wrap items-center gap-4 animate-in fade-in slide-in-from-top-2">
                                    <span className="text-xs font-bold text-purple-300 uppercase">模擬大盤指數 (Simulated Index)</span>
                                    <input
                                        type="number"
                                        value={activeOptions?.index_price || ''}
                                        onChange={e => setSimOptions({ ...simOptions, index_price: Number(e.target.value) })}
                                        className="bg-black/50 border border-purple-500/30 rounded px-2 py-1 text-white text-sm w-32 font-mono focus:border-purple-500 outline-none transition"
                                    />
                                    <button
                                        onClick={() => optionsData?.index_price && setSimOptions({ ...simOptions, index_price: optionsData.index_price })}
                                        className="p-1.5 rounded-md hover:bg-white/10 text-purple-300 transition"
                                        title="同步即時大盤"
                                    >
                                        <Zap size={14} />
                                    </button>
                                    <span className="text-xs text-gray-500">此數值會即時影響上方「Hedge Advisor」的避險口數計算</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {['weekly', 'weekly_atm', 'monthly_200', 'monthly_500', 'monthly_1000', 'monthly_2000'].map(type => {
                                    const labels = {
                                        weekly: '週選價外 (OTM)',
                                        weekly_atm: '週選價平 (ATM)',
                                        monthly_200: '月 200 點避險',
                                        monthly_500: '月 500 點避險',
                                        monthly_1000: '月 1000 點避險',
                                        monthly_2000: '月 2000 點避險'
                                    };
                                    const sub = {
                                        weekly: '短線波動防護',
                                        weekly_atm: '短線趨勢跟單',
                                        monthly_200: '輕度回檔保險',
                                        monthly_500: '中度回檔保險',
                                        monthly_1000: '極端黑天鵝防護',
                                        monthly_2000: '毀滅性災難防護'
                                    };
                                    const colors = {
                                        weekly: 'text-red-400',
                                        weekly_atm: 'text-orange-400',
                                        monthly_200: 'text-yellow-400',
                                        monthly_500: 'text-red-500',
                                        monthly_1000: 'text-red-600',
                                        monthly_2000: 'text-red-700'
                                    };

                                    // Default Expiry Helper
                                    const getDefaultExpiry = (offsetDays) => {
                                        const d = new Date();
                                        d.setDate(d.getDate() + offsetDays);
                                        return d.toISOString().split('T')[0];
                                    };
                                    const defaultExpiries = {
                                        weekly: getDefaultExpiry(5),
                                        weekly_atm: getDefaultExpiry(5),
                                        monthly_200: getDefaultExpiry(25),
                                        monthly_500: getDefaultExpiry(25),
                                        monthly_1000: getDefaultExpiry(25),
                                        monthly_2000: getDefaultExpiry(25)
                                    };
                                    // Ensure data object exists
                                    const data = activeOptions?.[type] || {};
                                    // Use simOptions values if available, otherwise fallbacks
                                    const currentIV = data.iv || (type.includes('weekly') ? 18.5 : 16);
                                    const currentSide = data.side || 'put'; // Default to put

                                    // Auto-Populate Strike if missing (Fallback to ATM)
                                    if (isSimulating && !data.strike && activeOptions?.index_price) {
                                        // Find nearest 100
                                        const atm = Math.round(activeOptions.index_price / 100) * 100;
                                        // Don't set state during render, just use derived value
                                        // But wait, we need it in the input. 
                                        // For now, let's just make sure input handles it, or show '---'.
                                    }

                                    // Calculate DTE from Date
                                    const expiryDate = data.expiry || defaultExpiries[type];
                                    const today = new Date();
                                    const targetDate = new Date(expiryDate);
                                    const diffTime = targetDate - today;
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    const currentDays = Math.max(0, diffDays); // Ensure non-negative

                                    // Use Shared Helper
                                    const simulatedPrice = isSimulating
                                        ? calculateOptionPrice(currentSide, activeOptions?.index_price || 23000, data.strike, currentDays / 365.0, 0.015, currentIV / 100.0).toFixed(1)
                                        : data.price;

                                    return (
                                        <div key={type} className={`p-4 rounded-xl border transition-all ${isSimulating ? 'bg-purple-900/10 border-purple-500/30' : 'bg-black/40 border-white/10'}`}>
                                            <div className="text-[10px] text-gray-500 uppercase mb-2 flex justify-between items-center">
                                                <span>
                                                    {labels[type]}
                                                    {currentSide === 'put'
                                                        ? <span className="text-[9px] bg-red-500/20 text-red-400 px-1 rounded ml-1">PUT (賣權)</span>
                                                        : <span className="text-[9px] bg-green-500/20 text-green-400 px-1 rounded ml-1">CALL (買權)</span>
                                                    }
                                                </span>
                                                {isSimulating ? (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => setAnalysisTarget({
                                                                label: labels[type],
                                                                strike: data.strike,
                                                                iv: currentIV,
                                                                side: currentSide,
                                                                expiry: expiryDate,
                                                                index_price: activeOptions?.index_price || 23000
                                                            })}
                                                            className="text-purple-400 hover:text-white p-0.5 rounded transition"
                                                            title="開啟情境分析表格"
                                                        >
                                                            <Table size={14} />
                                                        </button>
                                                        <div className="flex gap-1 bg-black/40 rounded p-0.5 border border-white/10">
                                                            <button
                                                                onClick={() => setSimOptions({ ...simOptions, [type]: { ...data, side: 'call' } })}
                                                                className={`px-2 py-0.5 text-[9px] rounded transition ${currentSide === 'call' ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-white'}`}
                                                            >
                                                                CALL
                                                            </button>
                                                            <button
                                                                onClick={() => setSimOptions({ ...simOptions, [type]: { ...data, side: 'put' } })}
                                                                className={`px-2 py-0.5 text-[9px] rounded transition ${currentSide === 'put' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-white'}`}
                                                            >
                                                                PUT
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-purple-400 font-bold hidden"></span>
                                                )}
                                            </div>

                                            {isSimulating ? (
                                                <div className="space-y-3">
                                                    {/* Row 1: Strike & Price (Calculated) */}
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1">
                                                            <div className="text-[9px] text-gray-500 mb-1">履約價 (Strike)</div>
                                                            <input
                                                                type="number"
                                                                value={data.strike || ''}
                                                                onChange={e => setSimOptions({
                                                                    ...simOptions,
                                                                    [type]: { ...data, strike: Number(e.target.value) }
                                                                })}
                                                                className={`w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm font-bold outline-none focus:border-purple-500 transition ${colors[type]}`}
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-[9px] text-gray-500 mb-1">理論價格 (Price)</div>
                                                            <div className="w-full bg-purple-500/20 border border-purple-500/50 rounded px-2 py-1 text-sm text-purple-200 font-bold text-center">
                                                                {simulatedPrice}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Row 2: IV & Days */}
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1">
                                                            <div className="text-[9px] text-gray-500 mb-1">波動率 (IV %)</div>
                                                            <input
                                                                type="number"
                                                                value={currentIV}
                                                                onChange={e => setSimOptions({
                                                                    ...simOptions,
                                                                    [type]: { ...data, iv: Number(e.target.value) }
                                                                })}
                                                                className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-white text-center outline-none focus:border-blue-500 transition"
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-[9px] text-gray-500 mb-1">到期日 (Expiry)</div>
                                                            <input
                                                                type="date"
                                                                value={expiryDate}
                                                                onChange={e => setSimOptions({
                                                                    ...simOptions,
                                                                    [type]: { ...data, expiry: e.target.value }
                                                                })}
                                                                className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-white text-center outline-none focus:border-blue-500 transition"
                                                            />
                                                            <div className="text-[9px] text-gray-500 text-center mt-1">剩餘 {currentDays} 天</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className={`text-lg font-bold ${colors[type]}`}>{data.strike || "---"}</div>
                                                    <div className="text-xl font-bold text-white">{data.price || "---"} <span className="text-[10px] text-gray-500 font-normal">點</span></div>
                                                    <div className="flex justify-between mt-2 text-[9px]">
                                                        <span className="text-gray-600">{sub[type]}</span>
                                                        {data.iv && <span className="text-gray-500">IV: {data.iv}%</span>}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )
                                })}

                                <div className="flex flex-col items-center justify-center p-4 bg-blue-500/5 rounded-xl border border-blue-500/10 text-center">
                                    <div className="text-[10px] text-blue-300 font-bold uppercase mb-1">保險健康檢查</div>
                                    <div className="text-[9px] text-gray-500 italic mb-1">IV: {activeOptions?.weekly?.iv}% / {activeOptions?.monthly_1000?.iv}%</div>
                                    <div className="text-[10px] text-white/40 leading-tight">IV 低適合佈局<br />IV 高保險較貴</div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modals */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="glass-card w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Add Position</h3>
                        <form onSubmit={handleAddPosition} className="space-y-4">
                            <div className="flex bg-white/10 p-1 rounded-lg">
                                <button type="button" onClick={() => setSide('long')} className={`flex-1 py-2 rounded-md text-xs font-bold transition ${side === 'long' ? 'bg-green-500 text-black shadow-lg' : 'text-gray-400'}`}>LONG</button>
                                <button type="button" onClick={() => setSide('short')} className={`flex-1 py-2 rounded-md text-xs font-bold transition ${side === 'short' ? 'bg-red-500 text-white shadow-lg' : 'text-gray-400'}`}>SHORT</button>
                            </div>
                            <select className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white text-sm" value={newPos.symbol} onChange={e => setNewPos({ ...newPos, symbol: e.target.value })}>
                                {ASSETS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                            <input type="number" required className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white text-sm" value={newPos.shares} onChange={e => setNewPos({ ...newPos, shares: e.target.value })} placeholder="Number of Shares" />
                            <input type="number" required className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white text-sm" value={newPos.avg_cost} onChange={e => setNewPos({ ...newPos, avg_cost: e.target.value })} placeholder="Average Cost per Share" />
                            <div className="flex gap-3 mt-4">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-lg border border-white/10 text-gray-300 text-sm">Cancel</button>
                                <button type="submit" className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-bold text-sm">Save Position</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Analysis Modal */}
            {analysisTarget && <AnalysisModal target={analysisTarget} onClose={() => setAnalysisTarget(null)} />}
        </div>
    );
}

const AnalysisModal = ({ target, onClose }) => {
    if (!target) return null;

    const { label, strike, iv, side, expiry, index_price } = target;
    const moves = [-500, -300, -100, 0, 100, 300, 500];
    const today = new Date();
    const expiryDate = new Date(expiry);
    const totalDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

    // Generate dates: today, +1, +2... max 10 rows or until expiry
    const dates = [];
    // Show at most 7 days forecast to avoid overcrowding, or meaningful steps
    // If expiry is far, maybe show weekly steps? For now daily is fine for near term.
    for (let i = 0; i <= Math.min(totalDays, 14); i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const remaining = Math.max(0, totalDays - i);
        dates.push({ date: d.toISOString().split('T')[0], days: remaining });
    }

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[80] flex items-center justify-center p-4" onClick={onClose}>
            <div className="glass-card w-full max-w-5xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Table className="text-purple-400" />
                            情境分析 (Scenario Analysis)
                        </h3>
                        <div className="text-gray-400 text-sm mt-1 flex gap-4">
                            <span className="bg-white/10 px-2 py-1 rounded text-white">{label}</span>
                            <span>Strike: <span className="text-white">{strike}</span></span>
                            <span>IV: <span className="text-yellow-400">{iv}%</span></span>
                            <span>Type: <span className={side === 'call' ? 'text-green-400' : 'text-red-400'}>{side.toUpperCase()}</span></span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition"><Plus size={24} className="rotate-45 text-gray-400" /></button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse">
                        <thead>
                            <tr>
                                <th className="p-3 text-left text-gray-500 text-xs border-b border-white/10 min-w-[120px]">日期 (剩餘天數) \ 指數</th>
                                {moves.map(m => (
                                    <th key={m} className={`p-3 text-xs border-b border-white/10 ${m > 0 ? 'text-red-400' : m < 0 ? 'text-green-400' : 'text-white'}`}>
                                        <div className="font-bold text-sm">{m > 0 ? '+' : ''}{m}</div>
                                        <div className="text-[10px] opacity-50 font-mono">{index_price + m}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {dates.map((row, i) => (
                                <tr key={row.date} className="hover:bg-white/5 transition group">
                                    <td className="p-3 text-left text-gray-400 text-xs border-b border-white/5 font-mono group-hover:text-white transition-colors">
                                        {row.date} <span className="ml-1 opacity-50">({row.days}D)</span>
                                    </td>
                                    {moves.map(m => {
                                        const simulatedSpot = index_price + m;
                                        const price = calculateOptionPrice(side, simulatedSpot, strike, row.days / 365, 0.015, iv / 100);
                                        const priceStr = price.toFixed(1);

                                        return (
                                            <td key={m} className="p-3 border-b border-white/5">
                                                <div className={`font-bold font-mono transition-all ${m === 0 ? 'text-yellow-100' : 'text-white'}`}>{priceStr}</div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 text-xs text-gray-500 text-center">
                    * 價格基於 Black-Scholes 模型推算，假設 IV 與無風險利率不變。
                </div>
            </div>
        </div>
    );
};

export default App;
