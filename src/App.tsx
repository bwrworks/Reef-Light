import { useState, useEffect } from 'react';
import { useStore } from './store';
import { SplashOverlay } from './components/SplashOverlay';
import { DeviceModal } from './components/DeviceModal';
import { WidgetDashboard } from './components/WidgetDashboard';
import { LogsDrawer } from './components/LogsDrawer';
import { 
  Info, Power, Play, Moon, Sun, Wind, CloudRain, 
  Camera, Sliders, Waves, CheckCircle, Flame, Zap
} from 'lucide-react';
import { clsx } from 'clsx';

// Simulated Vortech Wave Modal
function VortechModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [speed, setSpeed] = useState(65);
  const [mode, setMode] = useState<'constant' | 'reef' | 'pulse' | 'nutrient'>('reef');
  const { showToast } = useStore();

  if (!isOpen) return null;

  const handleSave = () => {
    showToast(`VorTech Pump updated to ${speed}% speed (${mode} mode)`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs" onClick={onClose} />
      <div className="w-full max-w-[430px] bg-bg-card border-t border-border rounded-t-[32px] z-10 flex flex-col p-6 animate-slide-up shadow-2xl">
        <div className="w-12 h-1 bg-border/80 rounded-full mx-auto mb-4 flex-shrink-0" />
        <div className="flex justify-between items-center mb-4 border-b border-border/40 pb-3">
          <div>
            <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
              <Waves className="text-accent-cyan" size={16} />
              VorTech Wave Pump
            </h3>
            <span className="text-[9px] text-text-secondary uppercase tracking-widest font-semibold">Flow Settings</span>
          </div>
          <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary"><XIcon /></button>
        </div>

        <div className="flex flex-col gap-6 my-4">
          <div className="text-center">
            <span className="text-[10px] text-text-secondary uppercase tracking-widest font-semibold">Target Flow Speed</span>
            <div className="font-display font-black text-3xl text-accent-cyan mt-1 font-mono">{speed}%</div>
          </div>

          <input 
            type="range" 
            min="20" 
            max="100" 
            value={speed} 
            onChange={(e) => setSpeed(parseInt(e.target.value))} 
            className="w-full"
            style={{
              background: 'linear-gradient(to right, #0891b2, #06b6d4)',
              height: '6px',
              borderRadius: '9999px'
            }}
          />

          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-text-secondary">Wave Program</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'constant', label: 'Constant Speed' },
                { id: 'reef', label: 'Reef Crest' },
                { id: 'pulse', label: 'Short Pulse' },
                { id: 'nutrient', label: 'Nutrient Export' },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id as any)}
                  className={clsx(
                    "py-2 px-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all",
                    mode === m.id 
                      ? "bg-accent-cyan/10 border-accent-cyan text-accent-cyan font-black" 
                      : "bg-bg-base/40 border-border text-text-secondary hover:text-text-primary"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button 
          onClick={handleSave}
          className="w-full py-3.5 bg-accent-cyan text-black rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent-cyan/15 hover:bg-accent-cyan/95 transition-all mt-2"
        >
          Apply Wave Settings
        </button>
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  );
}

