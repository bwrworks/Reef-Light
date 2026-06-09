import { useStore } from '../store';

export function SPDChart() {
  const { channels, kelvin, mode } = useStore();

  // LED Channel Intensities
  const uvVal = channels.uvRed / 255;
  const blueVal = Math.max(channels.blueA, channels.blueB) / 255;
  const whiteVal = channels.white / 255;

  // Approximate Spectral Power Distribution (SPD) curves for 380nm - 700nm
  // Generate points along the spectrum
  const points: { nm: number; val: number; color: string }[] = [];
  
  for (let nm = 380; nm <= 700; nm += 10) {
    // 1. UV + Red LED peaks around 400nm and 660nm
    const uvPeak1 = Math.exp(-Math.pow((nm - 405) / 15, 2)) * 0.9 * uvVal;
    const redPeak = Math.exp(-Math.pow((nm - 660) / 20, 2)) * 0.8 * uvVal;
    const uvRedContrib = uvPeak1 + redPeak;

    // 2. Royal Blue peaks around 450nm
    const blueContrib = Math.exp(-Math.pow((nm - 450) / 20, 2)) * 1.0 * blueVal;

    // 3. Cool White peaks around 450nm (blue pump) and has broad phosphor hump around 550nm
    const whiteBluePeak = Math.exp(-Math.pow((nm - 450) / 15, 2)) * 0.4 * whiteVal;
    const whiteBroadHump = Math.exp(-Math.pow((nm - 550) / 60, 2)) * 0.7 * whiteVal;
    const whiteContrib = whiteBluePeak + whiteBroadHump;

    // Total intensity at this wavelength
    const total = Math.min(1.0, uvRedContrib + blueContrib + whiteContrib);

    // Map wavelength to approximate hex color for chart styling
    let color = '#3B82F6'; // Default blue
    if (nm < 440) color = '#8B5CF6'; // Violet/UV
    else if (nm < 490) color = '#2563EB'; // Blue
    else if (nm < 560) color = '#10B981'; // Green
    else if (nm < 590) color = '#F59E0B'; // Yellow
    else if (nm < 635) color = '#F97316'; // Orange
    else color = '#EF4444'; // Red

    points.push({ nm, val: total, color });
  }

  // Generate SVG path points
  const svgWidth = 350;
  const svgHeight = 100;

  const getX = (nm: number) => ((nm - 380) / (700 - 380)) * svgWidth;
  const getY = (val: number) => svgHeight - val * (svgHeight - 15) - 5;

  // Build the path string
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.nm)} ${getY(p.val)}`)
    .join(' ');

  const areaD = `${pathD} L ${getX(700)} ${svgHeight} L ${getX(380)} ${svgHeight} Z`;

  return (
    <div className="bg-[#0b0f1f] border border-border rounded-2xl p-5 shadow-lg relative overflow-hidden">
      <div className="flex justify-between items-start mb-3 z-10 relative">
        <div>
          <span className="text-[10px] text-text-secondary font-bold uppercase tracking-widest block">
            Spectral Output
          </span>
          <span className="font-display font-bold text-sm text-text-primary mt-0.5 block">
            {mode === 'kelvin' ? `${kelvin}K Preset` : 'Custom Spectrum'}
          </span>
        </div>
        
        <div className="font-mono text-xs text-text-secondary bg-[#12192e] px-2.5 py-1 rounded-full border border-border">
          {mode === 'auto' ? 'SCHEDULE' : mode.toUpperCase()}
        </div>
      </div>

      {/* SVG Spectrum area */}
      <div className="relative h-24 mt-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full overflow-visible"
        >
          {/* Grids */}
          {[450, 550, 650].map((wl) => (
            <line
              key={wl}
              x1={getX(wl)}
              y1={5}
              x2={getX(wl)}
              y2={svgHeight}
              stroke="rgba(26, 36, 61, 0.3)"
              strokeWidth="1"
            />
          ))}

          {/* Filled Area with Gradient */}
          <path d={areaD} fill="url(#specGrad)" className="transition-all duration-300" />

          {/* Glowing stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#strokeGrad)"
            strokeWidth="2.5"
            className="transition-all duration-300"
            filter="url(#glow)"
          />
          
          {/* Base stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#strokeGrad)"
            strokeWidth="1.5"
            className="transition-all duration-300"
          />

          {/* Chart Defs */}
          <defs>
            {/* Glow Filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Area Fill Gradient */}
            <linearGradient id="specGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </linearGradient>

            {/* Stroke Spectrum Gradient */}
            <linearGradient id="strokeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8B5CF6" /> {/* UV/Violet */}
              <stop offset="25%" stopColor="#2563EB" /> {/* Blue */}
              <stop offset="50%" stopColor="#10B981" /> {/* Green */}
              <stop offset="75%" stopColor="#F59E0B" /> {/* Yellow */}
              <stop offset="100%" stopColor="#EF4444" /> {/* Red */}
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Wavelength ticks */}
      <div className="flex justify-between font-mono text-[8px] text-text-secondary mt-1 px-0.5">
        <span>400nm</span>
        <span>500nm</span>
        <span>600nm</span>
        <span>700nm</span>
      </div>
    </div>
  );
}
