import { useState } from 'react';
import { useStore } from '../store';
import type { WidgetData } from '../store';
import { Settings2, Plus, X, Calendar, Clipboard, TrendingUp, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

interface ParameterConfig {
  id: string;
  name: string;
  unit: string;
  color: string;
  min: number;
  max: number;
  optimalMin: number;
  optimalMax: number;
  description: string;
  guidelines: string;
  raiseGuide: string;
  lowerGuide: string;
}

const PARAMETER_DATABASE: Record<string, ParameterConfig> = {
  ammonia: {
    id: 'ammonia',
    name: 'Ammonia (NH3)',
    unit: 'ppm',
    color: '#10B981',
    min: 0,
    max: 1.0,
    optimalMin: 0.0,
    optimalMax: 0.02,
    description: 'Ammonia is highly toxic to fish and corals. It is produced by waste and decomposing organic matter, and should always be zero in an established aquarium.',
    guidelines: 'Ammonia levels must always be maintained at 0 ppm. Any reading above 0.05 ppm indicates a cycle failure or decaying matter and is toxic.',
    raiseGuide: 'You do not want to raise ammonia. If cycling a tank, pure ammonia can be dosed up to 2.0 ppm to establish biological filtration.',
    lowerGuide: 'Perform immediate partial water changes, add a bacteria booster (e.g. Bio-Spira), and use an ammonia binder (e.g. Prime).'
  },
  nitrate: {
    id: 'nitrate',
    name: 'Nitrate (NO3)',
    unit: 'ppm',
    color: '#F59E0B',
    min: 0,
    max: 100,
    optimalMin: 2.0,
    optimalMax: 10.0,
    description: 'Nitrate is a byproduct of ammonia nitrification. While less toxic than ammonia, high levels stress corals and fuel algae blooms, whereas absolute zero values can starve corals and lead to dinoflagellates.',
    guidelines: 'Maintain between 2 - 10 ppm for optimal coral growth. LPS/Softies can tolerate up to 20 ppm, but SPS corals thrive in lower ranges (1 - 5 ppm).',
    raiseGuide: 'Dose sodium nitrate, feed fish heavier, or reduce carbon dosing / filtration.',
    lowerGuide: 'Perform water changes, increase carbon dosing (vinegar/vodka/NPX), use macroalgae refugium (Chaetomorpha), or add high-capacity nitrate removers.'
  },
  salinity: {
    id: 'salinity',
    name: 'Salinity',
    unit: 'ppt',
    color: '#06B6D4',
    min: 28,
    max: 40,
    optimalMin: 34.0,
    optimalMax: 36.0,
    description: 'Salinity measures the concentration of dissolved salts in the water. Corals require highly stable osmotic pressure to thrive.',
    guidelines: 'The global standard for reef aquariums is 35 ppt (equivalent to a specific gravity of 1.026). Keep fluctuations minimal.',
    raiseGuide: 'Top off the aquarium with saltwater instead of fresh water (RODI) to slowly raise salinity during evaporation.',
    lowerGuide: 'Remove a small amount of aquarium water and replace it with pure fresh water (RODI).'
  },
  alkalinity: {
    id: 'alkalinity',
    name: 'Alkalinity',
    unit: 'dKH',
    color: '#EF4444',
    min: 5,
    max: 15,
    optimalMin: 8.0,
    optimalMax: 9.0,
    description: 'Alkalinity is the measure of carbonate/bicarbonate ions, which calcifying corals use to construct their skeletal structures. It is the most critical parameter to keep stable in a reef tank.',
    guidelines: 'Maintain between 8.0 - 9.0 dKH (safe range: 7.0 - 11.0 dKH). Stability is paramount—avoid swings exceeding 0.5 dKH per day.',
    raiseGuide: 'Dose sodium bicarbonate (2-part Part A, Soda Ash, or Kalkwasser) slowly.',
    lowerGuide: 'Stop dosing, let natural coral consumption lower it, or perform water changes with a lower-alkalinity salt mix.'
  },
  calcium: {
    id: 'calcium',
    name: 'Calcium',
    unit: 'ppm',
    color: '#3B82F6',
    min: 300,
    max: 550,
    optimalMin: 400,
    optimalMax: 450,
    description: 'Calcium is the building block of stony coral skeletons. Corals consume calcium along with carbonates (alkalinity) to grow.',
    guidelines: 'Maintain between 400 - 450 ppm. Fluctuations are less dangerous than alkalinity swings, but levels below 380 ppm stunt growth.',
    raiseGuide: 'Dose calcium chloride (2-part Part B or Kalkwasser).',
    lowerGuide: 'Allow corals to naturally consume it, or perform water changes.'
  },
  magnesium: {
    id: 'magnesium',
    name: 'Magnesium',
    unit: 'ppm',
    color: '#8B5CF6',
    min: 1000,
    max: 1600,
    optimalMin: 1300,
    optimalMax: 1350,
    description: 'Magnesium prevents calcium and carbonate ions from prematurely precipitating out of solution, allowing them to remain high enough for coral absorption.',
    guidelines: 'Maintain between 1300 - 1350 ppm. Low magnesium makes it difficult to maintain proper alkalinity and calcium levels.',
    raiseGuide: 'Dose magnesium chloride and magnesium sulfate blends (e.g. 2-part Part C).',
    lowerGuide: 'Let natural consumption lower it, or perform water changes.'
  }
};

const AVAILABLE_WIDGETS = [
  { id: 'ammonia', name: 'Ammonia (NH3)', unit: 'ppm', color: '#10B981' },
  { id: 'nitrate', name: 'Nitrate (NO3)', unit: 'ppm', color: '#F59E0B' },
  { id: 'salinity', name: 'Salinity', unit: 'ppt', color: '#06B6D4' },
  { id: 'alkalinity', name: 'Alkalinity', unit: 'dKH', color: '#EF4444' },
  { id: 'calcium', name: 'Calcium', unit: 'ppm', color: '#3B82F6' },
  { id: 'magnesium', name: 'Magnesium', unit: 'ppm', color: '#8B5CF6' },
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
  onCardClick: () => void;
}

function WidgetCard({ id, name, unit, color, onCardClick }: WidgetCardProps) {
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
    <div 
      onClick={onCardClick}
      className="bg-bg-card border border-border rounded-2xl p-4 flex flex-col justify-between shadow-md relative min-h-[105px] overflow-hidden transition-all duration-200 cursor-pointer hover:border-text-secondary group text-left"
    >
      {/* Top Header */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color }}>
            {name.split(' ')[0]}
          </span>
          <span className="font-display font-bold text-xs text-text-primary mt-0.5 group-hover:text-accent-uv transition-colors">
            {name}
          </span>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(true);
          }} 
          className="p-1 rounded-lg bg-[#121214] hover:bg-[#1c1c1e] border border-border/80 text-text-secondary hover:text-text-primary hover:border-border transition-all relative z-10"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Main Content */}
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

      {/* Overlay Modal Dialog for Input */}
      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 transition-opacity duration-200" 
            onClick={(e) => {
              e.stopPropagation();
              setIsAdding(false);
            }}
          />
          <div 
            className="bg-[#0B0B0C] border border-[#1C1C1E] rounded-3xl p-5 w-full max-w-[320px] flex flex-col gap-4 shadow-2xl relative z-10 animate-fade-in text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-border/40 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                Log {name}
              </span>
              <button 
                onClick={() => setIsAdding(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[9px] uppercase tracking-widest font-bold text-text-secondary">
                New Reading Value ({unit})
              </label>
              <input
                type="number"
                step="any"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder={`e.g. ${latest ? latest.value : '0.0'}`}
                className="w-full bg-[#121214] border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-text-secondary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
              />
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setIsAdding(false)}
                className="flex-1 py-2.5 bg-[#0b0b0c] border border-border text-text-secondary hover:text-text-primary hover:border-border rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 bg-accent-uv text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-md hover:bg-accent-uv/90"
              >
                Save Value
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function WidgetDashboard() {
  const { widgets, toggleWidget, widgetData, addWidgetData } = useStore();
  const [editMode, setEditMode] = useState(false);
  const [selectedParamId, setSelectedParamId] = useState<string | null>(null);

  // States inside detail modal to add quick log
  const [isAddingInsideModal, setIsAddingInsideModal] = useState(false);
  const [newLogVal, setNewLogVal] = useState('');

  const activeWidgets = AVAILABLE_WIDGETS.filter(w => widgets[w.id]);

  const selectedParam = selectedParamId ? PARAMETER_DATABASE[selectedParamId] : null;
  const history = selectedParam ? (widgetData[selectedParamId!] || []) : [];
  const latest = history[0] || null;
  const previous = history[1] || null;

  const currentVal = latest ? parseFloat(latest.value) : null;
  const prevVal = previous ? parseFloat(previous.value) : null;
  const diffVal = (currentVal !== null && prevVal !== null) ? currentVal - prevVal : null;

  // Track coordinates for optimal bar pointer
  let optPct = 0;
  let optMinPct = 0;
  let optMaxPct = 0;
  let isOptimal = false;
  let isLow = false;
  let isHigh = false;

  if (selectedParam) {
    const range = selectedParam.max - selectedParam.min;
    optMinPct = ((selectedParam.optimalMin - selectedParam.min) / range) * 100;
    optMaxPct = ((selectedParam.optimalMax - selectedParam.min) / range) * 100;
    
    if (currentVal !== null) {
      optPct = Math.max(0, Math.min(100, ((currentVal - selectedParam.min) / range) * 100));
      isOptimal = currentVal >= selectedParam.optimalMin && currentVal <= selectedParam.optimalMax;
      isLow = currentVal < selectedParam.optimalMin;
      isHigh = currentVal > selectedParam.optimalMax;
    }
  }

  const handleModalSaveValue = () => {
    if (!newLogVal || !selectedParamId) return;
    addWidgetData(selectedParamId, newLogVal, selectedParam!.unit);
    setNewLogVal('');
    setIsAddingInsideModal(false);
  };

  return (
    <div className="flex flex-col gap-5 text-left">
      {/* Title block */}
      <div className="flex justify-between items-center select-none">
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
              ? "bg-accent-uv border-accent-uv text-white" 
              : "bg-bg-card border-border text-text-secondary hover:text-text-primary hover:border-border"
          )}
        >
          <Settings2 size={16} />
        </button>
      </div>

      {editMode ? (
        /* Widget config view */
        <div className="bg-bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 animate-fade-in select-none">
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
                  className="w-4 h-4 rounded border-border accent-accent-uv bg-bg-base outline-none cursor-pointer"
                />
              </label>
            ))}
          </div>
        </div>
      ) : (
        /* Parameters Cards Grid */
        <div className="grid grid-cols-2 gap-4 animate-fade-in select-none">
          {activeWidgets.map(w => (
            <WidgetCard 
              key={w.id} 
              id={w.id} 
              name={PARAMETER_DATABASE[w.id].name} 
              unit={PARAMETER_DATABASE[w.id].unit} 
              color={PARAMETER_DATABASE[w.id].color} 
              onCardClick={() => setSelectedParamId(w.id)}
            />
          ))}

          {activeWidgets.length === 0 && (
            <div className="col-span-2 text-center py-10 border border-dashed border-border rounded-2xl text-text-secondary text-xs flex flex-col items-center justify-center gap-2 bg-bg-card/40">
              <TrendingUp size={20} className="text-text-secondary opacity-60" />
              <span>No active widgets.</span>
              <button 
                onClick={() => setEditMode(true)}
                className="text-accent-uv font-bold uppercase tracking-widest text-[9px] hover:underline"
              >
                Add Parameters Widget
              </button>
            </div>
          )}
        </div>
      )}

      {/* PARAMETER DETAILED REPORT DIALOG MODAL */}
      {selectedParam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/85 transition-opacity duration-200" 
            onClick={() => {
              setSelectedParamId(null);
              setIsAddingInsideModal(false);
            }}
          />
          
          {/* Main Card */}
          <div className="bg-[#0B0B0C] border border-[#1C1C1E] rounded-[28px] p-5 w-full max-w-[370px] flex flex-col gap-4.5 shadow-2xl relative z-10 animate-fade-in max-h-[85vh] overflow-y-auto no-scrollbar">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-border/40 pb-3">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold tracking-[0.2em]" style={{ color: selectedParam.color }}>
                  Parameter Report
                </span>
                <span className="font-display font-black text-base text-text-primary mt-0.5">
                  {selectedParam.name}
                </span>
              </div>
              <button 
                onClick={() => {
                  setSelectedParamId(null);
                  setIsAddingInsideModal(false);
                }}
                className="p-1 rounded-lg bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-border transition-all"
              >
                <X size={14} />
              </button>
            </div>

            {/* Quick value addition zone inside detail view */}
            {isAddingInsideModal ? (
              <div className="bg-bg-elevated/45 border border-border rounded-2xl p-4 flex flex-col gap-3 animate-fade-in">
                <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                  Log Value
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    value={newLogVal}
                    onChange={(e) => setNewLogVal(e.target.value)}
                    placeholder={`Value in ${selectedParam.unit}`}
                    className="w-full bg-[#0B0B0C] border border-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-text-secondary"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleModalSaveValue();
                    }}
                  />
                  <button 
                    onClick={handleModalSaveValue}
                    className="py-2 px-4 bg-accent-uv hover:bg-accent-uv/90 text-white text-[10px] font-bold rounded-xl transition-all shadow-md"
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => setIsAddingInsideModal(false)}
                    className="p-2 text-text-secondary hover:text-text-primary bg-[#0B0B0C] border border-border rounded-xl"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setIsAddingInsideModal(true)}
                  className="py-1.5 px-3 bg-[#121214] hover:bg-[#1c1c1e] border border-border/80 text-text-secondary hover:text-text-primary transition-all text-[9px] font-bold uppercase tracking-wider rounded-lg flex items-center gap-1"
                >
                  <Plus size={10} />
                  Add Reading
                </button>
              </div>
            )}

            {/* Trend & Latest Values ("how much it was how it is now and all") */}
            {latest ? (
              <div className="bg-[#121214] border border-border/60 rounded-2xl p-3.5 flex flex-col gap-3 text-center">
                <div className="flex flex-col items-center">
                  <span className="text-[8px] text-text-secondary uppercase tracking-widest font-black">
                    Current Level
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-mono text-3xl font-black text-text-primary leading-none">
                      {latest.value}
                    </span>
                    <span className="text-[10px] font-bold text-text-secondary uppercase">
                      {latest.unit}
                    </span>
                  </div>
                  <span className="text-[8px] text-text-secondary/50 mt-1 font-medium">
                    Measured {new Date(latest.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {previous && (
                  <div className="border-t border-border/30 mt-1 pt-2.5 grid grid-cols-2 gap-2 text-left">
                    <div className="flex flex-col border-r border-border/30 pr-2">
                      <span className="text-[8px] text-text-secondary uppercase font-bold tracking-wider leading-none">
                        Was (Previous)
                      </span>
                      <span className="font-mono text-xs font-black text-text-primary/80 mt-1">
                        {previous.value} <span className="text-[9px] font-bold text-text-secondary">{previous.unit}</span>
                      </span>
                    </div>

                    <div className="flex flex-col pl-2">
                      <span className="text-[8px] text-text-secondary uppercase font-bold tracking-wider leading-none">
                        Difference Trend
                      </span>
                      <span className={clsx(
                        "font-mono text-xs font-black mt-1 flex items-center gap-0.5",
                        diffVal && diffVal > 0 ? "text-status-success" : diffVal && diffVal < 0 ? "text-status-warning" : "text-text-secondary"
                      )}>
                        {diffVal !== null && diffVal > 0 ? `+${diffVal.toFixed(2)}` : diffVal !== null && diffVal < 0 ? `${diffVal.toFixed(2)}` : '0.00'}
                        {diffVal !== null && diffVal > 0 ? '↑' : diffVal !== null && diffVal < 0 ? '↓' : '→'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#121214] border border-border/50 rounded-2xl p-6 text-center text-xs text-text-secondary/60 italic">
                No logs recorded yet. Add your first reading!
              </div>
            )}

            {/* Optimal Range Visualizer Track */}
            {currentVal !== null && (
              <div className="flex flex-col gap-1 px-1">
                <div className="flex justify-between text-[8px] font-black text-text-secondary uppercase tracking-widest mb-0.5">
                  <span className={clsx(isLow && "text-status-warning font-black")}>Low</span>
                  <span className={clsx(isOptimal && "text-status-success font-black")}>Optimal ({selectedParam.optimalMin} - {selectedParam.optimalMax})</span>
                  <span className={clsx(isHigh && "text-status-error font-black")}>High</span>
                </div>
                
                {/* Visual slider representation */}
                <div className="h-2.5 bg-bg-base border border-border rounded-full relative overflow-visible mt-1">
                  {/* Optimal bar box */}
                  <div 
                    className="absolute top-0 bottom-0 bg-status-success/15 border-x border-status-success/20" 
                    style={{ left: `${optMinPct}%`, right: `${100 - optMaxPct}%` }}
                  />
                  {/* Current Pin pointer */}
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border border-[#1C1C1E] rounded-full shadow-[0_0_8px_rgba(255,255,255,0.7)] -ml-2 flex items-center justify-center transition-all duration-300" 
                    style={{ left: `${optPct}%` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedParam.color }} />
                  </div>
                </div>

                <div className="flex justify-between font-mono text-[7px] text-text-secondary/70 mt-1">
                  <span>{selectedParam.min}</span>
                  <span>{selectedParam.max}</span>
                </div>
              </div>
            )}

            {/* Reef Keeping Advice block */}
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary border-b border-border/30 pb-1.5 block">
                Reef Keeping Guidelines
              </span>
              <p className="text-[10px] text-text-secondary/90 leading-relaxed font-medium">
                {selectedParam.description}
              </p>

              <div className="grid grid-cols-2 gap-3 mt-1.5 bg-[#121214] border border-border/50 p-3 rounded-2xl select-text">
                <div className="flex flex-col gap-1 text-[9px] leading-normal border-r border-border/30 pr-2">
                  <span className="font-bold text-status-success uppercase tracking-wider">Raise W/</span>
                  <span className="text-text-secondary font-medium">{selectedParam.raiseGuide}</span>
                </div>
                <div className="flex flex-col gap-1 text-[9px] leading-normal pl-2">
                  <span className="font-bold text-status-warning uppercase tracking-wider">Lower W/</span>
                  <span className="text-text-secondary font-medium">{selectedParam.lowerGuide}</span>
                </div>
              </div>
            </div>

            {/* History Table list */}
            {history.length > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary border-b border-border/30 pb-1.5 block">
                  Log History
                </span>
                <div className="flex flex-col gap-2 max-h-[130px] overflow-y-auto no-scrollbar pr-0.5">
                  {history.map((item, idx) => (
                    <div key={item.date} className="flex justify-between items-center py-2 px-3.5 bg-[#121214] border border-border/40 rounded-xl text-xs font-mono group/item">
                      <div className="flex items-baseline gap-2">
                        <span className="font-black text-text-primary">{item.value}</span>
                        <span className="text-[8px] font-bold text-text-secondary uppercase">{item.unit}</span>
                        <span className="text-[8px] text-text-secondary/50 font-medium">
                          {new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => {
                          const nextHistory = history.filter((_, i) => i !== idx);
                          const nextData = { ...widgetData, [selectedParamId!]: nextHistory };
                          useStore.setState({ widgetData: nextData });
                          localStorage.setItem('reef_widget_data', JSON.stringify(nextData));
                          useStore.getState().showToast(`Entry deleted`);
                        }}
                        className="text-status-error opacity-0 group-hover/item:opacity-100 transition-opacity p-1 hover:bg-status-error/10 rounded-lg cursor-pointer"
                        title="Delete entry"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
