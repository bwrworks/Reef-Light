import { useState } from 'react';
import { useStore } from '../store';
import { Link, Unlink, Sun, Flame, Zap, X } from 'lucide-react';
import { clsx } from 'clsx';

interface ChannelProps {
  id: 'uvRed' | 'blueA' | 'blueB' | 'white';
  name: string;
  subName: string;
  colorClass: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

function ChannelSlider({ id, name, subName, colorClass, icon, disabled }: ChannelProps) {
  const { channels, updateChannel } = useStore();
  const value = channels[id];
  const pct = Math.round((value / 255) * 100);

  // Progress-aware track gradient — only fills up to the current value
  const getTrackBackground = (sliderValue: number): string => {
    const pct = Math.round((sliderValue / 255) * 100);
    if (sliderValue === 0) return '#1C1C1E';
    const channelColors: Record<string, { start: string; end: string }> = {
      uvRed:  { start: '#EC4899', end: '#EF4444' },
      blueA:  { start: '#1E40AF', end: '#2563EB' },
      blueB:  { start: '#2563EB', end: '#3B82F6' },
      white:  { start: '#9CA3AF', end: '#F3F4F6' },
    };
    const c = channelColors[id] ?? { start: '#9CA3AF', end: '#FFFFFF' };
    return `linear-gradient(to right, ${c.start} 0%, ${c.end} ${pct}%, #1C1C1E ${pct}%, #1C1C1E 100%)`;
  };

  return (
    <div className={clsx(
      "bg-bg-card border border-border rounded-2xl p-4 transition-all duration-200 shadow-md",
      disabled && "opacity-45 pointer-events-none"
    )}>
      {/* Slider header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3.5">
          {/* Circular color icon */}
          <div className={clsx(
            "w-9 h-9 rounded-full flex items-center justify-center border border-border shadow-inner text-text-primary",
            colorClass
          )}>
            {icon}
          </div>
          <div>
            <div className="font-display font-bold text-xs text-text-primary uppercase tracking-wider">{name}</div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-text-secondary mt-0.5">{subName}</div>
          </div>
        </div>
        <div className="font-mono text-lg font-black text-text-primary">{pct}%</div>
      </div>

      {/* Slider input */}
      <div className="relative flex items-center h-5">
        <input
          type="range"
          min="0"
          max="255"
          value={value}
          onChange={(e) => updateChannel(id, parseInt(e.target.value, 10))}
          className="w-full"
          style={{
            background: getTrackBackground(value),
            height: '3px',
            borderRadius: '9999px',
          }}
        />
      </div>
    </div>
  );
}

export function ChannelControl() {
  const { channels, toggleLink, mode, setMode, setKelvin, kelvin, saveCustomScene } = useStore();
  const [isNamingOpen, setIsNamingOpen] = useState(false);
  const [sceneName, setSceneName] = useState('');

  const handleSave = () => {
    saveCustomScene(sceneName);
    setIsNamingOpen(false);
    setSceneName('');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Sub-mode Toggles */}
      <div className="flex bg-[#121214] p-1 rounded-xl border border-border">
        <button
          onClick={() => setMode('manual')}
          className={clsx(
            "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
            mode === 'manual' || mode === 'auto'
              ? "bg-bg-elevated text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          )}
        >
          Manual Mix
        </button>
        <button
          onClick={() => setMode('kelvin')}
          className={clsx(
            "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
            mode === 'kelvin'
              ? "bg-bg-elevated text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          )}
        >
          Kelvin Preset
        </button>
      </div>

      {mode === 'kelvin' ? (
        /* Kelvin Mode Control Panel */
        <div className="bg-bg-card border border-border rounded-2xl p-5 shadow-lg flex flex-col gap-6 animate-fade-in">
          <div className="text-center py-2">
            <span className="text-[10px] text-text-secondary uppercase tracking-widest font-semibold">
              Color Temperature
            </span>
            <div className="font-display font-black text-3xl text-text-primary mt-1 tracking-tight">
              {kelvin.toLocaleString()}K
            </div>
          </div>

          <div className="relative flex flex-col gap-2.5">
            <input
              type="range"
              min="6500"
              max="20000"
              step="100"
              value={kelvin}
              onChange={(e) => setKelvin(parseInt(e.target.value, 10))}
              className="w-full"
              style={{
                background: 'linear-gradient(to right, #FCD34D, #F3F4F6, #93C5FD, #2563EB)',
                height: '5px',
                borderRadius: '9999px',
              }}
            />
            
            <div className="flex justify-between font-mono text-[9px] text-text-secondary px-0.5 mt-1">
              <span>Warm (6.5kK)</span>
              <span>Daylight (10kK)</span>
              <span>Deep Blue (20kK)</span>
            </div>
          </div>

          <p className="text-[10px] text-text-secondary text-center leading-relaxed italic bg-bg-base/30 p-3 rounded-lg border border-border/20">
            Kelvin mode dynamically maps spectrum ratios to optimize photosynthetic energy while maintaining aesthetic visual color balance.
          </p>
        </div>
      ) : (
        /* Manual Channel Controls Sliders */
        <div className="flex flex-col gap-4 animate-fade-in">
          {/* Sliders Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChannelSlider 
              id="uvRed" 
              name="UV + Red" 
              subName="Actinic Coral Pop" 
              colorClass="bg-[#1C0A0A] border-pink-900/40 text-pink-400"
              icon={<Flame size={16} />}
            />
            <ChannelSlider 
              id="white" 
              name="Cool White" 
              subName="High PAR Brightness" 
              colorClass="bg-[#141414] border-[#3C3C3E] text-[#D1D5DB]"
              icon={<Sun size={16} />}
            />
          </div>

          {/* Link Channels Toggle */}
          <div className="flex items-center justify-between py-1 px-1">
            <div className="h-[1px] bg-border/40 flex-1"></div>
            <button 
              onClick={toggleLink} 
              className={clsx(
                "flex items-center gap-2 px-5 py-2 rounded-full border text-[9px] font-bold uppercase tracking-widest transition-all",
                channels.linked 
                  ? "bg-accent-blue/10 border-accent-blue/40 text-accent-blue shadow-sm" 
                  : "bg-bg-card border-border text-text-secondary hover:text-text-primary"
              )}
            >
              {channels.linked ? <Link size={12} /> : <Unlink size={12} />}
              {channels.linked ? 'Royal Blues Linked' : 'Royal Blues Unlinked'}
            </button>
            <div className="h-[1px] bg-border/40 flex-1"></div>
          </div>

          {/* Sliders Grid 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChannelSlider 
              id="blueA" 
              name="Royal Blue A" 
              subName="Deepwater Growth" 
              colorClass="bg-[#0A0A1C] border-blue-900/40 text-blue-400"
              icon={<Zap size={16} />}
            />
            <ChannelSlider 
              id="blueB" 
              name="Royal Blue B" 
              subName="Chlorophyll Absorption" 
              colorClass="bg-[#0A0A1C] border-sky-900/40 text-sky-400"
              icon={<Zap size={16} />}
              disabled={channels.linked}
            />
          </div>

          {/* Save Custom Scene Button */}
          <button
            onClick={() => {
              setSceneName('');
              setIsNamingOpen(true);
            }}
            className="w-full mt-2 py-3 bg-[#121214] border border-border hover:border-text-secondary text-text-primary rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            Save current mix as Custom Scene ⭐
          </button>

          {/* Naming Modal Dialog */}
          {isNamingOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div 
                className="absolute inset-0 bg-black/80 transition-opacity duration-200" 
                onClick={() => setIsNamingOpen(false)}
              />
              <div className="bg-[#0B0B0C] border border-[#1C1C1E] rounded-3xl p-5 w-full max-w-[320px] flex flex-col gap-4 shadow-2xl relative z-10 animate-fade-in">
                <div className="flex justify-between items-center border-b border-border/40 pb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                    Save Custom Scene
                  </span>
                  <button 
                    onClick={() => setIsNamingOpen(false)}
                    className="text-text-secondary hover:text-text-primary"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[9px] uppercase tracking-widest font-bold text-text-secondary">
                    Scene Name
                  </label>
                  <input
                    type="text"
                    value={sceneName}
                    onChange={(e) => setSceneName(e.target.value)}
                    placeholder="e.g. My Sunset Glow"
                    className="w-full bg-[#121214] border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-text-secondary"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave();
                    }}
                  />
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setIsNamingOpen(false)}
                    className="flex-1 py-2.5 bg-[#0b0b0c] border border-border text-text-secondary hover:text-text-primary hover:border-border rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 py-2.5 bg-white text-black rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-md hover:bg-white/90"
                  >
                    Save Scene
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

