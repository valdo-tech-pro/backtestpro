import { useState } from "react";
import MarketChart from "./components/MarketChart";
import ReplayWorkspace from "./components/ReplayWorkspace";
import type { ReactNode } from "react";
import {
  Activity, BarChart3, Bell, BookOpen, ChevronDown, CircleHelp,
  Clock3, Command, FileText, FlaskConical, LayoutDashboard, LineChart,
  Menu, Plus, Search, Settings, ShieldCheck, Sparkles,
  TrendingUp, Wallet, X
} from "lucide-react";

type Market = "Forex" | "Metals" | "Indices" | "Crypto";

const markets: Record<Market, string[]> = {
  Forex: ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD"],
  Metals: ["XAU/USD", "XAG/USD"],
  Indices: ["US100", "US500", "GER40"],
  Crypto: ["BTC/USDT", "ETH/USDT", "SOL/USDT"],
};

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Chart Replay", icon: Clock3 },
  { label: "Strategy Tester", icon: FlaskConical },
  { label: "Analytics", icon: BarChart3 },
  { label: "Trading Journal", icon: BookOpen },
];

function App() {
  const [activeMarket, setActiveMarket] = useState<Market>("Forex");
  const [symbol, setSymbol] = useState("EUR/USD");
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  const [timeframe, setTimeframe] = useState("1H");

  const changeMarket = (market: Market) => {
    setActiveMarket(market);
    setSymbol(markets[market][0]);
  };

  const sidebar = (
    <>
      <div className="brand">
        <div className="brand-mark"><LineChart size={20} /></div>
        <div><strong>Backtest<span>Pro</span></strong><small>TRADING RESEARCH</small></div>
        <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button>
      </div>
      <div className="workspace"><div className="workspace-avatar">B</div><div><b>My Workspace</b><small>Free plan</small></div><ChevronDown size={15} /></div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="main-nav">
        {navItems.map(item => {
          const Icon = item.icon;
          return <button key={item.label} className={activeNav === item.label ? "nav-item active" : "nav-item"} onClick={() => { setActiveNav(item.label); setMobileOpen(false); }}>
            <Icon size={17} /><span>{item.label}</span>{item.label === "Strategy Tester" && <span className="nav-new">NEW</span>}
          </button>;
        })}
      </nav>
      <div className="nav-label market-label">MARKETS</div>
      <div className="market-list">
        {(Object.keys(markets) as Market[]).map(m => <button key={m} onClick={() => changeMarket(m)} className={activeMarket === m ? "market-item selected" : "market-item"}>
          <span className={"market-dot " + m.toLowerCase()} />{m}<span className="market-count">{markets[m].length}</span>
        </button>)}
      </div>
      <div className="sidebar-bottom">
        <button className="nav-item"><Settings size={17} />Settings</button>
        <button className="nav-item"><CircleHelp size={17} />Help & support</button>
        <div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={16} /></div><b>Unlock your edge</b><p>More testing power and deeper insights are coming soon.</p><button onClick={() => alert("Plans will be available in a future release.")}>Explore plans <span>→</span></button></div>
        <div className="profile"><div className="profile-avatar">VN</div><div><b>Trader account</b><small>Free workspace</small></div><ChevronDown size={15} /></div>
      </div>
    </>
  );

  return <div className="app-shell">
    <aside className="sidebar">{sidebar}</aside>
    {mobileOpen && <div className="scrim" onClick={() => setMobileOpen(false)} />}
    <div className="mobile-sidebar">{sidebar}</div>
    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div className="breadcrumb">Workspace <span>/</span> <b>{activeNav}</b></div></div>
        <div className="top-actions"><div className="search-box"><Search size={15} /><span>Search anything...</span><kbd><Command size={11} /> K</kbd></div><button className="icon-button notification" aria-label="Notifications"><Bell size={18} /><i /></button><div className="top-avatar">VN</div></div>
      </header>
      <div className="page-content">{activeNav === "Chart Replay" ? <ReplayWorkspace /> : <>
        <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot" /> YOUR TRADING WORKSPACE</div><h1>{activeNav === "Dashboard" ? "Good to see you, trader." : activeNav}</h1><p className="subtitle">{activeNav === "Dashboard" ? "Your research starts here. Build, test, and refine your trading edge." : "This workspace is being prepared. Your tools will appear here as we build them."}</p></div><button className="primary-button" onClick={() => setActiveNav("Chart Replay")}><Plus size={17} /> New backtest</button></div>

        <section className="stats-grid">
          <StatCard title="Total backtests" value="0" note="Your testing history" icon={<FlaskConical size={18}/>} />
          <StatCard title="Win rate" value="—" note="No completed tests yet" icon={<TargetIcon />} />
          <StatCard title="Net profit" value="—" note="Waiting for your first test" icon={<Wallet size={18}/>} />
          <StatCard title="Max drawdown" value="—" note="Risk tracking overview" icon={<Activity size={18}/>} />
        </section>

        <section className="content-grid">
          <div className="panel chart-panel">
            <div className="panel-heading"><div><div className="panel-title">Market overview</div><p>Explore a market before starting a replay.</p></div><button className="subtle-button" onClick={() => setActiveNav("Chart Replay")}>Open replay <span>↗</span></button></div>
            <div className="chart-toolbar"><div className="symbol-select"><span className="symbol-icon">{symbol.startsWith("X") ? "Au" : symbol.startsWith("BTC") ? "₿" : symbol.slice(0,1)}</span><select value={symbol} onChange={e => setSymbol(e.target.value)}>{markets[activeMarket].map(s => <option key={s}>{s}</option>)}</select><ChevronDown size={14}/></div><div className="timeframes">{["1H", "4H", "1D", "1W"].map(frame => <button key={frame} className={timeframe === frame ? "chosen" : ""} onClick={() => setTimeframe(frame)}>{frame}</button>)}</div><button className="icon-button chart-more" aria-label="Chart settings"><Settings size={16}/></button></div>
            <div className="chart-legend"><span className="legend-up"/> Bullish <span className="legend-down"/> Bearish <span className="chart-demo-label">Illustrative preview · not live market data</span></div>
            <MarketChart symbol={symbol} timeframe={timeframe} />
            <div className="chart-footer"><span>Market data connection coming soon</span><button onClick={() => setActiveNav("Chart Replay")}>Start candle replay <span>→</span></button></div>
          </div>
          <div className="panel quick-panel">
            <div className="panel-heading"><div><div className="panel-title">Quick start</div><p>Choose how you want to work.</p></div></div>
            <QuickAction icon={<Clock3 size={18}/>} title="Manual chart replay" desc="Replay historical candles at your pace." onClick={() => setActiveNav("Chart Replay")} />
            <QuickAction icon={<FlaskConical size={18}/>} title="Strategy tester" desc="Evaluate rules and trading ideas." onClick={() => setActiveNav("Strategy Tester")} />
            <QuickAction icon={<BarChart3 size={18}/>} title="Performance analytics" desc="Review results and risk metrics." onClick={() => setActiveNav("Analytics")} />
            <div className="tip-box"><ShieldCheck size={17}/><div><b>Test before you trade</b><p>Backtesting helps you understand how a strategy behaved historically. It does not guarantee future results.</p></div></div>
          </div>
        </section>

        <section className="panel sessions-panel"><div className="panel-heading"><div><div className="panel-title">Recent sessions</div><p>Your latest backtesting activity will appear here.</p></div><button className="text-button" onClick={() => setActiveNav("Trading Journal")}>View journal <span>→</span></button></div><div className="empty-state"><div className="empty-icon"><FileText size={22}/></div><b>No sessions yet</b><p>Your first backtest is one click away. Start with a market replay and record your decisions.</p><button className="outline-button" onClick={() => setActiveNav("Chart Replay")}><Plus size={15}/> Start your first session</button></div></section>
        <footer><span>© 2026 BacktestPro</span><span><span className="footer-status"/> All systems in preview mode</span><span>Built for better trading decisions.</span></footer>
      </>}
      </div>
    </main>
  </div>;
}

function StatCard({title,value,note,icon}:{title:string;value:string;note:string;icon:ReactNode}) {
  return <div className="stat-card"><div className="stat-top"><span>{title}</span><div className="stat-icon">{icon}</div></div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>;
}
function QuickAction({icon,title,desc,onClick}:{icon:ReactNode;title:string;desc:string;onClick:()=>void}) {
  return <button className="quick-action" onClick={onClick}><span className="quick-icon">{icon}</span><span className="quick-copy"><b>{title}</b><small>{desc}</small></span><span className="quick-arrow">→</span></button>;
}
function TargetIcon(){return <TrendingUp size={18}/>}

export default App;
