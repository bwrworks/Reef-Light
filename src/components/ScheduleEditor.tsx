import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../store';
import { Save, AlertCircle, Sparkles, Power } from 'lucide-react';

export function ScheduleEditor() {
  const { schedule, updateSchedule, saveSchedule, showToast } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeHandle, setActiveHandle] = useState<'sunrise' | 'sunset' | 'peakBlue' | 'peakWhite' | 'peakUvRed' | null>(null);
  const [nowMins, setNowMins] = useState(0);

  // Update current time every minute
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setNowMins(now.getHours() * 60 + now.getMinutes());
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

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
    const dragPct = Math.round(((150 - relY * 160) / 140) * 100);
    const safeDragPct = Math.max(0, Math.min(100, dragPct));

    if (activeHandle === 'sunrise') {
      const newMins = Math.min(dragMins, ssStart - schedule.rampMinutes - 30);
      const time = minsToTime(newMins);
      updateSchedule({ sunriseHour: time.hour, sunriseMin: time.min });
    } else if (activeHandle === 'sunset') {
      const newMins = Math.max(dragMins, srEnd + 30);
      const time = minsToTime(newMins);
      updateSchedule({ sunsetHour: time.hour, sunsetMin: time.min });
    } else if (activeHandle === 'peakBlue') {
      updateSchedule({ peakBlue: safeDragPct });
    } else if (activeHandle === 'peakWhite') {
      updateSchedule({ peakWhite: safeDragPct });
    } else if (activeHandle === 'peakUvRed') {
      updateSchedule({ peakUvRed: safeDragPct });
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

  // Preset loading handler
  const loadPreset = (name: string, p: { sunriseHour: number; sunriseMin: number; sunsetHour: number; sunsetMin: number; rampMinutes: number; peakUvRed: number; peakBlue: number; peakWhite: number }) => {
    updateSchedule(p);
    showToast(`Loaded Schedule Preset: ${name}`);
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

  const presets = [
    { name: 'Growth', sunriseHour: 8, sunriseMin: 0, sunsetHour: 20, sunsetMin: 0, rampMinutes: 60, peakUvRed: 50, peakBlue: 90, peakWhite: 40 },
    { name: 'Deep Blue', sunriseHour: 7, sunriseMin: 0, sunsetHour: 21, sunsetMin: 0, rampMinutes: 90, peakUvRed: 35, peakBlue: 95, peakWhite: 15 },
    { name: 'Shallow', sunriseHour: 9, sunriseMin: 0, sunsetHour: 19, sunsetMin: 0, rampMinutes: 60, peakUvRed: 25, peakBlue: 70, peakWhite: 60 },
    { name: 'Acclimate', sunriseHour: 8, sunriseMin: 0, sunsetHour: 20, sunsetMin: 0, rampMinutes: 120, peakUvRed: 15, peakBlue: 45, peakWhite: 20 }
  ];

  // Calculate percentage values for slider tracks background styling
  const rampPct = ((schedule.rampMinutes - 15) / (180 - 15)) * 100;

  return (
    <div className="flex flex-col gap-6 select-none text-left">
      
      {/* Schedule ON/OFF toggle + Presets row */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-text-secondary" />
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
              Schedule Presets
            </span>
          </div>
          {/* Schedule Enable/Disable toggle */}
          <button
            type="button"
            onClick={() => {
              updateSchedule({ enabled: !schedule.enabled });
              showToast(schedule.enabled ? 'Schedule Disabled' : 'Schedule Enabled');
            }}
            className={`flex items-center gap-1.5 py-1 px-2.5 rounded-full border text-[9px] font-bold uppercase tracking-widest transition-all ${
              schedule.enabled
                ? 'bg-white border-white text-black'
                : 'bg-[#0B0B0C] border-[#3C3C3E] text-text-secondary hover:text-text-primary'
            }`}
          >
            <Power size={9} />
            {schedule.enabled ? 'Active' : 'Off'}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {presets.map((p) => {
            const isMatch = 
              schedule.sunriseHour === p.sunriseHour &&
              schedule.sunsetHour === p.sunsetHour &&
              schedule.rampMinutes === p.rampMinutes &&
              schedule.peakBlue === p.peakBlue &&
              schedule.peakWhite === p.peakWhite &&
              schedule.peakUvRed === p.peakUvRed;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => loadPreset(p.name, p)}
                className={`py-2.5 px-1 text-[9px] font-bold uppercase tracking-wider rounded-xl border transition-all ${
                  isMatch 
                    ? "bg-white border-white text-black font-black" 
                    : "bg-[#0b0b0c] border-[#1C1C1E] text-text-secondary hover:text-text-primary hover:border-[#3C3C3E]"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* SVG Chart Container */}
      <div className={`bg-[#0B0B0C] border border-border rounded-2xl p-4 shadow-lg relative overflow-hidden transition-opacity duration-300 ${!schedule.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold text-text-primary uppercase tracking-widest">
            24H Cycle Graph
          </span>
          <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold">
            Drag nodes to edit
          </span>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto cursor-crosshair overflow-visible"
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
              stroke="rgba(255, 255, 255, 0.07)"
              strokeDasharray="2 3"
            />
          ))}

          {/* Current time vertical indicator */}
          <line
            x1={getX(nowMins)}
            y1={8}
            x2={getX(nowMins)}
            y2={svgHeight - 8}
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <circle
            cx={getX(nowMins)}
            cy={8}
            r="3"
            fill="white"
            opacity="0.7"
          />

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
          <path d={makePath(pointsWhite)} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeDasharray="3 3" />
          <path d={makePath(pointsUvRed)} fill="none" stroke="#EC4899" strokeWidth="2" />

          {/* Draggable handles */}
          {/* Sunrise Start Handle */}
          <circle
            cx={getX(srStart)}
            cy={getY(0)}
            r="8"
            fill="#1C1C1E"
            stroke="white"
            strokeWidth="2"
            style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
            className="hover:scale-125 transition-transform duration-150 cursor-grab active:cursor-grabbing"
            onMouseDown={() => handleMouseDown('sunrise')}
            onTouchStart={() => handleMouseDown('sunrise')}
          />

          {/* Sunset Start Handle */}
          <circle
            cx={getX(ssStart)}
            cy={getY(0)}
            r="8"
            fill="#1C1C1E"
            stroke="white"
            strokeWidth="2"
            style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
            className="hover:scale-125 transition-transform duration-150 cursor-grab active:cursor-grabbing"
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
            strokeWidth="1.5"
            style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
            className="hover:scale-125 transition-transform duration-150 cursor-grab active:cursor-grabbing"
            onMouseDown={() => handleMouseDown('peakBlue')}
            onTouchStart={() => handleMouseDown('peakBlue')}
          />

          {/* White Peak Handle */}
          <circle
            cx={getX((srEnd + ssStart) / 2 - 30)}
            cy={getY(schedule.peakWhite)}
            r="6"
            fill="white"
            stroke="#3C3C3E"
            strokeWidth="1.5"
            style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
            className="hover:scale-125 transition-transform duration-150 cursor-grab active:cursor-grabbing"
            onMouseDown={() => handleMouseDown('peakWhite')}
            onTouchStart={() => handleMouseDown('peakWhite')}
          />

          {/* UV Peak Handle */}
          <circle
            cx={getX((srEnd + ssStart) / 2 + 30)}
            cy={getY(schedule.peakUvRed)}
            r="7"
            fill="#EC4899"
            stroke="white"
            strokeWidth="1.5"
            style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
            className="hover:scale-125 transition-transform duration-150 cursor-grab active:cursor-grabbing"
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
              <stop offset="0%" stopColor="#EC4899" />
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
      <div className={`grid grid-cols-2 gap-2 sm:gap-3.5 items-stretch transition-opacity duration-300 ${!schedule.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
        {/* Sunrise Card */}
        <div className="bg-[#0B0B0C] border border-border rounded-2xl p-3 sm:p-4 flex flex-col justify-between min-h-[165px]">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-white font-bold uppercase tracking-widest block">
              Sunrise Settings
            </span>
            <div className="flex flex-col gap-1.5 text-left mt-1">
              <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">Start Time</span>
              
              {/* Centered compact iOS-style select capsule */}
              <div className="flex items-center justify-center gap-0.5 bg-[#121214] border border-[#1C1C1E] rounded-xl py-1 px-1.5 h-9 w-full max-w-[105px]">
                {/* Hour */}
                <select
                  value={srParts.h12}
                  onChange={(e) => handleTimeChange('sunrise', parseInt(e.target.value), srParts.min, srParts.period as 'AM' | 'PM')}
                  className="bg-transparent text-xs text-text-primary outline-none cursor-pointer text-center font-bold w-7 px-0 appearance-none"
                >
                  {hoursOptions.map(h => <option key={h} className="bg-[#0B0B0C]" value={h}>{h}</option>)}
                </select>
                <span className="text-text-secondary font-bold select-none">:</span>
                {/* Min */}
                <select
                  value={srParts.min}
                  onChange={(e) => handleTimeChange('sunrise', srParts.h12, parseInt(e.target.value), srParts.period as 'AM' | 'PM')}
                  className="bg-transparent text-xs text-text-primary outline-none cursor-pointer text-center font-bold w-7 px-0 appearance-none"
                >
                  {minutesOptions.map(m => <option key={m} className="bg-[#0B0B0C]" value={m}>{m < 10 ? `0${m}` : m}</option>)}
                </select>
                {/* Period */}
                <select
                  value={srParts.period}
                  onChange={(e) => handleTimeChange('sunrise', srParts.h12, srParts.min, e.target.value as 'AM' | 'PM')}
                  className="bg-transparent text-[10px] text-white outline-none cursor-pointer text-center font-black w-7 px-0 appearance-none"
                >
                  <option value="AM" className="bg-[#0B0B0C]">AM</option>
                  <option value="PM" className="bg-[#0B0B0C]">PM</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mt-3">
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
              className="w-full cursor-pointer"
              style={{
                background: `linear-gradient(to right, #9CA3AF 0%, #9CA3AF ${rampPct}%, #1C1C1E ${rampPct}%, #1C1C1E 100%)`,
                height: '3px',
                borderRadius: '9999px',
              }}
            />
          </div>
        </div>

        {/* Sunset Card */}
        <div className="bg-[#0B0B0C] border border-border rounded-2xl p-3 sm:p-4 flex flex-col justify-between min-h-[165px]">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-white font-bold uppercase tracking-widest block">
              Sunset Settings
            </span>
            <div className="flex flex-col gap-1.5 text-left mt-1">
              <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">Start Time</span>
              
              {/* Centered compact iOS-style select capsule */}
              <div className="flex items-center justify-center gap-0.5 bg-[#121214] border border-[#1C1C1E] rounded-xl py-1 px-1.5 h-9 w-full max-w-[105px]">
                {/* Hour */}
                <select
                  value={ssParts.h12}
                  onChange={(e) => handleTimeChange('sunset', parseInt(e.target.value), ssParts.min, ssParts.period as 'AM' | 'PM')}
                  className="bg-transparent text-xs text-text-primary outline-none cursor-pointer text-center font-bold w-7 px-0 appearance-none"
                >
                  {hoursOptions.map(h => <option key={h} className="bg-[#0B0B0C]" value={h}>{h}</option>)}
                </select>
                <span className="text-text-secondary font-bold select-none">:</span>
                {/* Min */}
                <select
                  value={ssParts.min}
                  onChange={(e) => handleTimeChange('sunset', ssParts.h12, parseInt(e.target.value), ssParts.period as 'AM' | 'PM')}
                  className="bg-transparent text-xs text-text-primary outline-none cursor-pointer text-center font-bold w-7 px-0 appearance-none"
                >
                  {minutesOptions.map(m => <option key={m} className="bg-[#0B0B0C]" value={m}>{m < 10 ? `0${m}` : m}</option>)}
                </select>
                {/* Period */}
                <select
                  value={ssParts.period}
                  onChange={(e) => handleTimeChange('sunset', ssParts.h12, ssParts.min, e.target.value as 'AM' | 'PM')}
                  className="bg-transparent text-[10px] text-white outline-none cursor-pointer text-center font-black w-7 px-0 appearance-none"
                >
                  <option value="AM" className="bg-[#0B0B0C]">AM</option>
                  <option value="PM" className="bg-[#0B0B0C]">PM</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-3 justify-end">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span>Sunset Ramp Time</span>
              <span className="text-text-primary font-mono">{schedule.rampMinutes} mins</span>
            </div>
            <div className="text-[8px] text-text-secondary italic flex items-center gap-1 bg-[#121214] p-1.5 rounded-xl border border-border/40 leading-snug">
              <AlertCircle size={9} className="text-text-secondary flex-shrink-0" />
              <span>Sunset mirrors sunrise duration.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Peak Intensities Settings */}
      <div className={`bg-[#0B0B0C] border border-border rounded-xl p-5 transition-opacity duration-300 ${!schedule.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <span className="text-[10px] text-text-primary font-bold uppercase tracking-widest block mb-4">
          Peak Schedule Intensities
        </span>
        <div className="flex flex-col gap-5">
          {/* UV/Red */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-text-secondary font-medium">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
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
              className="w-full cursor-pointer"
              style={{
                background: `linear-gradient(to right, #EC4899 0%, #EF4444 ${schedule.peakUvRed}%, #1C1C1E ${schedule.peakUvRed}%, #1C1C1E 100%)`,
                height: '3px',
                borderRadius: '9999px',
              }}
            />
          </div>

          {/* Blue */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-text-secondary font-medium">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
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
              className="w-full cursor-pointer"
              style={{
                background: `linear-gradient(to right, #1E40AF 0%, #2563EB ${schedule.peakBlue}%, #1C1C1E ${schedule.peakBlue}%, #1C1C1E 100%)`,
                height: '3px',
                borderRadius: '9999px',
              }}
            />
          </div>

          {/* White */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-text-secondary font-medium">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 border border-[#3C3C3E]"></span>
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
              className="w-full cursor-pointer"
              style={{
                background: `linear-gradient(to right, #9CA3AF 0%, #F3F4F6 ${schedule.peakWhite}%, #1C1C1E ${schedule.peakWhite}%, #1C1C1E 100%)`,
                height: '3px',
                borderRadius: '9999px',
              }}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        type="button"
        onClick={saveSchedule}
        className="w-full py-4 bg-white text-black rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
      >
        <Save size={16} />
        Save Schedule to Device
      </button>
    </div>
  );
}
