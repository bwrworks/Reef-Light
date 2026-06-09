import { useState } from 'react';
import { useStore } from '../store';
import { X, Wifi, WifiOff, Loader, Wind } from 'lucide-react';
import { SPDChart } from './SPDChart';
import { ChannelControl } from './ChannelControl';
import { ScheduleEditor } from './ScheduleEditor';
import { clsx } from 'clsx';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Fan speed presets (like a real PC/server fan controller)
const FAN_PRESETS = [
  { label: 'Silent', speed: 0,   desc: 'Fan off' },
  { label: 'Eco',    speed: 30,  desc: 'Low hum, light flow' },
  { label: 'Normal', speed: 60,  desc: 'Balanced cooling' },
  { label: 'Turbo',  speed: 100, desc: 'Max airflow' },
];

function FanControl() {
  const { fanSpeed, setFanSpeed, status } = useStore();

  // Arc SVG for the fan speed dial
  const radius = 56;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * radius;
  const startAngle = -220; // degrees, where arc starts
  const totalArc = 260;    // how many degrees the arc spans
  const pct = fanSpeed / 100;
  const strokeDash = (pct * totalArc / 360) * circumference;
  const strokeGap = circumference - strokeDash;

  // Gradient color: green → yellow → red based on speed
  const trackColor = fanSpeed === 0 ? '#1C1C1E' :
    fanSpeed < 40 ? '#22C55E' :
    fanSpeed < 70 ? '#F59E0B' : '#EF4444';

  // Rotate SVG arc from the start angle
  const arcRotation = `rotate(${startAngle} ${cx} ${cy})`;

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-left">

      {/* Dial + speed display */}
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="relative">
          <svg width="160" height="160" viewBox="0 0 160 160">
            {/* Background track */}
            <circle
              cx={cx} cy={cy} r={radius}
              fill="none"
              stroke="#1C1C1E"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(totalArc / 360) * circumference} ${circumference}`}
              transform={arcRotation}
            />
            {/* Active track */}
            {fanSpeed > 0 && (
              <circle
                cx={cx} cy={cy} r={radius}
                fill="none"
                stroke={trackColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${strokeDash} ${strokeGap}`}
                transform={arcRotation}
                className="transition-all duration-300"
              />
            )}
            {/* Fan icon in center */}
            <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize="28" fontFamily="monospace" fontWeight="900">
              {fanSpeed}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" fill="#6B6B6B" fontSize="10" fontFamily="monospace" fontWeight="700">
              %
            </text>
            <text x={cx} y={cy + 26} textAnchor="middle" fill="#6B6B6B" fontSize="8" fontFamily="monospace" fontWeight="600" letterSpacing="2">
              SPEED
            </text>
          </svg>

          {/* Fan spin animation icon */}
          <div className={`absolute bottom-2 right-2 ${fanSpeed > 0 ? 'text-white' : 'text-[#3C3C3E]'}`}>
            <Wind size={16} className={fanSpeed > 60 ? 'animate-pulse' : ''} />
          </div>
        </div>

        {/* Status badge */}
        <div className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
          fanSpeed === 0 ? 'bg-[#1C1C1E] text-text-secondary' :
          fanSpeed < 40 ? 'bg-green-950 text-green-400 border border-green-900' :
          fanSpeed < 70 ? 'bg-amber-950 text-amber-400 border border-amber-900' :
          'bg-red-950 text-red-400 border border-red-900'
        }`}>
          {fanSpeed === 0 ? 'Fan Off' : fanSpeed < 40 ? 'Silent Mode' : fanSpeed < 70 ? 'Normal Mode' : 'Turbo Mode'}
        </div>
      </div>

      {/* Presets Grid */}
      <div className="flex flex-col gap-2">
        <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest px-0.5">Fan Presets</span>
        <div className="grid grid-cols-4 gap-2">
          {FAN_PRESETS.map((p) => {
            const isActive = fanSpeed === p.speed;
            return (
              <button
                key={p.label}
                onClick={() => setFanSpeed(p.speed)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-center transition-all ${
                  isActive
                    ? 'bg-white border-white text-black'
                    : 'bg-[#0B0B0C] border-border text-text-secondary hover:border-[#3C3C3E] hover:text-text-primary'
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-wider">{p.label}</span>
                <span className={`text-[8px] font-mono ${isActive ? 'text-black/60' : 'text-text-secondary'}`}>{p.speed}%</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fine slider */}
      <div className="bg-[#0B0B0C] border border-border rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-text-primary uppercase tracking-widest">Fan Speed</span>
          <span className="font-mono text-sm font-black text-text-primary">{fanSpeed}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={fanSpeed}
          onChange={(e) => setFanSpeed(parseInt(e.target.value))}
          className="w-full cursor-pointer"
          style={{
            background: fanSpeed === 0 ? '#1C1C1E' :
              `linear-gradient(to right, #22C55E 0%, ${trackColor} ${fanSpeed}%, #1C1C1E ${fanSpeed}%, #1C1C1E 100%)`,
            height: '4px',
            borderRadius: '9999px',
          }}
        />
        <div className="flex justify-between text-[8px] text-text-secondary font-mono mt-1">
          <span>Off</span>
          <span>Silent</span>
          <span>Normal</span>
          <span>Turbo</span>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-[#0B0B0C] border border-border rounded-2xl p-4 flex flex-col gap-2">
        <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest">Fan Info</span>
        <div className="grid grid-cols-2 gap-3 text-left">
          <div>
            <div className="text-[8px] text-text-secondary uppercase tracking-wider font-bold">Controller</div>
            <div className="text-xs font-mono text-text-primary mt-0.5">PWM · PIN 33</div>
          </div>
          <div>
            <div className="text-[8px] text-text-secondary uppercase tracking-wider font-bold">Driver Type</div>
            <div className="text-xs font-mono text-text-primary mt-0.5">Active-Low</div>
          </div>
          <div>
            <div className="text-[8px] text-text-secondary uppercase tracking-wider font-bold">MQTT Status</div>
            <div className={`text-xs font-mono mt-0.5 ${status === 'connected' ? 'text-green-400' : 'text-text-secondary'}`}>
              {status === 'connected' ? 'Live' : 'Offline'}
            </div>
          </div>
          <div>
            <div className="text-[8px] text-text-secondary uppercase tracking-wider font-bold">Persisted</div>
            <div className="text-xs font-mono text-text-primary mt-0.5">NVS Flash</div>
          </div>
        </div>
        <p className="text-[8px] text-text-secondary/70 leading-relaxed mt-1">
          Fan speed is saved to ESP32 flash memory and persists across power cycles. Set to 0% to turn the fan off completely.
        </p>
      </div>
    </div>
  );
}

