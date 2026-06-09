import { useState, useEffect } from 'react';
import { useStore } from './store';
import { SplashOverlay } from './components/SplashOverlay';
import { DeviceModal } from './components/DeviceModal';
import { WidgetDashboard } from './components/WidgetDashboard';
import { LogsDrawer } from './components/LogsDrawer';
import { SPDChart } from './components/SPDChart';
import { 
  Info, Power, Play, Moon, Sun, Wind, CloudRain, 
  CheckCircle, Flame
} from 'lucide-react';
import { clsx } from 'clsx';

function App() {
  const { 
    status, connect, power, togglePower, toastMessage, showToast, channels, mqttClient,
    customScenes, deleteCustomScene
  } = useStore();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'devices'>('dashboard');
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
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
    <div className="relative min-h-screen w-full bg-[#000000] text-text-primary overflow-x-hidden flex items-center justify-center font-body py-0 md:py-6 select-none">
      
      {/* Main Container App Shell */}
      <div className="w-full max-w-[430px] h-screen md:h-[860px] md:max-h-[95vh] md:border md:border-border/80 md:rounded-[36px] md:shadow-2xl overflow-hidden relative bg-[#000000] flex flex-col z-10">
        
        {/* Full Widescreen Watermark Overlay */}
        <div className="bg-watermark"></div>

        {/* Splash Overlay Screen */}
        <SplashOverlay />

        {/* Widescreen App Header (Dashboard/Devices Switcher) */}
        <header className="px-5 py-4 border-b border-border/60 bg-bg-card/90 flex items-center justify-between flex-shrink-0 z-10">
          {/* Settings Logs toggle */}
          <button 
            onClick={() => setIsLogsOpen(true)}
            className="p-2.5 rounded-xl bg-[#121214] border border-border/80 text-text-secondary hover:text-text-primary hover:border-border transition-colors"
            title="System Logs"
          >
            <Info size={16} />
          </button>

          {/* Top Capsule Tab Switcher */}
          <div className="flex bg-[#000000] p-0.5 rounded-xl border border-border shadow-inner max-w-[200px] w-full">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={clsx(
                "flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                activeTab === 'dashboard' 
                  ? "bg-text-primary text-[#000000] font-black shadow-sm" 
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
                  ? "bg-text-primary text-[#000000] font-black shadow-sm" 
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
                : "bg-[#0b0b0c] border-border/80 text-text-secondary"
            )}
            title={power ? "Turn Lights OFF" : "Turn Lights ON"}
          >
            <Power size={16} />
          </button>
        </header>

        {/* Scrollable View Body */}
        <main className="flex-1 overflow-y-auto no-scrollbar p-5 pb-10 flex flex-col gap-6 relative z-10">
          
          {activeTab === 'dashboard' ? (
            /* ==================== DASHBOARD TAB ==================== */
            <>
              {/* Text Header Zone instead of squished banner */}
              <div className="flex flex-col gap-1 py-2 px-1 border-b border-border/40">
                <span className="text-[9px] text-accent-blue font-bold uppercase tracking-[0.25em]">Active Zone</span>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-white uppercase tracking-[0.08em] leading-none">
                    Living Room
                  </h2>
                  <span className="text-[8px] font-mono text-text-secondary bg-[#121214] border border-border px-2 py-0.5 rounded uppercase tracking-wider">
                    Creators Reef
                  </span>
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
                        : "bg-[#0b0b0c] border-border text-text-primary hover:border-text-primary"
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
                    <div className="w-12 h-12 rounded-full bg-[#0b0b0c] border border-border hover:border-text-primary flex items-center justify-center text-sky-400 transition-all shadow-md">
                      <Moon size={16} />
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-text-secondary">Moon</span>
                  </button>

                  {/* Daylight Preset */}
                  <button 
                    onClick={() => triggerPreset('Daylight', { uvRed: 100, white: 220, blueA: 150, blueB: 150 })}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#0b0b0c] border border-border hover:border-text-primary flex items-center justify-center text-amber-400 transition-all shadow-md">
                      <Sun size={16} />
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-text-secondary">Day</span>
                  </button>

                  {/* Deep Blue Preset */}
                  <button 
                    onClick={() => triggerPreset('Deep Blue', { uvRed: 30, white: 10, blueA: 255, blueB: 255 })}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#0b0b0c] border border-border hover:border-text-primary flex items-center justify-center text-accent-blue transition-all shadow-md">
                      <Wind size={16} />
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-text-secondary">Deep Blue</span>
                  </button>

                  {/* Storm Preset */}
                  <button 
                    onClick={() => triggerPreset('Storm Preset', { uvRed: 10, white: 50, blueA: 120, blueB: 120 })}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#0b0b0c] border border-border hover:border-text-primary flex items-center justify-center text-purple-400 transition-all shadow-md">
                      <CloudRain size={16} />
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-text-secondary">Storm</span>
                  </button>

                  {/* Custom Scenes dynamically loaded */}
                  {customScenes.length > 0 ? (
                    customScenes.map((scene) => (
                      <div key={scene.id} className="relative group flex flex-col items-center gap-1.5 flex-shrink-0">
                        {/* Delete button (small "x" at top-right of the circle) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomScene(scene.id);
                          }}
                          className="absolute -top-1 -right-1 z-20 w-4 h-4 bg-status-error hover:bg-status-error/85 rounded-full flex items-center justify-center text-white text-[8px] font-black shadow-md transition-all opacity-0 group-hover:opacity-100"
                          title="Delete Scene"
                        >
                          ✕
                        </button>
                        <button 
                          onClick={() => triggerPreset(scene.name, scene.channels)}
                          className="flex flex-col items-center gap-1.5"
                        >
                          <div className="w-12 h-12 rounded-full bg-[#0b0b0c] border border-border hover:border-text-primary flex items-center justify-center text-yellow-500 transition-all shadow-md">
                            <span className="text-sm font-bold">⭐</span>
                          </div>
                          <span className="text-[9px] uppercase tracking-wider font-bold text-text-secondary max-w-[56px] truncate text-center leading-tight">
                            {scene.name}
                          </span>
                        </button>
                      </div>
                    ))
                  ) : (
                    /* Default Custom Button when empty */
                    <button 
                      onClick={handleRecallCustom}
                      className="flex flex-col items-center gap-1.5 flex-shrink-0"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#0b0b0c] border border-border hover:border-text-primary flex items-center justify-center text-yellow-500/50 transition-all shadow-md">
                        <span className="text-sm font-bold">⭐</span>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider font-bold text-text-secondary">Custom</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Speci-intensity Widget */}
              <SPDChart isHome={true} onEditClick={() => setIsDeviceModalOpen(true)} />

              {/* Water Parameters Log Dashboard widget */}
              <WidgetDashboard />
            </>
          ) : (
            /* ==================== DEVICES TAB ==================== */
            <>
              {/* Category Filter list */}
              <div className="flex justify-start gap-2 border-b border-border/40 pb-4">
                <button
                  className="py-1.5 px-4 rounded-full border border-text-primary bg-text-primary text-[#000000] text-[10px] font-black uppercase tracking-wider shadow-md"
                >
                  All (1)
                </button>
              </div>

              {/* Devices Grid List */}
              <div className="grid grid-cols-1 gap-4">
                {/* 1. Only Lighting Device (Creators Reef ESP32) */}
                <div 
                  onClick={() => setIsDeviceModalOpen(true)}
                  className="bg-[#0b0b0c] border border-border rounded-2xl p-4 flex items-center justify-between hover:border-text-secondary transition-all cursor-pointer shadow-md group relative overflow-hidden"
                >
                  <div className="flex items-center gap-4">
                    {/* Circular indicator showing overall spectrum state */}
                    <div className="w-14 h-14 rounded-full bg-[#121214] border border-border flex items-center justify-center relative p-1">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="26" cy="26" r="22" stroke="rgba(26, 36, 61, 0.2)" strokeWidth="3" fill="transparent" />
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

                {/* 2. Dash plus card to add devices */}
                <div 
                  className="bg-transparent border border-dashed border-border/60 hover:border-text-secondary rounded-2xl p-6 flex flex-col items-center justify-center gap-2.5 transition-all cursor-pointer min-h-[95px] group"
                  onClick={() => showToast('Device discovery started...')}
                >
                  <div className="w-8 h-8 rounded-full bg-[#0b0b0c] border border-border group-hover:border-text-secondary flex items-center justify-center text-text-secondary group-hover:text-text-primary transition-all">
                    <span className="text-sm font-bold">+</span>
                  </div>
                  <span className="text-[9px] uppercase tracking-[0.15em] font-black text-text-secondary group-hover:text-text-primary transition-all">Add New Device</span>
                </div>

              </div>
            </>
          )}

        </main>

        {/* 4. Elegant Toast Alert Panel */}
        {visibleToast && (
          <div className="absolute top-20 inset-x-4 z-50 flex justify-center animate-fade-in pointer-events-none">
            <div className="bg-[#0b0b0c] border border-border rounded-2xl py-3 px-5 shadow-2xl flex items-center gap-2.5 max-w-[90%] pointer-events-auto">
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

        {/* 6. Slide-up ESP32 diagnostics drawer */}
        <LogsDrawer 
          isOpen={isLogsOpen} 
          onClose={() => setIsLogsOpen(false)} 
        />

      </div>
    </div>
  );
}

export default App;