function App() {
  const { 
    status, connect, power, togglePower, toastMessage, showToast, channels, mqttClient 
  } = useStore();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'devices'>('dashboard');
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isVortechOpen, setIsVortechOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'lighting' | 'flow' | 'dosing'>('all');
  const [liveDemoTimer, setLiveDemoTimer] = useState<number | null>(null);

  // Trigger connection on boot
  useEffect(() => {
    connect();
  }, [connect]);

  // Handle toast clear on change
  const [visibleToast, setVisibleToast] = useState<string | null>(null);
  useEffect(() => {
    if (toastMessage) {
      setVisibleToast(toastMessage);
      const timer = setTimeout(() => {
        setVisibleToast(null);
        useStore.setState({ toastMessage: null });
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Handle quick presets trigger
  const triggerPreset = (presetName: string, config: { uvRed: number; white: number; blueA: number; blueB: number }) => {
    // Clear live demo if active
    if (liveDemoTimer) {
      clearInterval(liveDemoTimer);
      setLiveDemoTimer(null);
    }

    // Set store values
    useStore.setState({
      channels: {
        ...channels,
        ...config
      }
    });

    // Publish to ESP32
    mqttClient?.publish('creatorsreef/cmd/cr-849a2bf1-9c32-4d51-a719-21b9a8f4d91e', JSON.stringify({
      cmd_type: 'channels',
      uvRed: config.uvRed,
      blueA: config.blueA,
      blueB: config.blueB,
      white: config.white
    }));

    showToast(`Preset recalled: ${presetName}`);
  };

  // Live Demo cycle preset simulator
  const handleLiveDemo = () => {
    if (liveDemoTimer) {
      clearInterval(liveDemoTimer);
      setLiveDemoTimer(null);
      showToast('Live Demo cancelled');
      return;
    }

    showToast('Starting 30s Live Demo...');
    let secondsLeft = 30;
    setLiveDemoTimer(secondsLeft);

    const interval = setInterval(() => {
      secondsLeft -= 1;
      setLiveDemoTimer(secondsLeft);

      // Randomize spectrum coordinates to simulate demo cycle
      const demoConfig = {
        uvRed: Math.round(Math.random() * 200 + 40),
        blueA: Math.round(Math.random() * 255),
        blueB: Math.round(Math.random() * 255),
        white: Math.round(Math.random() * 80 + 20)
      };

      // Set store & publish
      useStore.setState({ channels: { ...channels, ...demoConfig } });
      mqttClient?.publish('creatorsreef/cmd/cr-849a2bf1-9c32-4d51-a719-21b9a8f4d91e', JSON.stringify({
        cmd_type: 'channels',
        ...demoConfig
      }));

      if (secondsLeft <= 0) {
        clearInterval(interval);
        setLiveDemoTimer(null);
        showToast('Live Demo completed');
      }
    }, 1000);
  };

  const handleRecallCustom = () => {
    const saved = localStorage.getItem('reef_custom_scene');
    if (saved) {
      try {
        const ch = JSON.parse(saved);
        triggerPreset('⭐ Custom', ch);
      } catch (e) {
        showToast('Error recalling custom scene');
      }
    } else {
      showToast('No Custom Scene saved. Dial sliders in settings and click Save Custom.');
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#040713] text-text-primary overflow-x-hidden flex items-center justify-center font-body py-0 md:py-6 select-none">
      
      {/* 1. Organic Ambient Background Glows */}
      <div className="ambient-glow bg-[#06b6d4] w-80 h-80 -left-16 -top-16 opacity-30"></div>
      <div className="ambient-glow bg-[#3b82f6] w-96 h-96 -right-16 top-48 opacity-30"></div>
      <div className="ambient-glow bg-[#8b5cf6] w-80 h-80 left-24 bottom-12 opacity-25"></div>

      {/* 2. ESP32 Connecting Screen Overlay */}
      <SplashOverlay />

      {/* 3. Main Container App Shell */}
      <div className="w-full max-w-[430px] h-screen md:h-[860px] md:max-h-[95vh] md:border md:border-border/80 md:rounded-[36px] md:shadow-2xl overflow-hidden relative bg-[#040713]/75 backdrop-blur-lg flex flex-col z-10">
        
        {/* Widescreen App Header (Dashboard/Devices Switcher) */}
        <header className="px-5 py-4 border-b border-border/60 bg-bg-card/40 flex items-center justify-between flex-shrink-0 z-10">
          {/* Settings Logs toggle */}
          <button 
            onClick={() => setIsLogsOpen(true)}
            className="p-2.5 rounded-xl bg-bg-card border border-border/80 text-text-secondary hover:text-text-primary hover:border-border transition-colors"
            title="System Logs"
          >
            <Info size={16} />
          </button>

          {/* Top Capsule Tab Switcher */}
          <div className="flex bg-[#040713]/80 p-0.5 rounded-xl border border-border shadow-inner max-w-[200px] w-full">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={clsx(
                "flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                activeTab === 'dashboard' 
                  ? "bg-text-primary text-bg-base font-black shadow-sm" 
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('devices')}
              className={clsx(
                "flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                activeTab === 'devices' 
                  ? "bg-text-primary text-bg-base font-black shadow-sm" 
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              Devices
            </button>
          </div>

          {/* Master power button */}
          <button
            onClick={togglePower}
            className={clsx(
              "p-2.5 rounded-xl border transition-all duration-300",
              power 
                ? "bg-status-success/15 border-status-success text-status-success shadow-[0_0_8px_rgba(16,185,129,0.3)]" 
                : "bg-bg-card border-border/80 text-text-secondary"
            )}
            title={power ? "Turn Lights OFF" : "Turn Lights ON"}
          >
            <Power size={16} />
          </button>
        </header>

        {/* Scrollable View Body */}
        <main className="flex-1 overflow-y-auto no-scrollbar p-5 pb-10 flex flex-col gap-6 relative">
          
          {activeTab === 'dashboard' ? (
            /* ==================== DASHBOARD TAB ==================== */
            <>
              {/* Photo Reef Banner */}
              <div 
                className="h-28 rounded-2xl overflow-hidden relative shadow-lg flex items-end p-4 bg-cover bg-center border border-border"
                style={{ backgroundImage: 'url("/coral_banner.png")' }}
              >
                {/* Backdrop overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                <div className="relative w-full flex items-center justify-between z-10">
                  <h2 className="font-display font-black text-lg text-white uppercase tracking-wider leading-none">
                    Living Room
                  </h2>
                  <button className="p-2 rounded-xl bg-white/10 backdrop-blur-xs text-white border border-white/10 hover:bg-white/20 transition-all">
                    <Camera size={14} />
                  </button>
                </div>
              </div>

              {/* Presets / Scenes list */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center px-0.5">
                  <span className="text-xs font-bold text-text-primary uppercase tracking-widest">
                    Quick Scenes
                  </span>
                  <span className="text-[9px] text-text-secondary uppercase tracking-widest font-semibold">
                    Presets
                  </span>
                </div>

                {/* Horizontal scrolling strip */}
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 px-0.5">
                  {/* Live Demo Trigger */}
                  <button 
                    onClick={handleLiveDemo}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0"
                  >
                    <div className={clsx(
                      "w-12 h-12 rounded-full border flex items-center justify-center transition-all shadow-md relative",
                      liveDemoTimer 
                        ? "bg-accent-red/15 border-accent-red text-accent-red animate-pulse" 
                        : "bg-bg-card border-border text-text-primary hover:border-text-primary"
                    )}>
                      <Play size={16} />
                      {liveDemoTimer && (
                        <span className="absolute -top-1 -right-1 bg-accent-red text-[8px] font-black text-white px-1 rounded-full">{liveDemoTimer}s</span>
                      )}
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-text-secondary">Demo</span>
                  </button>

                  {/* Moonlight Preset */}
                  <button 
                    onClick={() => triggerPreset('Moonlight', { uvRed: 0, white: 0, blueA: 15, blueB: 15 })}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0"
                  >
                    <div className="w-12 h-12 rounded-full bg-bg-card border border-border hover:border-text-primary flex items-center justify-center text-sky-400 transition-all shadow-md">
                      <Moon size={16} />
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-text-secondary">Moon</span>
                  </button>

                  {/* Daylight Preset */}
                  <button 
                    onClick={() => triggerPreset('Daylight', { uvRed: 100, white: 220, blueA: 150, blueB: 150 })}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0"
                  >
                    <div className="w-12 h-12 rounded-full bg-bg-card border border-border hover:border-text-primary flex items-center justify-center text-amber-400 transition-all shadow-md">
                      <Sun size={16} />
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-text-secondary">Day</span>
                  </button>

                  {/* Deep Blue Preset */}
                  <button 
                    onClick={() => triggerPreset('Deep Blue', { uvRed: 30, white: 10, blueA: 255, blueB: 255 })}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0"
                  >
                    <div className="w-12 h-12 rounded-full bg-bg-card border border-border hover:border-text-primary flex items-center justify-center text-accent-blue transition-all shadow-md">
                      <Wind size={16} />
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-text-secondary">Deep Blue</span>
                  </button>

                  {/* Storm Preset */}
                  <button 
                    onClick={() => triggerPreset('Storm Preset', { uvRed: 10, white: 50, blueA: 120, blueB: 120 })}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0"
                  >
                    <div className="w-12 h-12 rounded-full bg-bg-card border border-border hover:border-text-primary flex items-center justify-center text-purple-400 transition-all shadow-md">
                      <CloudRain size={16} />
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-text-secondary">Storm</span>
                  </button>

                  {/* Custom Preset */}
                  <button 
                    onClick={handleRecallCustom}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0"
                  >
                    <div className="w-12 h-12 rounded-full bg-bg-card border border-border hover:border-text-primary flex items-center justify-center text-yellow-500 transition-all shadow-md">
                      <span className="text-sm font-bold">⭐</span>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-text-secondary">Custom</span>
                  </button>
                </div>
              </div>

              {/* Speci-intensity Widget */}
              <div className="bg-bg-card border border-border rounded-2xl p-4 shadow-lg flex flex-col justify-between min-h-[120px]">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-accent-cyan uppercase tracking-widest font-bold">Lighting Spectrum</span>
                    <span className="font-display font-bold text-xs text-text-primary mt-0.5">Current Intensities</span>
                  </div>
                  <button 
                    onClick={() => setIsDeviceModalOpen(true)}
                    className="p-1.5 rounded-lg bg-bg-base/60 hover:bg-bg-elevated border border-border/30 text-text-secondary hover:text-text-primary transition-all flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider"
                  >
                    <Sliders size={10} />
                    Edit
                  </button>
                </div>

                <div className="flex items-end justify-between mt-3 px-1">
                  {/* Channels visual bar columns */}
                  {[
                    { label: 'UV/Red', val: channels.uvRed, color: 'bg-accent-uv' },
                    { label: 'White', val: channels.white, color: 'bg-accent-white' },
                    { label: 'Blue A', val: channels.blueA, color: 'bg-accent-blue' },
                    { label: 'Blue B', val: channels.blueB, color: 'bg-[#06b6d4]' },
                  ].map(c => {
                    const h = Math.max(8, Math.round((c.val / 255) * 40));
                    return (
                      <div key={c.label} className="flex flex-col items-center gap-1.5">
                        <div className="w-4.5 h-[40px] bg-bg-base/40 border border-border/20 rounded-md flex items-end justify-center overflow-hidden">
                          <div className={clsx("w-full transition-all duration-300", c.color)} style={{ height: `${h}px` }} />
                        </div>
                        <span className="text-[8px] font-mono text-text-secondary">{Math.round((c.val / 255) * 100)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Water Parameters Log Dashboard widget */}
              <WidgetDashboard />
            </>
          ) : (
            /* ==================== DEVICES TAB ==================== */
            <>
              {/* Category Filter list */}
              <div className="flex justify-between gap-2 border-b border-border/40 pb-4 flex-wrap">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'lighting', label: 'Lighting' },
                  { id: 'flow', label: 'Flow' },
                  { id: 'dosing', label: 'Dosing' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id as any)}
                    className={clsx(
                      "py-1.5 px-4 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all",
                      activeFilter === f.id 
                        ? "bg-text-primary border-text-primary text-bg-base font-black shadow-md" 
                        : "bg-bg-card border-border text-text-secondary hover:text-text-primary"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Devices Grid List */}
              <div className="grid grid-cols-1 gap-4">
                {/* 1. Lighting Device (Creators Reef ESP32) */}
                {(activeFilter === 'all' || activeFilter === 'lighting') && (
                  <div 
                    onClick={() => setIsDeviceModalOpen(true)}
                    className="bg-bg-card border border-border rounded-2xl p-4 flex items-center justify-between hover:border-text-secondary transition-all cursor-pointer shadow-md group relative overflow-hidden"
                  >
                    <div className="flex items-center gap-4">
                      {/* Circular indicator showing overall spectrum state */}
                      <div className="w-14 h-14 rounded-full bg-[#12192e] border border-border flex items-center justify-center relative p-1">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="26" cy="26" r="22" stroke="rgba(26, 36, 61, 0.4)" strokeWidth="3" fill="transparent" />
                          <circle 
                            cx="26" cy="26" r="22" 
                            stroke="#2563eb" 
                            strokeWidth="3.5" 
                            fill="transparent" 
                            strokeDasharray={2 * Math.PI * 22} 
                            strokeDashoffset={2 * Math.PI * 22 * (1 - (channels.blueA + channels.white + channels.uvRed) / (255 * 3))} 
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Flame size={16} className="text-accent-blue" />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-display font-black text-sm text-text-primary group-hover:text-accent-blue transition-colors">
                          Lighting
                        </h4>
                        <span className="text-[9px] uppercase tracking-widest font-black text-accent-blue block mt-0.5">
                          Creators Reef ESP32
                        </span>
                        <span className="text-[8px] text-text-secondary block mt-1">
                          EcoTech Marine Compatible
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1 font-mono text-xs text-text-secondary">
                      <span className={clsx(
                        "text-[9px] uppercase font-black px-2 py-0.5 rounded-full border",
                        status === 'connected' ? "bg-status-success/10 border-status-success text-status-success" : "bg-status-error/10 border-status-error text-status-error"
                      )}>
                        {status === 'connected' ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Flow Device (VorTech MP40wQD) */}
                {(activeFilter === 'all' || activeFilter === 'flow') && (
                  <div 
                    onClick={() => setIsVortechOpen(true)}
                    className="bg-bg-card border border-border rounded-2xl p-4 flex items-center justify-between hover:border-text-secondary transition-all cursor-pointer shadow-md group relative overflow-hidden"
                  >
                    <div className="flex items-center gap-4">
                      {/* Flow progress indicator */}
                      <div className="w-14 h-14 rounded-full bg-[#12192e] border border-border flex items-center justify-center relative p-1">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="26" cy="26" r="22" stroke="rgba(26, 36, 61, 0.4)" strokeWidth="3" fill="transparent" />
                          <circle cx="26" cy="26" r="22" stroke="#06b6d4" strokeWidth="3.5" fill="transparent" strokeDasharray={2 * Math.PI * 22} strokeDashoffset={2 * Math.PI * 22 * (1 - 0.65)} />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Waves size={16} className="text-accent-cyan animate-pulse" />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-display font-black text-sm text-text-primary group-hover:text-accent-cyan transition-colors">
                          VorTech Flow
                        </h4>
                        <span className="text-[9px] uppercase tracking-widest font-black text-accent-cyan block mt-0.5">
                          MP40wQD
                        </span>
                        <span className="text-[8px] text-text-secondary block mt-1">
                          Reef Crest Mode — 1,903 GPH
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1 font-mono text-xs text-text-secondary">
                      <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-full border bg-accent-cyan/10 border-accent-cyan text-accent-cyan">
                        ACTIVE
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. Dosing Device (Versa VX-1) */}
                {(activeFilter === 'all' || activeFilter === 'dosing') && (
                  <div 
                    className="bg-bg-card border border-border rounded-2xl p-4 flex items-center justify-between hover:border-text-secondary transition-all shadow-md group relative overflow-hidden opacity-70"
                  >
                    <div className="flex items-center gap-4">
                      {/* Versa Indicator */}
                      <div className="w-14 h-14 rounded-full bg-[#12192e] border border-border flex items-center justify-center relative p-1">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="26" cy="26" r="22" stroke="rgba(26, 36, 61, 0.4)" strokeWidth="3" fill="transparent" />
                          <circle cx="26" cy="26" r="22" stroke="#8b5cf6" strokeWidth="3.5" fill="transparent" strokeDasharray={2 * Math.PI * 22} strokeDashoffset={2 * Math.PI * 22 * (1 - 0.15)} />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Zap size={16} className="text-accent-uv" />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-display font-black text-sm text-text-primary">
                          Versa Dosing
                        </h4>
                        <span className="text-[9px] uppercase tracking-widest font-black text-accent-uv block mt-0.5">
                          VX-1 Doser
                        </span>
                        <span className="text-[8px] text-text-secondary block mt-1">
                          Ca 10ml/day — Ready
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1 font-mono text-xs text-text-secondary">
                      <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-full border border-border/80 bg-bg-base/40 text-text-secondary">
                        STANDBY
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

        </main>

        {/* 4. Elegant Toast Alert Panel */}
        {visibleToast && (
          <div className="absolute top-20 inset-x-4 z-50 flex justify-center animate-fade-in pointer-events-none">
            <div className="bg-[#0b0f1f]/95 border border-[#1a243d] rounded-2xl py-3 px-5 shadow-2xl backdrop-blur-md flex items-center gap-2.5 max-w-[90%] pointer-events-auto">
              <CheckCircle size={16} className="text-[#10b981]" />
              <span className="text-xs font-bold text-text-primary tracking-wide">{visibleToast}</span>
            </div>
          </div>
        )}

        {/* 5. Device Sliders Controller Modal */}
        <DeviceModal 
          isOpen={isDeviceModalOpen} 
          onClose={() => setIsDeviceModalOpen(false)} 
        />

        {/* 6. Vortech wave Pump controller overlay */}
        <VortechModal
          isOpen={isVortechOpen}
          onClose={() => setIsVortechOpen(false)}
        />

        {/* 7. Slide-up ESP32 diagnostics drawer */}
        <LogsDrawer 
          isOpen={isLogsOpen} 
          onClose={() => setIsLogsOpen(false)} 
        />

      </div>
    </div>
  );
}

export default App;