export function DeviceModal({ isOpen, onClose }: DeviceModalProps) {
  const { status, power } = useStore();
  const [activeTab, setActiveTab] = useState<'control' | 'schedule' | 'fan'>('control');

  if (!isOpen) return null;

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'control',  label: 'Control' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'fan',      label: 'Fan' },
  ];

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center">
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/80 transition-opacity duration-200" onClick={onClose} />

      {/* Main Container */}
      <div className="w-full max-w-[430px] bg-[#000000] border-t border-border rounded-t-[32px] z-10 flex flex-col h-[90vh] animate-slide-up relative shadow-2xl overflow-hidden">
        {/* Drag Handle */}
        <div className="w-12 h-1 bg-border/80 rounded-full mx-auto my-3 flex-shrink-0" />

        {/* Modal Header */}
        <div className="px-5 pb-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#0B0B0C] border border-border flex items-center justify-center p-1.5 overflow-hidden">
              <img src="/logo_transparent.png" alt="Logo" className="w-full h-full object-contain"
                onError={(e) => { e.currentTarget.src = "/logo.jpeg"; }} />
            </div>
            <div>
              <h2 className="font-display font-black text-xs uppercase tracking-[0.2em] text-text-primary">Creators Reef</h2>
              <div className="flex items-center gap-1 mt-0.5">
                {status === 'connected' ? (
                  <span className="text-[9px] uppercase tracking-widest text-status-success font-black flex items-center gap-1">
                    <Wifi size={10} />ESP32 Online {!power && "(LIGHTS OFF)"}
                  </span>
                ) : status === 'connecting' ? (
                  <span className="text-[9px] uppercase tracking-widest text-status-warning font-black flex items-center gap-1">
                    <Loader size={10} className="animate-spin" />ESP32 Connecting
                  </span>
                ) : (
                  <span className="text-[9px] uppercase tracking-widest text-status-error font-black flex items-center gap-1">
                    <WifiOff size={10} />ESP32 Offline
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl bg-[#0B0B0C] border border-border text-text-secondary hover:text-text-primary hover:border-border transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Three-tab navigation */}
        <div className="flex border-b border-border/60 bg-[#0B0B0C] flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                "flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all relative",
                activeTab === tab.key
                  ? "text-text-primary font-black"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 inset-x-0 h-[2.5px] bg-white rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 no-scrollbar flex flex-col gap-6">
          {activeTab === 'control' && (
            <>
              <SPDChart />
              <ChannelControl />
            </>
          )}
          {activeTab === 'schedule' && <ScheduleEditor />}
          {activeTab === 'fan' && <FanControl />}
        </div>
      </div>
    </div>
  );
}
