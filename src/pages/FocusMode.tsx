import { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Coffee, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Mode = 'focus' | 'break';

const FOCUS_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

export default function FocusMode() {
  const { dispatch } = useGame();
  const [mode, setMode] = useState<Mode>('focus');
  const [timeLeft, setTimeLeft] = useState(FOCUS_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessions] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('questify-focus-sessions') || '{}');
      if (saved.date === new Date().toISOString().split('T')[0]) return saved.count;
    } catch {}
    return 0;
  });
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const alarmCtxRef = useRef<AudioContext | null>(null);
  const alarmTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [alarmActive, setAlarmActive] = useState(false);

  const totalTime = mode === 'focus' ? FOCUS_TIME : BREAK_TIME;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  useEffect(() => {
    localStorage.setItem('questify-focus-sessions', JSON.stringify({ date: new Date().toISOString().split('T')[0], count: sessionsCompleted }));
  }, [sessionsCompleted]);

  const stopAlarm = useCallback(() => {
    alarmTimersRef.current.forEach(clearTimeout);
    alarmTimersRef.current = [];
    if (alarmCtxRef.current) {
      try { alarmCtxRef.current.close(); } catch {}
      alarmCtxRef.current = null;
    }
    setAlarmActive(false);
  }, []);

  const playAlarm = useCallback(() => {
    // Stop any existing alarm first
    alarmTimersRef.current.forEach(clearTimeout);
    alarmTimersRef.current = [];
    if (alarmCtxRef.current) {
      try { alarmCtxRef.current.close(); } catch {}
    }

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    alarmCtxRef.current = ctx;
    setAlarmActive(true);

    const ringOnce = (startAt: number) => {
      // A 3-beep ring pattern
      const beep = (offset: number, freq: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = startAt + offset;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t);
        osc.stop(t + dur);
      };
      beep(0, 880, 0.35);
      beep(0.4, 880, 0.35);
      beep(0.8, 1320, 0.5);
    };

    // Ring repeatedly until dismissed (every ~1.8s for up to 60s)
    const RING_INTERVAL_MS = 1800;
    const MAX_RINGS = 33; // ~60s
    ringOnce(ctx.currentTime);
    for (let i = 1; i < MAX_RINGS; i++) {
      const timer = setTimeout(() => {
        if (alarmCtxRef.current === ctx) ringOnce(ctx.currentTime);
      }, i * RING_INTERVAL_MS);
      alarmTimersRef.current.push(timer);
    }
    // Auto-stop after the last ring
    const stopTimer = setTimeout(() => stopAlarm(), MAX_RINGS * RING_INTERVAL_MS + 1500);
    alarmTimersRef.current.push(stopTimer);

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Focus Timer', { body: mode === 'focus' ? '✅ Focus session complete! Time for a break.' : '☕ Break over! Ready to focus again?' });
    } else if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [mode, stopAlarm]);

  // Cleanup on unmount
  useEffect(() => () => stopAlarm(), [stopAlarm]);

  const completeSession = useCallback(() => {
    playAlarm();
    if (mode === 'focus') {
      dispatch({ type: 'ADD_XP', amount: 30 });
      dispatch({ type: 'ADD_COINS', amount: 20 });
      dispatch({ type: 'UNLOCK_ACHIEVEMENT', achievementId: 'focus_complete' });
      dispatch({ type: 'ADD_FOCUS_SESSION' });
      setSessions(s => s + 1);
      setMode('break');
      setTimeLeft(BREAK_TIME);
    } else {
      setMode('focus');
      setTimeLeft(FOCUS_TIME);
    }
    setIsRunning(false);
  }, [mode, dispatch, playAlarm]);

  const endTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning) {
      if (!endTimeRef.current) {
        endTimeRef.current = Date.now() + timeLeft * 1000;
      }
      const tick = () => {
        const remaining = Math.round((endTimeRef.current! - Date.now()) / 1000);
        if (remaining <= 0) {
          endTimeRef.current = null;
          completeSession();
          return;
        }
        setTimeLeft(remaining);
        intervalRef.current = setTimeout(tick, 250);
      };
      intervalRef.current = setTimeout(tick, 250);
    } else {
      endTimeRef.current = null;
    }
    return () => clearTimeout(intervalRef.current);
  }, [isRunning, completeSession]);

  const reset = () => {
    stopAlarm();
    setIsRunning(false);
    setTimeLeft(mode === 'focus' ? FOCUS_TIME : BREAK_TIME);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="max-w-lg mx-auto space-y-8 flex flex-col items-center pt-8">
      <div className="text-center">
        <h1 className="text-3xl font-display font-bold">
          {mode === 'focus' ? 'Focus Mode 🧠' : 'Break Time ☕'}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {mode === 'focus' ? 'Stay focused. Earn +30 XP per session.' : 'Take a break. You earned it!'}
        </p>
      </div>

      {/* Timer Circle */}
      <div className="relative w-64 h-64">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 256 256">
          <circle cx="128" cy="128" r="120" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <motion.circle
            cx="128" cy="128" r="120"
            fill="none"
            stroke={mode === 'focus' ? 'hsl(var(--primary))' : 'hsl(var(--accent))'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            initial={false}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-display font-bold tabular-nums">
            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
          </span>
          <span className="text-sm text-muted-foreground mt-1 uppercase tracking-wider font-medium">
            {mode}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <Button variant="outline" size="icon" onClick={reset} className="h-12 w-12 rounded-full">
          <RotateCcw className="h-5 w-5" />
        </Button>
        <Button
          onClick={() => { stopAlarm(); setIsRunning(!isRunning); }}
          className="h-14 w-14 rounded-full text-lg"
          size="icon"
        >
          {isRunning ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            stopAlarm();
            setMode(mode === 'focus' ? 'break' : 'focus');
            setTimeLeft(mode === 'focus' ? BREAK_TIME : FOCUS_TIME);
            setIsRunning(false);
          }}
          className="h-12 w-12 rounded-full"
        >
          <Coffee className="h-5 w-5" />
        </Button>
      </div>

      {alarmActive && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <Button
            onClick={stopAlarm}
            variant="destructive"
            className="w-full h-12 rounded-full animate-pulse"
          >
            <BellOff className="h-5 w-5 mr-2" />
            Stop alarm
          </Button>
        </motion.div>
      )}

      <div className="glass-card p-4 w-full text-center">
        <p className="text-sm text-muted-foreground">
          Sessions completed today: <span className="font-bold text-primary">{sessionsCompleted}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {sessionsCompleted * 30} XP earned from focus sessions
        </p>
      </div>
    </div>
  );
}
