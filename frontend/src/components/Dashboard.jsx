import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, ShieldCheck, AlertTriangle } from 'lucide-react';
import CandleChart from './CandleChart';

const Dashboard = ({ monitorData, portfolio, activeOptions }) => {

    // Calculate total assets
    const totalAssets = portfolio.reduce((sum, item) => sum + (item.market_value || 0), 0);
    const dayChange = portfolio.reduce((sum, item) => sum + (item.pnl || 0), 0); // Approx day change

    // Determine System Status
    const systemStatus = monitorData?.status || 'NEUTRAL';
    const statusColor = systemStatus === 'BULL' ? 'bg-green-500' : systemStatus === 'BEAR' ? 'bg-red-500' : 'bg-yellow-500';

    // Current Price
    const currentPrice = monitorData?.price || "---";
    const changeValue = monitorData?.direct_change || 0;
    const isPositive = changeValue >= 0;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Market Status Card */}
                <div className={`p-1 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 relative overflow-hidden group`}>
                    <div className={`absolute top-0 left-0 w-1 h-full ${statusColor} shadow-[0_0_20px_rgba(255,255,255,0.5)]`}></div>
                    <div className="p-5">
                        <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">市場狀態 (Regime)</div>
                        <div className="text-2xl font-black text-white flex items-center gap-3">
                            {systemStatus}
                            <span className={`w-3 h-3 rounded-full ${statusColor} animate-pulse shadow-[0_0_10px_currentColor]`}></span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-2">AI 信心度: 高</div>
                    </div>
                </div>

                {/* Price Card (New) */}
                <div className="glass-card p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div className="text-xs text-gray-400 uppercase tracking-widest">當前市價 (Price)</div>
                        <Activity size={16} className={isPositive ? "text-green-400" : "text-red-400"} />
                    </div>
                    <div>
                        <div className="text-3xl font-black text-white tracking-tight">
                            {currentPrice}
                        </div>
                        <div className={`text-xs font-bold mt-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {isPositive ? '▲' : '▼'} {changeValue}
                        </div>
                    </div>
                </div>

                {/* Net Worth */}
                <div className="glass-card p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div className="text-xs text-gray-400 uppercase tracking-widest">總資產 (Net Worth)</div>
                        <DollarSign size={16} className="text-blue-400" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-white tracking-tight">
                            ${totalAssets.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">資產總淨值</div>
                    </div>
                </div>

                {/* Daily PnL */}
                <div className="glass-card p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div className="text-xs text-gray-400 uppercase tracking-widest">未實現損益 (PnL)</div>
                        <Activity size={16} className={dayChange >= 0 ? "text-green-400" : "text-red-400"} />
                    </div>
                    <div>
                        <div className={`text-2xl font-bold tracking-tight ${dayChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {dayChange >= 0 ? "+" : ""}${Math.round(dayChange).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">來自當前持倉</div>
                    </div>
                </div>

                {/* Insurance Level */}
                <div className="glass-card p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div className="text-xs text-gray-400 uppercase tracking-widest">避險狀態 (Hedge)</div>
                        <ShieldCheck size={16} className="text-purple-400" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-white tracking-tight">
                            {portfolio.some(p => p.symbol === 'MTX' && p.shares < 0) ? '啟用 (ACTIVE)' : '無 (NONE)'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            賣權保險: {activeOptions?.weekly?.price ? `$${activeOptions.weekly.price}` : '---'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Chart Section */}
            <div className="glass-card p-6 min-h-[400px] border-blue-500/20">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Activity className="text-blue-400" />
                        市場趨勢概覽 (MARKET OVERVIEW)
                    </h3>
                    <div className="flex gap-2">
                        <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/50">MA10 短線</span>
                        <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/50">MA20 月線</span>
                        <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/50">MA60 季線</span>
                    </div>
                </div>

                <div className="h-[350px] w-full">
                    {monitorData?.chart_data ? (
                        <CandleChart data={monitorData.chart_data} height={350} />
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-600 animate-pulse">
                            載入市場數據中 (Loading Market Data)...
                        </div>
                    )}
                </div>
            </div>

            {/* AI Insight */}
            <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-900/10 flex items-start gap-4">
                <div className="p-2 bg-blue-500/20 rounded-full text-blue-400 animate-pulse">
                    <Activity size={20} />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-blue-300 uppercase mb-1">AI 戰術洞察 (Tactical Insight)</h4>
                    <p className="text-sm text-gray-300 leading-relaxed">
                        {monitorData?.ai_report || "系統初始化中..."}
                        目前趨勢顯示為 {systemStatus === 'BULL' ? '多頭 (BULL)' : systemStatus === 'BEAR' ? '空頭 (BEAR)' : '盤整 (NEUTRAL)'} 格局。
                        {systemStatus === 'BEAR' ? ' 建議增加避險部位 (Increase Hedge)。' : ' 有利於多方操作 (Long Positions)。'}
                    </p>
                </div>
            </div>

        </div>
    );
};

export default Dashboard;
