import React, { useRef, useState } from 'react';
import { useStore } from '../store';
import { Save, AlertCircle } from 'lucide-react';

export function ScheduleEditor() {
  const { schedule, updateSchedule, saveSchedule } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeHandle, setActiveHandle] = useState<'sunrise' | 'sunset' | 'peakBlue' | 'peakWhite' | 'peakUvRed' | null>(null);

  // Convert minutes of day to time object
  const minsToTime = (mins: number) => {
    const h = Math.floor(mins / 60) % 24;
    const m = Math.floor(mins % 60);
    return { hour: h, min: m };
  };

  // SVG coordinate conversions
  const svgWidth = 400;
  const svgHeight = 160;

  const getX = (mins: number) => (mins / 1440) * svgWidth;
  const getY = (pct: number) => svgHeight - (pct / 100) * (svgHeight - 20) - 10;

  // Calculate points
  const srStart = schedule.sunriseHour * 60 + schedule.sunriseMin;
  const srEnd = srStart + schedule.rampMinutes;
  const ssStart = schedule.sunsetHour * 60 + schedule.sunsetMin;
  const ssEnd = ssStart + schedule.rampMinutes;

  const pointsBlue = [
    { x: 0, y: 0 },
    { x: srStart, y: 0 },
    { x: srEnd, y: schedule.peakBlue },
    { x: ssStart, y: schedule.peakBlue },
    { x: ssEnd, y: 0 },
    { x: 1440, y: 0 },
  ];

  const pointsWhite = [
    { x: 0, y: 0 },
    { x: srStart, y: 0 },
    { x: srEnd, y: schedule.peakWhite },
    { x: ssStart, y: schedule.peakWhite },
    { x: ssEnd, y: 0 },
    { x: 1440, y: 0 },
  ];

  const pointsUvRed = [
    { x: 0, y: 0 },
    { x: srStart, y: 0 },
    { x: srEnd, y: schedule.peakUvRed },
    { x: ssStart, y: schedule.peakUvRed },
    { x: ssEnd, y: 0 },
    { x: 1440, y: 0 },
  ];

  // Drag handlers
  const handleMouseDown = (type: typeof activeHandle) => {
    setActiveHandle(type);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (!activeHandle || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const relY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    const dragMins = Math.round(relX * 1440);
    const dragPct = Math.round((1 - relY) * 100);

    if (activeHandle === 'sunrise') {
      const newMins = Math.min(dragMins, ssStart - schedule.rampMinutes - 30);
      const time = minsToTime(newMins);
      updateSchedule({ sunriseHour: time.hour, sunriseMin: time.min });
    } else if (activeHandle === 'sunset') {
      const newMins = Math.max(dragMins, srEnd + 30);
      const time = minsToTime(newMins);
      updateSchedule({ sunsetHour: time.hour, sunsetMin: time.min });
    } else if (activeHandle === 'peakBlue') {
      updateSchedule({ peakBlue: Math.max(0, Math.min(100, dragPct)) });
    } else if (activeHandle === 'peakWhite') {
      updateSchedule({ peakWhite: Math.max(0, Math.min(100, dragPct)) });
    } else if (activeHandle === 'peakUvRed') {
      updateSchedule({ peakUvRed: Math.max(0, Math.min(100, dragPct)) });
    }
  };

  const handleMouseUp = () => {
    setActiveHandle(null);
  };

  // Convert points array to SVG Path
  const makePath = (points: { x: number; y: number }[]) => {
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.x)} ${getY(p.y)}`)
      .join(' ');
  };

  // Parse time inputs
  const handleTimeChange = (type: 'sunrise' | 'sunset', h12: number, min: number, period: 'AM' | 'PM') => {
    let hour = h12 % 12;
    if (period === 'PM') hour += 12;
    
    if (type === 'sunrise') {
      updateSchedule({ sunriseHour: hour, sunriseMin: min });
    } else {
      updateSchedule({ sunsetHour: hour, sunsetMin: min });
    }
  };

  // Generate dropdown options
  const hoursOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutesOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  // Helper for 24h to 12h destructured
  const get12hParts = (hour: number, min: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return { h12, min, period };
  };

  const srParts = get12hParts(schedule.sunriseHour, schedule.sunriseMin);
  const ssParts = get12hParts(schedule.sunsetHour, schedule.sunsetMin);

  return (
    <div className="flex flex-col gap-6 select-none">
      {/* SVG Chart Container */}
      <div className="bg-[#0b0f1f] border border-border rounded-2xl p-4 shadow-lg relative overflow-hidden">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold text-text-primary uppercase tracking-widest">
            24H Cycle Graph
          </span>
          <span className="text-[10px] text-text-secondary uppercase font-semibold">
            Drag nodes to edit
          </span>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto cursor-crosshair"
          onMouseMove={handleMouseMove}
          onTouchMove={handleMouseMove}
          onMouseLeave={handleMouseUp}
          onMouseUp={handleMouseUp}
          onTouchEnd={handleMouseUp}
        >
          {/* Background grid */}
          {[6, 12, 18].map((h) => (
            <line
              key={h}
              x1={getX(h * 60)}
              y1={10}
              x2={getX(h * 60)}
              y2={svgHeight - 10}
              stroke="rgba(26, 36, 61, 0.4)"
              strokeDasharray="2 3"
            />
          ))}

          {/* Fill curves */}
          <path
            d={`${makePath(pointsBlue)} L ${getX(1440)} ${getY(0)} L 0 ${getY(0)} Z`}
            fill="url(#blueGrad)"
            opacity="0.12"
          />
          <path
            d={`${makePath(pointsUvRed)} L ${getX(1440)} ${getY(0)} L 0 ${getY(0)} Z`}
            fill="url(#uvRedGrad)"
            opacity="0.08"
          />

          {/* Stroke curves */}
          <path d={makePath(pointsBlue)} fill="none" stroke="#2563EB" strokeWidth="2.5" />
          <path d={makePath(pointsWhite)} fill="none" stroke="#F3F4F6" strokeWidth="2" strokeDasharray="3 3" />
          <path d={makePath(pointsUvRed)} fill="none" stroke="#8B5CF6" strokeWidth="2.5" />

          {/* Draggable handles */}
          {/* Sunrise Start Handle */}
          <circle
            cx={getX(srStart)}
            cy={getY(0)}
            r="8"
            fill="#2563EB"
            stroke="white"
            strokeWidth="1.5"
            className="hover:scale-125 transition-transform"
            onMouseDown={() => handleMouseDown('sunrise')}
            onTouchStart={() => handleMouseDown('sunrise')}
          />

          {/* Sunset Start Handle */}
          <circle
            cx={getX(ssStart)}
            cy={getY(0)}
            r="8"
            fill="#8B5CF6"
            stroke="white"
            strokeWidth="1.5"
            className="hover:scale-125 transition-transform"
            onMouseDown={() => handleMouseDown('sunset')}
            onTouchStart={() => handleMouseDown('sunset')}
          />

          {/* Blue Peak Handle */}
          <circle
            cx={getX((srEnd + ssStart) / 2)}
            cy={getY(schedule.peakBlue)}
            r="7"
            fill="#2563EB"
            stroke="white"
            strokeWidth="1"
            className="hover:scale-125 transition-transform"
            onMouseDown={() => handleMouseDown('peakBlue')}
            onTouchStart={() => handleMouseDown('peakBlue')}
          />

          {/* White Peak Handle */}
          <circle
            cx={getX((srEnd + ssStart) / 2 - 30)}
            cy={getY(schedule.peakWhite)}
            r="6"
            fill="#F3F4F6"
            stroke="white"
            strokeWidth="1"
            className="hover:scale-125 transition-transform"
            onMouseDown={() => handleMouseDown('peakWhite')}
            onTouchStart={() => handleMouseDown('peakWhite')}
          />

          {/* UV Peak Handle */}
          <circle
            cx={getX((srEnd + ssStart) / 2 + 30)}
            cy={getY(schedule.peakUvRed)}
            r="7"
            fill="#8B5CF6"
            stroke="white"
            strokeWidth="1"
            className="hover:scale-125 transition-transform"
            onMouseDown={() => handleMouseDown('peakUvRed')}
            onTouchStart={() => handleMouseDown('peakUvRed')}
          />

          {/* Defs for gradients */}
          <defs>
            <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
            <linearGradient id="uvRedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </svg>

        {/* Timeline bottom labels */}
        <div className="flex justify-between font-mono text-[9px] text-text-secondary mt-2 px-1">
          <span>12 AM</span>
          <span>6 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
          <span>12 AM</span>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sunrise Card */}
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <span className="text-[10px] text-accent-blue font-bold uppercase tracking-widest block mb-3">
            Sunrise Settings
          </span>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-secondary">Start Time</span>
              <div className="flex items-center gap-1">
                {/* Hour */}
                <select
                  value={srParts.h12}
                  onChange={(e) => handleTimeChange('sunrise', parseInt(e.target.value), srParts.min, srParts.period as 'AM' | 'PM')}
                  className="bg-bg-base border border-border rounded px-2 py-1 text-xs text-text-primary outline-none"
                >
                  {hoursOptions.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-text-secondary">:</span>
                {/* Min */}
                <select
                  value={srParts.min}
                  onChange={(e) => handleTimeChange('sunrise', srParts.h12, parseInt(e.target.value), srParts.period as 'AM' | 'PM')}
                  className="bg-bg-base border border-border rounded px-2 py-1 text-xs text-text-primary outline-none"
                >
                  {minutesOptions.map(m => <option key={m} value={m}>{m < 10 ? `0${m}` : m}</option>)}
                </select>
                {/* Period */}
                <select
                  value={srParts.period}
                  onChange={(e) => handleTimeChange('sunrise', srParts.h12, srParts.min, e.target.value as 'AM' | 'PM')}
                  className="bg-bg-base border border-border rounded px-2 py-1 text-xs text-text-primary outline-none"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex justify-between text-xs text-text-secondary font-medium">
                <span>Ramp Duration</span>
                <span className="text-text-primary font-mono">{schedule.rampMinutes} mins</span>
              </div>
              <input
                type="range"
                min="15"
                max="180"
                step="15"
                value={schedule.rampMinutes}
                onChange={(e) => updateSchedule({ rampMinutes: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Sunset Card */}
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <span className="text-[10px] text-accent-uv font-bold uppercase tracking-widest block mb-3">
            Sunset Settings
          </span>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-secondary">Start Time</span>
              <div className="flex items-center gap-1">
                {/* Hour */}
                <select
                  value={ssParts.h12}
                  onChange={(e) => handleTimeChange('sunset', parseInt(e.target.value), ssParts.min, ssParts.period as 'AM' | 'PM')}
                  className="bg-bg-base border border-border rounded px-2 py-1 text-xs text-text-primary outline-none"
                >
                  {hoursOptions.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-text-secondary">:</span>
                {/* Min */}
                <select
                  value={ssParts.min}
                  onChange={(e) => handleTimeChange('sunset', ssParts.h12, parseInt(e.target.value), ssParts.period as 'AM' | 'PM')}
                  className="bg-bg-base border border-border rounded px-2 py-1 text-xs text-text-primary outline-none"
                >
                  {minutesOptions.map(m => <option key={m} value={m}>{m < 10 ? `0${m}` : m}</option>)}
                </select>
                {/* Period */}
                <select
                  value={ssParts.period}
                  onChange={(e) => handleTimeChange('sunset', ssParts.h12, ssParts.min, e.target.value as 'AM' | 'PM')}
                  className="bg-bg-base border border-border rounded px-2 py-1 text-xs text-text-primary outline-none"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-text-secondary mt-1">
              <span>Sunset Ramp Time</span>
              <span className="text-text-primary font-mono">{schedule.rampMinutes} mins</span>
            </div>
            <div className="text-[10px] text-text-secondary italic flex items-center gap-1.5 bg-bg-base/40 p-2 rounded border border-border/20">
              <AlertCircle size={12} className="text-text-secondary flex-shrink-0" />
              <span>Sunset ramp mirrors sunrise duration.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Peak Intensities Settings */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <span className="text-[10px] text-text-primary font-bold uppercase tracking-widest block mb-4">
          Peak Schedule Intensities
        </span>
        <div className="flex flex-col gap-4">
          {/* UV/Red */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-text-secondary font-medium">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-uv"></span>
                UV + Red
              </span>
              <span className="font-mono text-text-primary">{schedule.peakUvRed}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={schedule.peakUvRed}
              onChange={(e) => updateSchedule({ peakUvRed: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Blue */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-text-secondary font-medium">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-blue"></span>
                Royal Blue
              </span>
              <span className="font-mono text-text-primary">{schedule.peakBlue}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={schedule.peakBlue}
              onChange={(e) => updateSchedule({ peakBlue: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* White */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-text-secondary font-medium">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-white"></span>
                Cool White
              </span>
              <span className="font-mono text-text-primary">{schedule.peakWhite}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={schedule.peakWhite}
              onChange={(e) => updateSchedule({ peakWhite: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={saveSchedule}
        className="w-full py-4 bg-accent-blue text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg hover:shadow-2xl shadow-accent-blue/25 hover:bg-accent-blue/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
      >
        <Save size={16} />
        Save Schedule to Device
      </button>
    </div>
  );
}
