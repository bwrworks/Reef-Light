import { create } from 'zustand';
import mqtt from 'mqtt';
import type { MqttClient } from 'mqtt';

const MQTT_BROKER = 'wss://broker.hivemq.com:8884/mqtt';
const TOPIC_STATUS = 'creatorsreef/state/cr-849a2bf1-9c32-4d51-a719-21b9a8f4d91e';
const TOPIC_CMD = 'creatorsreef/cmd/cr-849a2bf1-9c32-4d51-a719-21b9a8f4d91e';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
type AppMode = 'auto' | 'manual' | 'kelvin';

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface ChannelState {
  uvRed: number;
  blueA: number;
  blueB: number;
  white: number;
  linked: boolean;
}

export interface WidgetData {
  value: string;
  unit: string;
  date: string;
}

export interface ScheduleState {
  enabled: boolean;
  sunriseHour: number;
  sunriseMin: number;
  sunsetHour: number;
  sunsetMin: number;
  rampMinutes: number;
  peakBlue: number;
  peakWhite: number;
  peakUvRed: number;
}

export const DEFAULT_SCHEDULE: ScheduleState = {
  enabled: true,
  sunriseHour: 7,
  sunriseMin: 0,
  sunsetHour: 20,
  sunsetMin: 0,
  rampMinutes: 60,
  peakBlue: 85,
  peakWhite: 40,
  peakUvRed: 25,
};

// Helper: get today's 0-indexed day (0=Mon..6=Sun)
const getTodayIndex = () => {
  const day = new Date().getDay(); // 0=Sun, 1=Mon..6=Sat
  return day === 0 ? 6 : day - 1;  // convert to Mon-based index
};

// Initialize 7-day schedule
const initWeekDays = (): ScheduleState[] => {
  try {
    const stored = localStorage.getItem('reef_week_days');
    if (stored) return JSON.parse(stored);
  } catch {/* ignore */}
  return Array(7).fill(null).map(() => ({ ...DEFAULT_SCHEDULE }));
};

interface AppState {
  status: ConnectionStatus;
  mode: AppMode;
  channels: ChannelState;
  mqttClient: MqttClient | null;
  kelvin: number;
  power: boolean;
  sysLogs: string[];
  schedule: ScheduleState;        // current editing day's schedule
  editingDayIndex: number;        // 0=Mon..6=Sun, which day is currently shown in editor
  weekDays: ScheduleState[];      // per-day schedules (7 entries, Mon-Sun)
  fanSpeed: number;               // 0-100%, 0 = off, 100 = full speed
  toastMessage: string | null;
  
  widgets: Record<string, boolean>;
  widgetData: Record<string, WidgetData[]>;
  customScenes: CustomScene[];

  connect: () => void;
  setMode: (mode: AppMode) => void;
  updateChannel: (channel: keyof Omit<ChannelState, 'linked'>, value: number) => void;
  toggleLink: () => void;
  setKelvin: (k: number) => void;
  toggleWidget: (id: string) => void;
  addWidgetData: (id: string, value: string, unit: string) => void;
  updateSchedule: (sched: Partial<ScheduleState>) => void;
  saveSchedule: () => void;
  setEditingDay: (dayIndex: number) => void;
  copyToAllDays: () => void;
  togglePower: () => void;
  showToast: (msg: string) => void;
  saveCustomScene: (name: string) => void;
  deleteCustomScene: (id: string) => void;
  setFanSpeed: (speed: number) => void;
}

export interface CustomScene {
  id: string;
  name: string;
  channels: {
    uvRed: number;
    blueA: number;
    blueB: number;
    white: number;
  };
}

const storedWeekDays = initWeekDays();
const storedEditingDay = getTodayIndex();

