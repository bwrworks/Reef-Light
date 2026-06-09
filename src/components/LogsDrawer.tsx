import { useStore } from '../store';
import { X, RefreshCw } from 'lucide-react';

interface LogsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LogsDrawer({ isOpen, onClose }: LogsDrawerProps) {
  const { sysLogs, mqttClient, showToast } = useStore();

  if (!isOpen) return null;

  const handleRefresh = () => {
    mqttClient?.publish(
      'creatorsreef/cmd/cr-849a2bf1-9c32-4d51-a719-21b9a8f4d91e',
      JSON.stringify({ cmd_type: 'get_state' })
    );
    showToast('Requested fresh logs');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200" 
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="w-full max-w-[430px] bg-bg-card border-t border-border rounded-t-3xl z-10 flex flex-col max-h-[75vh] animate-slide-up relative shadow-2xl">
        {/* Drag handle decoration */}
        <div className="w-12 h-1 bg-border rounded-full mx-auto my-3 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 border-b border-border">
          <div>
            <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-widest">
              System Logs
            </h3>
            <span className="text-[9px] text-text-secondary uppercase tracking-widest font-semibold mt-0.5 block">
              ESP32 Diagnostics
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRefresh}
              className="p-2 rounded-full hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors"
              title="Refresh Logs"
            >
              <RefreshCw size={16} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Logs Content */}
        <div className="flex-1 overflow-y-auto p-5 font-mono text-xs text-text-secondary flex flex-col gap-2.5">
          {sysLogs && sysLogs.length > 0 ? (
            sysLogs.map((log, index) => (
              <div 
                key={index} 
                className="py-2.5 px-3.5 bg-bg-base/60 border border-border/50 rounded-lg text-text-primary flex items-start gap-2.5 shadow-sm leading-relaxed"
              >
                <span className="text-accent-blue font-bold">[{index + 1}]</span>
                <span className="break-all">{log}</span>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-text-secondary flex flex-col items-center gap-2">
              <span className="text-sm">No log entries found</span>
              <span className="text-[10px] uppercase tracking-wider">
                Logs will populate on connection issues, updates, or restarts.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-bg-elevated/20 text-center text-[10px] text-text-secondary uppercase tracking-widest font-semibold rounded-t-3xl">
          Creators Aquarium — BWR Works
        </div>
      </div>
    </div>
  );
}
