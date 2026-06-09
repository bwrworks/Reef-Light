import React, { useRef, useState, useEffect } from 'react';
import { useStore, DAY_NAMES, DEFAULT_SCHEDULE } from '../store';
import type { ScheduleState } from '../store';
import { Save, AlertCircle, Sparkles, Power, Copy, ChevronRight, Sunrise, Sunset } from 'lucide-react';

// Summary of a day schedule as a short string
const summarizeSchedule = (s: ScheduleState): string => {
  const fmtHour = (h: number, m: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m < 10 ? '0' + m : m} ${period}`;
  };
  if (!s.enabled) return 'Off';
  return `${fmtHour(s.sunriseHour, s.sunriseMin)} – ${fmtHour(s.sunsetHour, s.sunsetMin)}`;
};

export function ScheduleEditor() {
  const { schedule, weekDays, editingDayIndex, updateSchedule, saveSchedule, setEditingDay, copyToAllDays, showToast } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeHandle, setActiveHandle] = useState<'sunrise' | 'sunset' | null>(null);
  const [nowMins, setNowMins] = useState(0);
  const [viewMode, setViewMode] = useState<'edit' | 'list'>('edit');

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

  // SVG dimensions
  const svgWidth = 400;
  const svgHeight = 140;

  const getX = (mins: number) => (mins / 1440) * svgWidth;
  const getY = (pct: number) => svgHeight - (pct / 100) * (svgHeight - 20) - 10;

  const srStart = schedule.sunriseHour * 60 + schedule.sunriseMin;
  const srEnd = srStart + schedule.rampMinutes;
  const ssStart = schedule.sunsetHour * 60 + schedule.sunsetMin;
  const ssEnd = ssStart + schedule.rampMinutes;

  const pointsBlue = [
    { x: 0, y: 0 }, { x: srStart, y: 0 }, { x: srEnd, y: schedule.peakBlue },
    { x: ssStart, y: schedule.peakBlue }, { x: ssEnd, y: 0 }, { x: 1440, y: 0 },
  ];
  const pointsWhite = [
    { x: 0, y: 0 }, { x: srStart, y: 0 }, { x: srEnd, y: schedule.peakWhite },
    { x: ssStart, y: schedule.peakWhite }, { x: ssEnd, y: 0 }, { x: 1440, y: 0 },
  ];
  const pointsUvRed = [
    { x: 0, y: 0 }, { x: srStart, y: 0 }, { x: srEnd, y: schedule.peakUvRed },
    { x: ssStart, y: schedule.peakUvRed }, { x: ssEnd, y: 0 }, { x: 1440, y: 0 },
  ];

  const makePath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.x)} ${getY(p.y)}`).join(' ');

  const minsToTime = (mins: number) => ({
    hour: Math.floor(mins / 60) % 24,
    min: Math.floor(mins % 60),
  });

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (!activeHandle || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const dragMins = Math.round(relX * 1440);
    if (activeHandle === 'sunrise') {
      const newMins = Math.min(dragMins, ssStart - schedule.rampMinutes - 30);
      const t = minsToTime(Math.max(0, newMins));
      updateSchedule({ sunriseHour: t.hour, sunriseMin: t.min });
    } else if (activeHandle === 'sunset') {
      const newMins = Math.max(dragMins, srEnd + 30);
      const t = minsToTime(Math.min(1440 - schedule.rampMinutes, newMins));
      updateSchedule({ sunsetHour: t.hour, sunsetMin: t.min });
    }
  };

  const get12hParts = (hour: number, min: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return { h12, min, period };
  };
  const srParts = get12hParts(schedule.sunriseHour, schedule.sunriseMin);
  const ssParts = get12hParts(schedule.sunsetHour, schedule.sunsetMin);

  const handleTimeChange = (type: 'sunrise' | 'sunset', h12: number, min: number, period: string) => {
    let hour = h12 % 12;
    if (period === 'PM') hour += 12;
    if (type === 'sunrise') updateSchedule({ sunriseHour: hour, sunriseMin: min });
    else updateSchedule({ sunsetHour: hour, sunsetMin: min });
  };

  const hoursOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutesOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const rampPct = ((schedule.rampMinutes - 15) / (180 - 15)) * 100;

  const presets = [
    { name: 'Growth', sunriseHour: 8, sunriseMin: 0, sunsetHour: 20, sunsetMin: 0, rampMinutes: 60, peakUvRed: 50, peakBlue: 90, peakWhite: 40 },
    { name: 'Deep Blue', sunriseHour: 7, sunriseMin: 0, sunsetHour: 21, sunsetMin: 0, rampMinutes: 90, peakUvRed: 35, peakBlue: 95, peakWhite: 15 },
    { name: 'Shallow', sunriseHour: 9, sunriseMin: 0, sunsetHour: 19, sunsetMin: 0, rampMinutes: 60, peakUvRed: 25, peakBlue: 70, peakWhite: 60 },
    { name: 'Acclimate', sunriseHour: 8, sunriseMin: 0, sunsetHour: 20, sunsetMin: 0, rampMinutes: 120, peakUvRed: 15, peakBlue: 45, peakWhite: 20 }
  ];

  // ── All Schedules List View ──────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-text-primary uppercase tracking-widest">Weekly Schedule</span>
            <span className="text-[9px] text-text-secondary block mt-0.5">7-day lighting programme</span>
          </div>
          <button
            onClick={() => setViewMode('edit')}
            className="py-1.5 px-3 bg-white text-black text-[9px] font-bold uppercase tracking-wider rounded-xl"
          >
            Edit Day
          </button>
        </div>

        {/* Day list */}
        <div className="flex flex-col gap-2">
          {DAY_NAMES.map((day, idx) => {
            const daySched = weekDays[idx] ?? DEFAULT_SCHEDULE;
            const isToday = idx === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
            const isEditing = idx === editingDayIndex;
            return (
              <button
                key={day}
                onClick={() => { setEditingDay(idx); setViewMode('edit'); }}
                className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                  isEditing
                    ? 'bg-white border-white'
                    : 'bg-[#0B0B0C] border-border hover:border-[#3C3C3E]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Day initial pill */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black uppercase tracking-widest flex-shrink-0 ${
                    isToday ? 'bg-black border border-white text-white' :
                    isEditing ? 'bg-black text-white' :
                    'bg-[#121214] text-text-secondary'
                  }`}>
                    {day.slice(0, 2)}
                  </div>
                  <div>
                    <div className={`text-xs font-bold uppercase tracking-wider ${isEditing ? 'text-black' : 'text-text-primary'}`}>
                      {day}{isToday && <span className={`ml-1.5 text-[8px] ${isEditing ? 'text-black/60' : 'text-text-secondary'}`}>Today</span>}
                    </div>
                    {/* Mini 24h bar preview */}
                    <div className="w-28 h-1 bg-[#1C1C1E] rounded-full mt-1.5 overflow-hidden relative">
                      {daySched.enabled && (() => {
                        const sr = (daySched.sunriseHour * 60 + daySched.sunriseMin) / 1440;
                        const se = (daySched.sunsetHour * 60 + daySched.sunsetMin) / 1440;
                        return (
                          <div
                            className="absolute top-0 h-full bg-gradient-to-r from-pink-500 via-blue-500 to-pink-500 rounded-full"
                            style={{ left: `${sr * 100}%`, right: `${(1 - se) * 100}%` }}
                          />
                        );
                      })()}
                    </div>
                    <div className={`text-[9px] font-mono mt-0.5 ${isEditing ? 'text-black/70' : 'text-text-secondary'}`}>
                      {summarizeSchedule(daySched)} · Ramp {daySched.rampMinutes}m
                    </div>
                  </div>
                </div>
                <ChevronRight size={14} className={isEditing ? 'text-black/40' : 'text-text-secondary'} />
              </button>
            );
          })}
        </div>

        {/* Copy to all */}
        <button
          onClick={copyToAllDays}
          className="w-full py-3 border border-border text-text-secondary hover:text-text-primary hover:border-[#3C3C3E] rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
        >
          <Copy size={12} />
          Copy {DAY_NAMES[editingDayIndex]}'s Schedule to All Days
        </button>
      </div>
    );
  }

  // ── Daily Edit View ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 select-none text-left">

      {/* Day Pills row + view toggle */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest">Editing Day</span>
          <button
            onClick={() => setViewMode('list')}
            className="text-[9px] font-bold text-white uppercase tracking-widest hover:underline"
          >
            View All →
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {DAY_NAMES.map((day, idx) => {
            const isToday = idx === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
            const isActive = idx === editingDayIndex;
            const daySched = weekDays[idx];
            return (
              <button
                key={day}
                onClick={() => setEditingDay(idx)}
                className={`py-2 flex flex-col items-center gap-1 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-white border-white text-black'
                    : 'bg-[#0B0B0C] border-border text-text-secondary hover:border-[#3C3C3E] hover:text-text-primary'
                }`}
              >
                <span className="text-[9px] font-black uppercase">{day.slice(0, 2)}</span>
                {/* Enabled dot */}
                <span className={`w-1 h-1 rounded-full ${daySched?.enabled ? (isActive ? 'bg-black' : 'bg-white/60') : 'bg-transparent'}`} />
                {isToday && (
                  <span className={`w-1 h-1 rounded-full ${isActive ? 'bg-black/40' : 'bg-white/30'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Presets row + Enable toggle */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <Sparkles size={11} className="text-text-secondary" />
            <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest">Presets</span>
          </div>
          <button
            type="button"
            onClick={() => { updateSchedule({ enabled: !schedule.enabled }); showToast(schedule.enabled ? 'Schedule Off' : 'Schedule On'); }}
            className={`flex items-center gap-1.5 py-1 px-2.5 rounded-full border text-[9px] font-bold uppercase tracking-widest transition-all ${
              schedule.enabled ? 'bg-white border-white text-black' : 'bg-[#0B0B0C] border-[#3C3C3E] text-text-secondary'
            }`}
          >
            <Power size={9} />
            {schedule.enabled ? 'Active' : 'Off'}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {presets.map((p) => {
            const isMatch = schedule.sunriseHour === p.sunriseHour && schedule.sunsetHour === p.sunsetHour &&
              schedule.rampMinutes === p.rampMinutes && schedule.peakBlue === p.peakBlue &&
              schedule.peakWhite === p.peakWhite && schedule.peakUvRed === p.peakUvRed;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => { updateSchedule(p); showToast(`Loaded: ${p.name}`); }}
                className={`py-2.5 px-1 text-[9px] font-bold uppercase tracking-wider rounded-xl border transition-all ${
                  isMatch ? 'bg-white border-white text-black font-black' : 'bg-[#0b0b0c] border-[#1C1C1E] text-text-secondary hover:text-text-primary hover:border-[#3C3C3E]'
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 24H SVG Chart */}
      <div className={`bg-[#0B0B0C] border border-border rounded-2xl p-4 shadow-lg relative overflow-hidden transition-opacity duration-300 ${!schedule.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold text-text-primary uppercase tracking-widest">{DAY_NAMES[editingDayIndex]} — 24H Cycle</span>
          <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold">Drag to edit</span>
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto cursor-crosshair overflow-visible"
          onMouseMove={handleMouseMove}
          onTouchMove={handleMouseMove}
          onMouseLeave={() => setActiveHandle(null)}
          onMouseUp={() => setActiveHandle(null)}
          onTouchEnd={() => setActiveHandle(null)}
        >
          {[6, 12, 18].map((h) => (
            <line key={h} x1={getX(h * 60)} y1={10} x2={getX(h * 60)} y2={svgHeight - 10}
              stroke="rgba(255,255,255,0.07)" strokeDasharray="2 3" />
          ))}
          {/* Current time */}
          <line x1={getX(nowMins)} y1={8} x2={getX(nowMins)} y2={svgHeight - 8}
            stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={getX(nowMins)} cy={8} r="2.5" fill="white" opacity="0.6" />

          {/* Fill areas */}
          <path d={`${makePath(pointsBlue)} L ${getX(1440)} ${getY(0)} L 0 ${getY(0)} Z`}
            fill="url(#blueGrad)" opacity="0.12" />
          <path d={`${makePath(pointsUvRed)} L ${getX(1440)} ${getY(0)} L 0 ${getY(0)} Z`}
            fill="url(#uvRedGrad)" opacity="0.08" />

          {/* Lines */}
          <path d={makePath(pointsBlue)} fill="none" stroke="#2563EB" strokeWidth="2.5" />
          <path d={makePath(pointsWhite)} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeDasharray="4 3" />
          <path d={makePath(pointsUvRed)} fill="none" stroke="#EC4899" strokeWidth="2" />

          {/* Sunrise Handle */}
          <circle cx={getX(srStart)} cy={getY(0)} r="8" fill="#0B0B0C" stroke="white" strokeWidth="2"
            className="cursor-grab active:cursor-grabbing" style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
            onMouseDown={() => setActiveHandle('sunrise')} onTouchStart={() => setActiveHandle('sunrise')} />
          <Sunrise size={10} />

          {/* Sunset Handle */}
          <circle cx={getX(ssStart)} cy={getY(0)} r="8" fill="#0B0B0C" stroke="white" strokeWidth="2"
            className="cursor-grab active:cursor-grabbing" style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
            onMouseDown={() => setActiveHandle('sunset')} onTouchStart={() => setActiveHandle('sunset')} />

          {/* Peak Blue dot */}
          <circle cx={getX((srEnd + ssStart) / 2)} cy={getY(schedule.peakBlue)} r="6" fill="#2563EB" stroke="white" strokeWidth="1.5" />
          {/* Peak UV dot */}
          <circle cx={getX((srEnd + ssStart) / 2 + 40)} cy={getY(schedule.peakUvRed)} r="5" fill="#EC4899" stroke="white" strokeWidth="1.5" />
          {/* Peak White dot */}
          <circle cx={getX((srEnd + ssStart) / 2 - 40)} cy={getY(schedule.peakWhite)} r="5" fill="white" stroke="#3C3C3E" strokeWidth="1.5" />

          <defs>
            <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" /><stop offset="100%" stopColor="transparent" />
            </linearGradient>
            <linearGradient id="uvRedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EC4899" /><stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </svg>
        <div className="flex justify-between font-mono text-[9px] text-text-secondary mt-2 px-1">
          <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span>
        </div>
      </div>

      {/* Time Settings Grid */}
      <div className={`grid grid-cols-2 gap-2 sm:gap-3 items-stretch transition-opacity duration-300 ${!schedule.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
        {/* Sunrise */}
        <div className="bg-[#0B0B0C] border border-border rounded-2xl p-3 sm:p-4 flex flex-col gap-3">
          <span className="text-[10px] text-white font-bold uppercase tracking-widest flex items-center gap-1.5">
            <Sunrise size={10} /> Sunrise
          </span>
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">Start Time</span>
            <div className="flex items-center justify-start gap-0.5 bg-[#121214] border border-[#1C1C1E] rounded-xl py-1 px-1.5 h-9 w-fit">
              <select value={srParts.h12} onChange={(e) => handleTimeChange('sunrise', parseInt(e.target.value), srParts.min, srParts.period)}
                className="bg-transparent text-xs text-text-primary outline-none cursor-pointer text-center font-bold w-7 px-0 appearance-none">
                {hoursOptions.map(h => <option key={h} className="bg-[#0B0B0C]" value={h}>{h}</option>)}
              </select>
              <span className="text-text-secondary font-bold select-none">:</span>
              <select value={srParts.min} onChange={(e) => handleTimeChange('sunrise', srParts.h12, parseInt(e.target.value), srParts.period)}
                className="bg-transparent text-xs text-text-primary outline-none cursor-pointer text-center font-bold w-7 px-0 appearance-none">
                {minutesOptions.map(m => <option key={m} className="bg-[#0B0B0C]" value={m}>{m < 10 ? `0${m}` : m}</option>)}
              </select>
              <select value={srParts.period} onChange={(e) => handleTimeChange('sunrise', srParts.h12, srParts.min, e.target.value)}
                className="bg-transparent text-[10px] text-white outline-none cursor-pointer text-center font-black w-8 px-0 appearance-none">
                <option value="AM" className="bg-[#0B0B0C]">AM</option>
                <option value="PM" className="bg-[#0B0B0C]">PM</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-text-secondary font-medium">
              <span>Ramp</span>
              <span className="text-text-primary font-mono">{schedule.rampMinutes}m</span>
            </div>
            <input type="range" min="15" max="180" step="15" value={schedule.rampMinutes}
              onChange={(e) => updateSchedule({ rampMinutes: parseInt(e.target.value) })}
              className="w-full cursor-pointer"
              style={{ background: `linear-gradient(to right, #9CA3AF 0%, #9CA3AF ${rampPct}%, #1C1C1E ${rampPct}%, #1C1C1E 100%)`, height: '3px', borderRadius: '9999px' }} />
          </div>
        </div>

        {/* Sunset */}
        <div className="bg-[#0B0B0C] border border-border rounded-2xl p-3 sm:p-4 flex flex-col gap-3">
          <span className="text-[10px] text-white font-bold uppercase tracking-widest flex items-center gap-1.5">
            <Sunset size={10} /> Sunset
          </span>
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">Start Time</span>
            <div className="flex items-center justify-start gap-0.5 bg-[#121214] border border-[#1C1C1E] rounded-xl py-1 px-1.5 h-9 w-fit">
              <select value={ssParts.h12} onChange={(e) => handleTimeChange('sunset', parseInt(e.target.value), ssParts.min, ssParts.period)}
                className="bg-transparent text-xs text-text-primary outline-none cursor-pointer text-center font-bold w-7 px-0 appearance-none">
                {hoursOptions.map(h => <option key={h} className="bg-[#0B0B0C]" value={h}>{h}</option>)}
              </select>
              <span className="text-text-secondary font-bold select-none">:</span>
              <select value={ssParts.min} onChange={(e) => handleTimeChange('sunset', ssParts.h12, parseInt(e.target.value), ssParts.period)}
                className="bg-transparent text-xs text-text-primary outline-none cursor-pointer text-center font-bold w-7 px-0 appearance-none">
                {minutesOptions.map(m => <option key={m} className="bg-[#0B0B0C]" value={m}>{m < 10 ? `0${m}` : m}</option>)}
              </select>
              <select value={ssParts.period} onChange={(e) => handleTimeChange('sunset', ssParts.h12, ssParts.min, e.target.value)}
                className="bg-transparent text-[10px] text-white outline-none cursor-pointer text-center font-black w-8 px-0 appearance-none">
                <option value="AM" className="bg-[#0B0B0C]">AM</option>
                <option value="PM" className="bg-[#0B0B0C]">PM</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-auto">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span>Sunset Ramp</span>
              <span className="text-text-primary font-mono">{schedule.rampMinutes}m</span>
            </div>
            <div className="text-[8px] text-text-secondary italic flex items-center gap-1 bg-[#121214] p-1.5 rounded-xl border border-border/40 leading-snug">
              <AlertCircle size={9} className="flex-shrink-0" />
              <span>Mirrors sunrise ramp.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Peak Intensities */}
      <div className={`bg-[#0B0B0C] border border-border rounded-xl p-5 transition-opacity duration-300 ${!schedule.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <span className="text-[10px] text-text-primary font-bold uppercase tracking-widest block mb-4">Peak Intensities</span>
        <div className="flex flex-col gap-5">
          {/* UV/Red */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-text-secondary font-medium">
              <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>UV + Red</span>
              <span className="font-mono text-text-primary">{schedule.peakUvRed}%</span>
            </div>
            <input type="range" min="0" max="100" value={schedule.peakUvRed}
              onChange={(e) => updateSchedule({ peakUvRed: parseInt(e.target.value) })}
              className="w-full cursor-pointer"
              style={{ background: `linear-gradient(to right, #EC4899 0%, #EF4444 ${schedule.peakUvRed}%, #1C1C1E ${schedule.peakUvRed}%, #1C1C1E 100%)`, height: '3px', borderRadius: '9999px' }} />
          </div>
          {/* Blue */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-text-secondary font-medium">
              <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Royal Blue</span>
              <span className="font-mono text-text-primary">{schedule.peakBlue}%</span>
            </div>
            <input type="range" min="0" max="100" value={schedule.peakBlue}
              onChange={(e) => updateSchedule({ peakBlue: parseInt(e.target.value) })}
              className="w-full cursor-pointer"
              style={{ background: `linear-gradient(to right, #1E40AF 0%, #2563EB ${schedule.peakBlue}%, #1C1C1E ${schedule.peakBlue}%, #1C1C1E 100%)`, height: '3px', borderRadius: '9999px' }} />
          </div>
          {/* White */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-text-secondary font-medium">
              <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-white/70 border border-[#3C3C3E]"></span>Cool White</span>
              <span className="font-mono text-text-primary">{schedule.peakWhite}%</span>
            </div>
            <input type="range" min="0" max="100" value={schedule.peakWhite}
              onChange={(e) => updateSchedule({ peakWhite: parseInt(e.target.value) })}
              className="w-full cursor-pointer"
              style={{ background: `linear-gradient(to right, #9CA3AF 0%, #F3F4F6 ${schedule.peakWhite}%, #1C1C1E ${schedule.peakWhite}%, #1C1C1E 100%)`, height: '3px', borderRadius: '9999px' }} />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copyToAllDays}
          className="flex-1 py-3.5 bg-[#0B0B0C] border border-border text-text-secondary hover:text-text-primary hover:border-[#3C3C3E] rounded-xl font-bold uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-1.5"
        >
          <Copy size={12} />
          Copy to All
        </button>
        <button
          type="button"
          onClick={saveSchedule}
          className="flex-[2] py-3.5 bg-white text-black rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md"
        >
          <Save size={14} />
          Send to ESP32
        </button>
      </div>
    </div>
  );
}