export const useStore = create<AppState>((set, get) => ({
  status: 'disconnected',
  mode: 'auto',
  channels: {
    uvRed: 0,
    blueA: 0,
    blueB: 0,
    white: 0,
    linked: true,
  },
  mqttClient: null,
  kelvin: 12000,
  power: true,
  sysLogs: [],
  editingDayIndex: storedEditingDay,
  weekDays: storedWeekDays,
  schedule: storedWeekDays[storedEditingDay] ?? { ...DEFAULT_SCHEDULE },
  fanSpeed: parseInt(localStorage.getItem('reef_fan_speed') || '0'),
  toastMessage: null,
  
  widgets: JSON.parse(localStorage.getItem('reef_widgets') || '{"ammonia": true, "nitrate": true, "salinity": false, "alkalinity": false, "calcium": false, "magnesium": false}'),
  widgetData: JSON.parse(localStorage.getItem('reef_widget_data') || '{}'),
  customScenes: JSON.parse(localStorage.getItem('reef_custom_scenes') || '[]'),

  showToast: (msg) => {
    set({ toastMessage: msg });
  },

  connect: () => {
    if (get().mqttClient) return;
    set({ status: 'connecting' });
    
    const client = mqtt.connect(MQTT_BROKER, {
      clientId: 'reef-web-' + Math.random().toString(16).substring(2, 10),
      clean: true,
      reconnectPeriod: 2000,
    });

    client.on('connect', () => {
      set({ status: 'connected', mqttClient: client });
      client.subscribe(TOPIC_STATUS);
      client.publish(TOPIC_CMD, JSON.stringify({ cmd_type: 'get_state' }));
      get().showToast('Connected to MQTT Broker');
    });

    client.on('message', (topic, payload) => {
      if (topic === TOPIC_STATUS) {
        try {
          const data = JSON.parse(payload.toString());
          
          set((state) => {
            const nextMode: AppMode = data.manual ? 'manual' : (state.mode === 'kelvin' ? 'kelvin' : 'auto');
            
            // Update week days if ESP32 returned a schedule
            let nextWeekDays = state.weekDays;
            let nextSchedule = state.schedule;
            if (data.schedule) {
              const newSched: ScheduleState = {
                enabled: data.schedule.enabled ?? state.schedule.enabled,
                sunriseHour: data.schedule.sunriseHour ?? state.schedule.sunriseHour,
                sunriseMin: data.schedule.sunriseMin ?? state.schedule.sunriseMin,
                sunsetHour: data.schedule.sunsetHour ?? state.schedule.sunsetHour,
                sunsetMin: data.schedule.sunsetMin ?? state.schedule.sunsetMin,
                rampMinutes: data.schedule.rampMinutes ?? state.schedule.rampMinutes,
                peakBlue: data.schedule.peakBlue ?? state.schedule.peakBlue,
                peakWhite: data.schedule.peakWhite ?? state.schedule.peakWhite,
                peakUvRed: data.schedule.peakUvRed ?? state.schedule.peakUvRed,
              };
              nextSchedule = newSched;
              nextWeekDays = state.weekDays.map((d, i) =>
                i === state.editingDayIndex ? newSched : d
              );
              localStorage.setItem('reef_week_days', JSON.stringify(nextWeekDays));
            }

            // Update fan speed if received
            if (data.fanSpeed !== undefined) {
              localStorage.setItem('reef_fan_speed', String(data.fanSpeed));
            }

            return {
              power: data.power ?? state.power,
              mode: nextMode,
              sysLogs: data.logs ?? state.sysLogs,
              fanSpeed: data.fanSpeed ?? state.fanSpeed,
              channels: {
                ...state.channels,
                uvRed: data.uvRed ?? state.channels.uvRed,
                blueA: data.blueA ?? state.channels.blueA,
                blueB: data.blueB ?? state.channels.blueB,
                white: data.white ?? state.channels.white,
              },
              schedule: nextSchedule,
              weekDays: nextWeekDays,
            };
          });
        } catch (e) {
          console.error("MQTT parse error", e);
        }
      }
    });

    client.on('offline', () => set({ status: 'disconnected' }));
    client.on('error', () => set({ status: 'disconnected' }));
  },

  setMode: (mode) => {
    set({ mode });
    if (mode === 'auto') {
      get().mqttClient?.publish(TOPIC_CMD, JSON.stringify({ cmd_type: 'auto' }));
      get().showToast('Switched to Auto Schedule');
    } else if (mode === 'manual') {
      get().mqttClient?.publish(TOPIC_CMD, JSON.stringify({ cmd_type: 'manual' }));
      get().showToast('Switched to Manual Control');
    }
  },

  updateChannel: (channel, value) => {
    const { channels, mqttClient, mode } = get();
    
    if (mode === 'auto') {
      set({ mode: 'manual' });
      mqttClient?.publish(TOPIC_CMD, JSON.stringify({ cmd_type: 'manual' }));
    }

    const newChannels = { ...channels, [channel]: value };
    if (channels.linked && (channel === 'blueA' || channel === 'blueB')) {
      newChannels.blueA = value;
      newChannels.blueB = value;
    }
    set({ channels: newChannels });

    mqttClient?.publish(TOPIC_CMD, JSON.stringify({
      cmd_type: 'channels',
      uvRed: newChannels.uvRed,
      blueA: newChannels.blueA,
      blueB: newChannels.blueB,
      white: newChannels.white,
    }));
  },

  toggleLink: () => {
    set((state) => ({
      channels: {
        ...state.channels,
        linked: !state.channels.linked,
        ...(!state.channels.linked ? { blueB: state.channels.blueA } : {})
      }
    }));
    get().showToast(get().channels.linked ? 'Blue Channels Unlinked' : 'Blue Channels Linked');
  },

  setKelvin: (k) => {
    set({ kelvin: k });
    if (get().mode !== 'kelvin') {
      set({ mode: 'kelvin' });
      get().mqttClient?.publish(TOPIC_CMD, JSON.stringify({ cmd_type: 'manual' }));
    }
    
    const t = Math.max(0, Math.min(1, (k - 6500) / 13500));
    const uvRed = Math.round(255 * (0.05 + (t * 0.35)));
    const blueA = Math.round(255 * (0.20 + (t * 0.75)));
    const white = Math.round(255 * (0.80 - (t * 0.75)));

    const newChannels = {
      ...get().channels,
      uvRed,
      blueA,
      blueB: blueA,
      white,
    };
    set({ channels: newChannels });
    
    get().mqttClient?.publish(TOPIC_CMD, JSON.stringify({
      cmd_type: 'channels',
      uvRed,
      blueA,
      blueB: blueA,
      white,
    }));
  },

  togglePower: () => {
    const nextPower = !get().power;
    set({ power: nextPower });
    get().mqttClient?.publish(TOPIC_CMD, JSON.stringify({
      cmd_type: 'power',
      on: nextPower
    }));
    get().showToast(nextPower ? 'Lights Turned ON' : 'Lights Turned OFF');
  },

  // updateSchedule: updates both the flat `schedule` and the corresponding weekDay entry
  updateSchedule: (sched) => {
    set((state) => {
      const next: ScheduleState = { ...state.schedule, ...sched };
      const nextWeekDays = state.weekDays.map((d, i) =>
        i === state.editingDayIndex ? next : d
      );
      localStorage.setItem('reef_week_days', JSON.stringify(nextWeekDays));
      return { schedule: next, weekDays: nextWeekDays };
    });
  },

  // Switch which day is being edited in the ScheduleEditor
  setEditingDay: (dayIndex) => {
    const weekDays = get().weekDays;
    const daySchedule = weekDays[dayIndex] ?? { ...DEFAULT_SCHEDULE };
    localStorage.setItem('reef_editing_day', String(dayIndex));
    set({ editingDayIndex: dayIndex, schedule: daySchedule });
  },

  // Copy the currently edited day's schedule to all 7 days
  copyToAllDays: () => {
    const { schedule, showToast } = get();
    const nextWeekDays = Array(7).fill(null).map(() => ({ ...schedule }));
    localStorage.setItem('reef_week_days', JSON.stringify(nextWeekDays));
    set({ weekDays: nextWeekDays });
    showToast('Schedule copied to all days');
  },

  // Send the schedule for a specific day to the ESP32 via MQTT
  saveSchedule: () => {
    const { schedule, mqttClient } = get();
    mqttClient?.publish(TOPIC_CMD, JSON.stringify({
      cmd_type: 'schedule',
      enabled: schedule.enabled,
      sunriseHour: schedule.sunriseHour,
      sunriseMin: schedule.sunriseMin,
      sunsetHour: schedule.sunsetHour,
      sunsetMin: schedule.sunsetMin,
      rampMinutes: schedule.rampMinutes,
      peakBlue: schedule.peakBlue,
      peakWhite: schedule.peakWhite,
      peakUvRed: schedule.peakUvRed,
    }));
    get().showToast('Schedule Sent to ESP32');
  },

  setFanSpeed: (speed) => {
    let finalSpeed = Math.max(0, Math.min(100, speed));
    if (finalSpeed > 0 && finalSpeed < 25) {
      finalSpeed = finalSpeed >= 12 ? 25 : 0;
    }
    set({ fanSpeed: finalSpeed });
    localStorage.setItem('reef_fan_speed', String(finalSpeed));
    get().mqttClient?.publish(TOPIC_CMD, JSON.stringify({
      cmd_type: 'fan',
      speed: finalSpeed,
    }));
  },

  toggleWidget: (id) => {
    const current = get().widgets;
    const next = { ...current, [id]: !current[id] };
    set({ widgets: next });
    localStorage.setItem('reef_widgets', JSON.stringify(next));
  },

  addWidgetData: (id, value, unit) => {
    const current = get().widgetData;
    const entry = { value, unit, date: new Date().toISOString() };
    const history = current[id] ? [entry, ...current[id]].slice(0, 15) : [entry];
    const next = { ...current, [id]: history };
    set({ widgetData: next });
    localStorage.setItem('reef_widget_data', JSON.stringify(next));
    get().showToast(`Added reading for ${id}`);
  },

  saveCustomScene: (name) => {
    const { channels, customScenes } = get();
    const newScene = {
      id: 'scene-' + Math.random().toString(16).substring(2, 10),
      name: name.trim() || `Custom Scene ${customScenes.length + 1}`,
      channels: {
        uvRed: channels.uvRed,
        blueA: channels.blueA,
        blueB: channels.blueB,
        white: channels.white
      }
    };
    const next = [...customScenes, newScene];
    set({ customScenes: next });
    localStorage.setItem('reef_custom_scenes', JSON.stringify(next));
    get().showToast(`Saved scene: ${newScene.name}`);
  },

  deleteCustomScene: (id) => {
    const next = get().customScenes.filter(s => s.id !== id);
    set({ customScenes: next });
    localStorage.setItem('reef_custom_scenes', JSON.stringify(next));
    get().showToast('Scene deleted');
  }
}));
