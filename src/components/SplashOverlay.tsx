import { useStore } from '../store';
import { Loader2 } from 'lucide-react';

export function SplashOverlay() {
  const { status } = useStore();

  if (status === 'connected') return null;

  return (
    <div className="fixed inset-0 bg-[#040713] flex flex-col items-center justify-between py-16 px-6 z-50 animate-fade-in text-center">
      {/* Top Spacer */}
      <div></div>

      {/* Main Branding Section */}
      <div className="flex flex-col items-center gap-6">
        <div className="w-32 h-32 rounded-full bg-[#0b0f1f]/80 border border-border flex items-center justify-content overflow-hidden shadow-2xl p-4">
          <img 
            src="/logo_transparent.png" 
            alt="Creators Logo" 
            className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(37,99,235,0.4)]"
            onError={(e) => {
              // Fallback to logo.jpeg if transparent logo is missing
              e.currentTarget.src = "/logo.jpeg";
            }}
          />
        </div>
        
        <div>
          <h2 className="font-display font-bold text-lg uppercase tracking-[0.25em] text-text-primary">
            Creators Aquarium
          </h2>
          <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary mt-1.5 font-medium">
            Reef Light Controller
          </p>
        </div>
      </div>

      {/* Connection Card Section */}
      <div className="w-full max-w-[320px] flex flex-col gap-6">
        <div className="bg-[#0b0f1f] border border-[#1a243d] rounded-2xl p-5 text-left shadow-lg">
          <h4 className="text-[9px] uppercase tracking-widest text-text-secondary font-bold mb-3">
            Cloud Connection
          </h4>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary">Status</span>
            <div className="flex items-center gap-2 text-text-secondary">
              <Loader2 className="w-4 h-4 animate-spin text-accent-blue" />
              <span className="text-xs font-medium">
                {status === 'connecting' ? 'Connecting to Cloud...' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] text-text-secondary font-medium uppercase tracking-wider">
            Securing remote connection
          </span>
          <span className="text-xs font-bold text-text-primary uppercase tracking-widest">
            Cloud IoT Core
          </span>
        </div>
      </div>
    </div>
  );
}
