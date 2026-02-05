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
import OptionsLab from './components/OptionsLab';

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
// V3 API URL
const API_URL = import.meta.env.PROD
    ? 'https://wealth-os-backend.onrender.com'
    : (import.meta.env.VITE_API_URL || 'http://localhost:8000');

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
    const [period, setPeriod] = useState('5y');
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
    const [saveStatus, setSaveStatus] = useState('idle'); // idle, saving, saved, error

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

    // State for Syncing
    const [isSyncing, setIsSyncing] = useState(false);

    // Sync Effect: Poll Backend every 10s if Sync is ON
    useEffect(() => {
        if (!isSyncing) return;

        const syncData = async () => {
            try {
                const res = await fetch(`${API_URL}/api/options`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.index_price) {
                        setSimOptions(prev => ({
                            ...prev,
                            index_price: Math.round(data.index_price)
                        }));
                    }
                }
            } catch (e) {
                console.error("Sync Failed:", e);
                // Don't turn off, just retry next time
            }
        };

        syncData(); // Initial call
        const interval = setInterval(syncData, 10000);
        return () => clearInterval(interval);
    }, [isSyncing]);

    // Firebase: Load Portfolio
    const fetchPortfolio = async () => {
        try {
            // Priority: Load from Firebase
            const docRef = doc(db, "portfolio", "user_positions");
            const docSnap = await getDoc(docRef);

            let localData = [];
            if (docSnap.exists()) {
                console.log("Loaded portfolio from Firebase");
                localData = docSnap.data().positions || [];
            }

            // Then enrich with real-time price from Backend
            // We successfully loaded shares/cost from Firebase, now we need current prices.
            try {
                const res = await fetch(`${API_URL}/api/portfolio?enrich_only=true`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(localData)
                });
                if (res.ok) {
                    const enriched = await res.json();
                    setPortfolio(enriched);
                } else {
                    // Fallback if backend is down: show just stored data
                    setPortfolio(localData);
                }
            } catch (err) {
                console.warn("Backend price enrichment failed, showing cached data", err);
                setPortfolio(localData);
            }
        } catch (e) { console.error("Portfolio Load Error:", e); }
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
            const res = await fetch(`${API_URL}/api/simulate/${targetSymbol}?strategy=${strategy}&ma_period=${maPeriod}&leverage=${leverage}&period=${period}&t=${Date.now()}`);
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
            const newEntry = {
                id: Date.now().toString(),
                symbol: newPos.symbol,
                shares: finalShares,
                avg_cost: Number(newPos.avg_cost)
            };

            // 1. Update Local State (Optimistic)
            const updatedPortfolio = [...portfolio, newEntry];
            setPortfolio(updatedPortfolio);

            // 2. Save to Firebase
            // We store the RAW data (without calculated PnL) to Firebase
            const rawData = updatedPortfolio.map(p => ({
                id: p.id,
                symbol: p.symbol,
                shares: p.shares,
                avg_cost: p.avg_cost
            }));
            await setDoc(doc(db, "portfolio", "user_positions"), { positions: rawData });

            setShowAddModal(false);
            setNewPos({ symbol: '00631L', shares: '', avg_cost: '' });
            setSide('long');

            // 3. Refresh (Enrichment)
            fetchPortfolio();
        } catch (e) {
            console.error(e);
            alert("Failed to save position");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this position?")) return;

        const updatedPortfolio = portfolio.filter(p => p.id !== id);
        setPortfolio(updatedPortfolio);

        const rawData = updatedPortfolio.map(p => ({
            id: p.id,
            symbol: p.symbol,
            shares: p.shares,
            avg_cost: p.avg_cost
        }));

        await setDoc(doc(db, "portfolio", "user_positions"), { positions: rawData });
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
                    const raw = docSnap.data();
                    // Clean legacy string data
                    const clean = { ...raw };
                    ['weekly', 'weekly_atm', 'monthly_200', 'monthly_500', 'monthly_1000', 'monthly_2000'].forEach(k => {
                        if (clean[k] && typeof clean[k].strike === 'string') {
                            clean[k].strike = parseInt(clean[k].strike.replace(/[^\d]/g, '')) || 0;
                        }
                    });
                    setSimOptions(clean);
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
        setSaveStatus('saving');
        const timer = setTimeout(async () => {
            try {
                // Save to Backend (Backup) - Fire and forget
                console.log("Saving to Backend...");
                fetch(`${API_URL}/api/settings`, {
                    method: 'POST',
                    body: JSON.stringify(simOptions),
                    headers: { 'Content-Type': 'application/json' }
                }).catch(err => console.warn("Backend save skipped:", err));

                // Save to Firebase (Primary Persistence)
                console.log("Saving to Firebase...");

                // Create a timeout promise
                const timeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Firebase write timed out")), 5000)
                );

                // Race setDoc against timeout
                await Promise.race([
                    setDoc(doc(db, "settings", "user_default"), simOptions),
                    timeout
                ]);

                console.log("Saved to Firebase successfully");
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } catch (e) {
                console.error("Firebase Save Error:", e);
                setSaveStatus('error');
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
                                <div><div className="text-gray-400 text-xs uppercase mb-1">總持倉 (Total Positions)</div><div className="text-3xl font-bold text-white">{portfolio.length}</div></div>
                                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400"><Wallet /></div>
                            </div>
                            <div className="glass-card p-6 flex items-center justify-center cursor-pointer hover:bg-white/5 transition" onClick={() => setShowAddModal(true)}>
                                <div className="flex flex-col items-center gap-2 text-blue-400"><Plus size={32} /><span className="font-bold">新增部位 (Add Position)</span></div>
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
                                <option value="ma_trend">MA Trend (趨勢交易)</option>
                                <option value="ma_long">MA Long (只做多)</option>
                                <option value="buy_hold">Buy & Hold (買入持有)</option>
                            </select>
                            <div className="flex items-center gap-1" title="Leverage">
                                <span className="text-xs text-gray-400">x</span>
                                <input type="number" step="0.5" min="1" max="5" className="w-12 bg-black/50 border border-white/20 rounded px-2 py-1 text-white text-center" value={leverage} onChange={e => setLeverage(e.target.value)} />
                            </div>
                            <div className="flex items-center gap-1" title="MA Period">
                                <span className="text-xs text-gray-400">MA</span>
                                <input type="number" className="w-16 bg-black/50 border border-white/20 rounded px-2 py-1 text-white text-center" value={maPeriod} onChange={e => setMaPeriod(e.target.value)} />
                            </div>
                            <select className="bg-black/50 border border-white/20 rounded px-2 py-1 text-xs text-white" value={period} onChange={e => setPeriod(e.target.value)}>
                                <option value="1y">1Y</option>
                                <option value="3y">3Y</option>
                                <option value="5y">5Y</option>
                                <option value="10y">10Y</option>
                                <option value="max">MAX</option>
                            </select>
                            <button onClick={fetchLabData} className="px-6 py-1 bg-blue-600 rounded-lg text-xs font-bold text-white hover:bg-blue-500 transition">Backtest</button>
                        </div>

                        {loading ? <div className="animate-pulse text-blue-400">Processing simulation...</div> : labData && (
                            <div className="space-y-6">
                                {/* Summary Stats */}
                                <div className="flex justify-between items-end mb-2 border-b border-white/10 pb-2">
                                    <div className="text-left">
                                        <div className="text-xs text-gray-400">回測區間 (Duration: {labData.duration_years} Years)</div>
                                        <div className="text-sm font-bold text-white font-mono">{labData.period_start} ~ {labData.period_end}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-gray-400">Total Return (累計報酬)</div>
                                        <div className={`text-2xl font-bold font-mono ${labData.total_return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {labData.total_return_pct > 0 ? '+' : ''}{labData.total_return_pct}%
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 group relative" title="資產每年的平均增長率 (含複利效果)">
                                        <div className="text-gray-400 text-[10px] uppercase">年化報酬率 (CAGR)</div>
                                        <div className="text-xl font-bold text-blue-400">{labData.cagr_percent}%</div>
                                        <div className="text-[10px] text-gray-500">每年平均增長速度</div>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 group relative" title="帳戶資金從最高點滑落到最低點的幅度">
                                        <div className="text-gray-400 text-[10px] uppercase">最大回撤 (MDD)</div>
                                        <div className="text-xl font-bold text-red-400">{labData.mdd_percent}%</div>
                                        <div className="text-[10px] text-gray-500">歷史最慘曾經賠多少</div>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 group relative" title="衡量每承受一單位總風險，能產生多少超額報酬 (越高越好)">
                                        <div className="text-gray-400 text-[10px] uppercase">夏普值 (Sharpe)</div>
                                        <div className="text-xl font-bold text-yellow-400">{labData.sharpe_ratio}</div>
                                        <div className="text-[10px] text-gray-500">承擔每單位風險獲利</div>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 group relative" title="只考慮下跌風險的夏普值，對投資人更有參考價值 (越高越好)">
                                        <div className="text-gray-400 text-[10px] uppercase">索提諾 (Sortino)</div>
                                        <div className="text-xl font-bold text-yellow-400">{labData.sortino_ratio}</div>
                                        <div className="text-[10px] text-gray-500">只看下跌風險的獲利</div>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 group relative" title="獲利交易次數佔總交易次數的比例">
                                        <div className="text-gray-400 text-[10px] uppercase">勝率 (Win Rate)</div>
                                        <div className="text-xl font-bold text-purple-400">{labData.win_rate}%</div>
                                        <div className="text-[10px] text-gray-500">{labData.total_trades} 筆交易獲利佔比</div>
                                    </div>
                                </div>

                                {/* Complex Tables Grid */}
                                <div className="grid md:grid-cols-2 gap-6 text-left">

                                    {/* Yearly Stats */}
                                    <div className="glass-card overflow-hidden">
                                        <div className="bg-white/5 p-3 text-xs font-bold text-gray-300 uppercase flex items-center justify-between">
                                            <span>年度績效 (Yearly Performance)</span>
                                            <BarChart2 size={14} />
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto">
                                            <table className="w-full text-xs">
                                                <thead className="text-gray-500 sticky top-0 bg-[#0f0f13]">
                                                    <tr>
                                                        <th className="p-2">Year</th>
                                                        <th className="p-2 text-right">Return</th>
                                                        <th className="p-2 text-right">MDD</th>
                                                        <th className="p-2 text-right">Profit</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {labData.yearly_stats?.map(stat => (
                                                        <tr key={stat.year} className="hover:bg-white/5">
                                                            <td className="p-2 font-mono text-gray-300">{stat.year}</td>
                                                            <td className={`p-2 text-right font-bold ${stat.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {stat.return_pct}%
                                                            </td>
                                                            <td className="p-2 text-right text-red-300">{stat.mdd_pct}%</td>
                                                            <td className={`p-2 text-right font-mono ${stat.profit >= 0 ? 'text-gray-300' : 'text-gray-500'}`}>
                                                                ${stat.profit.toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Trade Logs */}
                                    <div className="glass-card overflow-hidden">
                                        <div className="bg-white/5 p-3 text-xs font-bold text-gray-300 uppercase flex items-center justify-between">
                                            <span>交易歷史 (Trade History)</span>
                                            <RotateCcw size={14} />
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto">
                                            <table className="w-full text-xs">
                                                <thead className="text-gray-500 sticky top-0 bg-[#0f0f13]">
                                                    <tr>
                                                        <th className="p-2">Date</th>
                                                        <th className="p-2">Type</th>
                                                        <th className="p-2 text-right">Price</th>
                                                        <th className="p-2 text-right">PnL</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {labData.trade_list?.map((trade, i) => (
                                                        <tr key={i} className="hover:bg-white/5">
                                                            <td className="p-2 font-mono text-gray-400">{trade.entry_date}</td>
                                                            <td className="p-2">
                                                                <span className={`px-1.5 py-0.5 rounded ${trade.type === 'LONG' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                                                                    {trade.type}
                                                                </span>
                                                            </td>
                                                            <td className="p-2 text-right font-mono text-gray-300">{trade.entry_price}</td>
                                                            <td className={`p-2 text-right font-bold ${trade.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {trade.pnl_pct}%
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* --- ADVISOR TAB --- */}
                {activeTab === 'advisor' && (
                    <motion.div key="advisor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">

                        {/* Stress Test Module */}
                        <StressTest portfolio={portfolio} indexPrice={activeOptions?.index_price || 23000} />

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
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modals */}
            {
                showAddModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                        <div className="glass-card w-full max-w-md p-6">
                            <h3 className="text-xl font-bold text-white mb-4">新增部位 (Add Position)</h3>
                            <form onSubmit={handleAddPosition} className="space-y-4">
                                <div className="flex bg-white/10 p-1 rounded-lg">
                                    <button type="button" onClick={() => setSide('long')} className={`flex-1 py-2 rounded-md text-xs font-bold transition ${side === 'long' ? 'bg-green-500 text-black shadow-lg' : 'text-gray-400'}`}>做多 (LONG)</button>
                                    <button type="button" onClick={() => setSide('short')} className={`flex-1 py-2 rounded-md text-xs font-bold transition ${side === 'short' ? 'bg-red-500 text-white shadow-lg' : 'text-gray-400'}`}>做空 (SHORT)</button>
                                </div>
                                <select className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white text-sm" value={newPos.symbol} onChange={e => setNewPos({ ...newPos, symbol: e.target.value })}>
                                    {ASSETS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                                <input type="number" required className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white text-sm" value={newPos.shares} onChange={e => setNewPos({ ...newPos, shares: e.target.value })} placeholder="股數 (Shares)" />
                                <input type="number" required className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white text-sm" value={newPos.avg_cost} onChange={e => setNewPos({ ...newPos, avg_cost: e.target.value })} placeholder="平均成本 (Avg Cost)" />
                                <div className="flex gap-3 mt-4">
                                    <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-lg border border-white/10 text-gray-300 text-sm">取消 (Cancel)</button>
                                    <button type="submit" className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-bold text-sm">儲存部位 (Save)</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Analysis Modal */}
            {analysisTarget && <AnalysisModal target={analysisTarget} onClose={() => setAnalysisTarget(null)} />}
        </div >
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
