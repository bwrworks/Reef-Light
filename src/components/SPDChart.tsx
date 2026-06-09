import { useStore } from '../store';
import { Sliders } from 'lucide-react';

interface SPDChartProps {
  isHome?: boolean;
  onEditClick?: () => void;
}

export function SPDChart({ isHome = false, onEditClick }: SPDChartProps) {
  const { channels, kelvin, mode } = useStore();

  // LED Wavelength Channel Intensities
  const uvVal = channels.uvRed / 255;
  const blueVal = Math.max(channels.blueA, channels.blueB) / 255;
  const whiteVal = channels.white / 255;

  // Approximate Spectral Power Distribution (SPD) curves for 380nm - 780nm
  const points: { nm: number; val: number }[] = [];
  
  for (let nm = 380; nm <= 780; nm += 5) {
    // 1. UV + Red LED peaks around 405nm (UV/violet) and 660nm (deep red)
    const uvPeak = Math.exp(-Math.pow((nm - 405) / 12, 2)) * 0.9 * uvVal;
    const redPeak = Math.exp(-Math.pow((nm - 660) / 15, 2)) * 0.8 * uvVal;
    const uvRedContrib = uvPeak + redPeak;

    // 2. Royal Blue peaks around 450nm
    const blueContrib = Math.exp(-Math.pow((nm - 450) / 18, 2)) * 1.0 * blueVal;

    // 3. Cool White peaks around 450nm (blue pump) and broad phosphor hump around 550nm
    const whiteBluePeak = Math.exp(-Math.pow((nm - 450) / 12, 2)) * 0.35 * whiteVal;
    const whiteBroadHump = Math.exp(-Math.pow((nm - 550) / 55, 2)) * 0.7 * whiteVal;
    const whiteContrib = whiteBluePeak + whiteBroadHump;

    // Total intensity at this wavelength
    const total = Math.min(1.0, uvRedContrib + blueContrib + whiteContrib);
    points.push({ nm, val: total });
  }

  // Generate SVG path points
  const svgWidth = 350;
  const svgHeight = 100;

  const getX = (nm: number) => ((nm - 380) / (780 - 380)) * svgWidth;
  const getY = (val: number) => svgHeight - val * (svgHeight - 20) - 10;

  // Build the path string
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.nm)} ${getY(p.val)}`)
    .join(' ');

  const areaD = `${pathD} L ${getX(780)} ${svgHeight} L ${getX(380)} ${svgHeight} Z`;

  const renderInnerChart = () => (
    <div className="relative h-24 mt-2">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full overflow-visible"
      >
        {/* Background dark overlay grid */}
        {/* Vertical wavelength lines */}
        {[380, 420, 460, 500, 540, 580, 620, 660, 700, 740, 780].map((wl) => (
          <line
            key={wl}
            x1={getX(wl)}
            y1={10}
            x2={getX(wl)}
            y2={svgHeight - 10}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="0.75"
          />
        ))}

        {/* Horizontal intensity lines */}
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((level) => (
          <line
            key={level}
            x1={getX(380)}
            y1={getY(level)}
            x2={getX(780)}
            y2={getY(level)}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="0.75"
          />
        ))}

        {/* Filled Wavelength Rainbow Area */}
        <path d={areaD} fill="url(#specRainbow)" opacity="0.9" className="transition-all duration-300" />

        {/* Glowing stroke */}
        {/* Clean white outline stroke for BRS style chart */}
        <path
          d={pathD}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          className="transition-all duration-300"
        />

        {/* Chart Defs */}
        <defs>

          {/* Rainbow Spectral Fill Gradient */}
          <linearGradient id="specRainbow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7C3AED" />   {/* 380nm - Deep Violet */}
            <stop offset="10%" stopColor="#4F46E5" />  {/* 420nm - Indigo */}
            <stop offset="20%" stopColor="#2563EB" />  {/* 460nm - Royal Blue */}
            <stop offset="40%" stopColor="#06B6D4" />  {/* 540nm - Cyan */}
            <stop offset="55%" stopColor="#10B981" />  {/* 580nm - Green */}
            <stop offset="70%" stopColor="#F59E0B" />  {/* 620nm - Yellow */}
            <stop offset="85%" stopColor="#EA580C" />  {/* 660nm - Orange/Red */}
            <stop offset="100%" stopColor="#EF4444" /> {/* 780nm - Deep Red */}
          </linearGradient>
        </defs>
      </svg>

      {/* Wavelength ticks */}
      <div className="flex justify-between font-mono text-[7px] text-text-secondary mt-1.5 px-0.5 select-none leading-none">
        <span>380</span>
        <span>420</span>
        <span>460</span>
        <span>500</span>
        <span>540</span>
        <span>580</span>
        <span>620</span>
        <span>660</span>
        <span>700</span>
        <span>740</span>
        <span>780</span>
      </div>
    </div>
  );

  if (isHome) {
    return (
      <div className="bg-bg-card border border-border rounded-2xl p-4 shadow-md flex flex-col justify-between min-h-[145px] transition-all duration-200">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-[9px] text-text-secondary uppercase tracking-widest font-bold">Lighting Spectrum</span>
            <span className="font-display font-bold text-xs text-text-primary mt-0.5">Current Wavelengths</span>
          </div>
          <button 
            onClick={onEditClick}
            className="p-1.5 rounded-lg bg-[#121214] hover:bg-[#1c1c1e] border border-border/80 text-text-secondary hover:text-text-primary transition-all flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider"
          >
            <Sliders size={10} />
            Edit
          </button>
        </div>
        {renderInnerChart()}
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-5 shadow-lg relative overflow-hidden">
      <div className="flex justify-between items-start mb-3 z-10 relative">
        <div>
          <span className="text-[10px] text-text-secondary font-bold uppercase tracking-widest block">
            Spectral Output
          </span>
          <span className="font-display font-bold text-sm text-text-primary mt-0.5 block">
            {mode === 'kelvin' ? `${kelvin}K Preset` : 'Custom Spectrum'}
          </span>
        </div>
        
        <div className="font-mono text-[9px] text-text-secondary bg-[#121214] px-2.5 py-1 rounded-lg border border-border uppercase font-bold tracking-wider">
          {mode === 'auto' ? 'SCHEDULE' : mode.toUpperCase()}
        </div>
      </div>
      {renderInnerChart()}
    </div>
  );
}
