import { useState } from 'react';
import { useStore } from '../store';
import type { WidgetData } from '../store';
import { Settings2, Plus, X, Calendar, Clipboard, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';

const AVAILABLE_WIDGETS = [
  { id: 'ammonia', name: 'Ammonia (NH3)', unit: 'ppm', color: '#10B981', min: 0, max: 1 },
  { id: 'nitrate', name: 'Nitrate (NO3)', unit: 'ppm', color: '#F59E0B', min: 0, max: 100 },
  { id: 'salinity', name: 'Salinity', unit: 'ppt', color: '#06B6D4', min: 28, max: 40 },
  { id: 'alkalinity', name: 'Alkalinity', unit: 'dKH', color: '#EF4444', min: 5, max: 15 },
  { id: 'calcium', name: 'Calcium', unit: 'ppm', color: '#3B82F6', min: 300, max: 550 },
  { id: 'magnesium', name: 'Magnesium', unit: 'ppm', color: '#8B5CF6', min: 1000, max: 1600 },
];

function Sparkline({ data, color }: { data: WidgetData[]; color: string }) {
  if (data.length < 2) return null;

  // Render last 5 entries, reversed to be chronological (oldest to newest)
  const history = [...data].slice(0, 5).reverse();
  const values = history.map(h => parseFloat(h.value)).filter(v => !isNaN(v));
  
  if (values.length < 2) return null;

  const width = 80;
  const height = 24;
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - minVal) / range) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible opacity-85">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {/* Small dot on the latest point */}
      {points.split(' ').map((p, i) => {
        if (i !== values.length - 1) return null;
        const [x, y] = p.split(',');
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="3"
            fill={color}
            stroke="white"
            strokeWidth="1"
          />
        );
      })}
    </svg>
  );
}

interface WidgetCardProps {
  id: string;
  name: string;
  unit: string;
  color: string;
}

function WidgetCard({ id, name, unit, color }: WidgetCardProps) {
  const { widgetData, addWidgetData } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [val, setVal] = useState('');

  const history = widgetData[id] || [];
  const latest = history.length > 0 ? history[0] : null;

  const handleSave = () => {
    if (!val) return;
    addWidgetData(id, val, unit);
    setVal('');
    setIsAdding(false);
  };

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-4 flex flex-col justify-between shadow-md relative min-h-[105px] overflow-hidden transition-all duration-200">
      {/* Top Header */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color }}>
            {name.split(' ')[0]}
          </span>
          <span className="font-display font-bold text-xs text-text-primary mt-0.5">
            {name}
          </span>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)} 
            className="p-1 rounded-lg bg-bg-base/60 hover:bg-bg-elevated/80 border border-border/30 hover:border-border text-text-secondary hover:text-text-primary transition-all"
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {/* Main Content */}
      {isAdding ? (
        <div className="flex items-center gap-1.5 mt-3 z-10">
          <input
            type="number"
            step="any"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="w-full bg-bg-base border border-border rounded-lg px-2 py-1 text-xs text-text-primary outline-none focus:border-border"
            placeholder={`${unit}`}
            autoFocus
          />
          <button 
            onClick={handleSave} 
            className="px-2.5 py-1 bg-accent-blue hover:bg-accent-blue/90 text-white text-[10px] font-bold rounded-md transition-colors"
          >
            Save
          </button>
          <button 
            onClick={() => setIsAdding(false)} 
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-elevated rounded-md"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="flex items-end justify-between mt-3">
          {latest ? (
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-xl font-black text-text-primary leading-none">
                  {latest.value}
                </span>
                <span className="text-[10px] font-bold text-text-secondary uppercase">
                  {latest.unit}
                </span>
              </div>
              <span className="text-[8px] text-text-secondary/70 mt-1 font-semibold flex items-center gap-1">
                <Calendar size={8} />
                {new Date(latest.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-text-secondary/60 italic py-1">No tests recorded</span>
          )}

          {/* Sparkline trend view */}
          {latest && <Sparkline data={history} color={color} />}
        </div>
      )}
    </div>
  );
}

export function WidgetDashboard() {
  const { widgets, toggleWidget } = useStore();
  const [editMode, setEditMode] = useState(false);

  const activeWidgets = AVAILABLE_WIDGETS.filter(w => widgets[w.id]);

  return (
    <div className="flex flex-col gap-5">
      {/* Title block */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-widest">
            Water Parameters
          </h3>
          <span className="text-[9px] text-text-secondary uppercase tracking-widest font-semibold mt-0.5 block">
            Customizable Dashboard Widgets
          </span>
        </div>
        
        <button
          onClick={() => setEditMode(!editMode)}
          className={clsx(
            "p-2 rounded-xl transition-all border shadow-sm",
            editMode 
              ? "bg-accent-blue border-accent-blue text-white" 
              : "bg-bg-card border-border text-text-secondary hover:text-text-primary hover:border-border"
          )}
        >
          <Settings2 size={16} />
        </button>
      </div>

      {editMode ? (
        /* Widget config view */
        <div className="bg-bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 animate-fade-in">
          <div className="flex items-center gap-2 text-text-secondary border-b border-border/40 pb-3">
            <Clipboard size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Configure Dashboard Cards
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {AVAILABLE_WIDGETS.map(w => (
              <label 
                key={w.id} 
                className={clsx(
                  "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all hover:bg-bg-elevated/40",
                  widgets[w.id] 
                    ? "bg-bg-elevated/20 border-border text-text-primary" 
                    : "border-border/30 text-text-secondary"
                )}
              >
                <span className="text-xs font-semibold">{w.name}</span>
                <input
                  type="checkbox"
                  checked={!!widgets[w.id]}
                  onChange={() => toggleWidget(w.id)}
                  className="w-4 h-4 rounded border-border accent-accent-blue bg-bg-base outline-none cursor-pointer"
                />
              </label>
            ))}
          </div>
        </div>
      ) : (
        /* Parameters Cards Grid */
        <div className="grid grid-cols-2 gap-4 animate-fade-in">
          {activeWidgets.map(w => (
            <WidgetCard 
              key={w.id} 
              id={w.id} 
              name={w.name} 
              unit={w.unit} 
              color={w.color} 
            />
          ))}

          {activeWidgets.length === 0 && (
            <div className="col-span-2 text-center py-10 border border-dashed border-border rounded-2xl text-text-secondary text-xs flex flex-col items-center justify-center gap-2 bg-bg-card/40">
              <TrendingUp size={20} className="text-text-secondary opacity-60" />
              <span>No active widgets.</span>
              <button 
                onClick={() => setEditMode(true)}
                className="text-accent-blue font-bold uppercase tracking-widest text-[9px] hover:underline"
              >
                Add Parameters Widget
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
