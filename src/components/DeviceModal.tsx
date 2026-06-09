import { useState } from 'react';
import { useStore } from '../store';
import { X, Wifi, WifiOff, Loader } from 'lucide-react';
import { SPDChart } from './SPDChart';
import { ChannelControl } from './ChannelControl';
import { ScheduleEditor } from './ScheduleEditor';
import { clsx } from 'clsx';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeviceModal({ isOpen, onClose }: DeviceModalProps) {
  const { status, power } = useStore();
  const [activeTab, setActiveTab] = useState<'control' | 'schedule'>('control');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center">
      {/* Dark Overlay */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-xs transition-opacity duration-200" 
        onClick={onClose}
      />

      {/* Main Container */}
      <div className="w-full max-w-[430px] bg-bg-base border-t border-border rounded-t-[32px] z-10 flex flex-col h-[90vh] animate-slide-up relative shadow-2xl overflow-hidden">
        {/* Drag Indicator handle */}
        <div className="w-12 h-1 bg-border/80 rounded-full mx-auto my-3 flex-shrink-0" />

        {/* Modal Header (Logo + Title + Status) */}
        <div className="px-5 pb-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-bg-card border border-border flex items-center justify-center p-1.5 overflow-hidden">
              <img 
                src="/logo_transparent.png" 
                alt="Logo" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = "/logo.jpeg";
                }}
              />
            </div>
            <div>
              <h2 className="font-display font-black text-xs uppercase tracking-[0.2em] text-text-primary">
                Creators Reef
              </h2>
              <div className="flex items-center gap-1 mt-0.5">
                {status === 'connected' ? (
                  <span className="text-[9px] uppercase tracking-widest text-status-success font-black flex items-center gap-1">
                    <Wifi size={10} />
                    ESP32 Online {!power && "(LIGHTS OFF)"}
                  </span>
                ) : status === 'connecting' ? (
                  <span className="text-[9px] uppercase tracking-widest text-status-warning font-black flex items-center gap-1">
                    <Loader size={10} className="animate-spin" />
                    ESP32 Connecting
                  </span>
                ) : (
                  <span className="text-[9px] uppercase tracking-widest text-status-error font-black flex items-center gap-1">
                    <WifiOff size={10} />
                    ESP32 Offline
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-bg-card border border-border text-text-secondary hover:text-text-primary hover:border-border transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Tabs (CONTROL / SCHEDULE) */}
        <div className="flex border-b border-border/60 bg-bg-card flex-shrink-0">
          <button
            onClick={() => setActiveTab('control')}
            className={clsx(
              "flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 relative",
              activeTab === 'control' 
                ? "border-text-primary text-text-primary font-black" 
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            Control
            {activeTab === 'control' && (
              <span className="absolute bottom-0 inset-x-0 h-[2.5px] bg-white rounded-full" />
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('schedule')}
            className={clsx(
              "flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 relative",
              activeTab === 'schedule' 
                ? "border-text-primary text-text-primary font-black" 
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            Schedule
            {activeTab === 'schedule' && (
              <span className="absolute bottom-0 inset-x-0 h-[2.5px] bg-white rounded-full" />
            )}
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="flex-1 overflow-y-auto p-5 no-scrollbar flex flex-col gap-6">
          {activeTab === 'control' ? (
            <>
              {/* Spectrum graph */}
              <SPDChart />
              {/* Sliders and linked channels */}
              <ChannelControl />
            </>
          ) : (
            /* Curve curves timeline and time selector configuration */
            <ScheduleEditor />
          )}
        </div>
      </div>
    </div>
  );
}
