import React, { useCallback, useEffect, useRef, useState } from 'react';

type PadIndex = 0 | 1 | 2 | 3;
type GamePhase = 'IDLE' | 'SHOWING' | 'INPUT' | 'GAME_OVER';

const PADS: { name: string; key: string; tone: number }[] = [
  { name: 'Red', key: '1', tone: 329.63 },
  { name: 'Blue', key: '2', tone: 392 },
  { name: 'Green', key: '3', tone: 440 },
  { name: 'Yellow', key: '4', tone: 523.25 }
];

const randomPad = (): PadIndex => Math.floor(Math.random() * PADS.length) as PadIndex;
const sequenceSpeed = (length: number) => Math.max(300, 720 - (length - 1) * 24);

const RubiksCubeGame: React.FC = () => {
  const [phase, setPhase] = useState<GamePhase>('IDLE');
  const [sequence, setSequence] = useState<PadIndex[]>([]);
  const [inputIndex, setInputIndex] = useState(0);
  const [activePad, setActivePad] = useState<PadIndex | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(window.localStorage.getItem('arcade-color-recall-best') ?? 0));
  const [message, setMessage] = useState('Watch the colors, then repeat the exact pattern.');
  const timersRef = useRef<number[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const runIdRef = useRef(0);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timersRef.current.push(timer);
  }, []);

  const playTone = useCallback((pad: PadIndex, duration = 0.16) => {
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioRef.current ?? new AudioContextClass();
      audioRef.current = context;
      if (context.state === 'suspended') void context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = PADS[pad].tone;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration + 0.02);
    } catch {
      // The visual game remains fully playable when browser audio is unavailable.
    }
  }, []);

  const showSequence = useCallback((nextSequence: PadIndex[]) => {
    clearTimers();
    const runId = ++runIdRef.current;
    const pace = sequenceSpeed(nextSequence.length);
    setPhase('SHOWING');
    setInputIndex(0);
    setActivePad(null);
    setMessage(`Watch closely — ${nextSequence.length} light${nextSequence.length === 1 ? '' : 's'}.`);

    nextSequence.forEach((pad, index) => {
      const startAt = 520 + index * pace;
      schedule(() => {
        if (runIdRef.current !== runId) return;
        setActivePad(pad);
        playTone(pad, Math.min(0.2, pace / 2500));
      }, startAt);
      schedule(() => {
        if (runIdRef.current === runId) setActivePad(null);
      }, startAt + Math.min(330, pace * 0.52));
    });

    schedule(() => {
      if (runIdRef.current !== runId) return;
      setActivePad(null);
      setPhase('INPUT');
      setMessage('Your turn — repeat the pattern.');
    }, 620 + nextSequence.length * pace);
  }, [clearTimers, playTone, schedule]);

  const startGame = useCallback(() => {
    clearTimers();
    runIdRef.current += 1;
    const firstSequence: PadIndex[] = [randomPad()];
    setSequence(firstSequence);
    setScore(0);
    setInputIndex(0);
    void audioRef.current?.resume();
    showSequence(firstSequence);
  }, [clearTimers, showSequence]);

  const handlePad = useCallback((pad: PadIndex) => {
    if (phase !== 'INPUT') return;
    setActivePad(pad);
    playTone(pad);
    schedule(() => setActivePad((current) => current === pad ? null : current), 180);

    if (pad !== sequence[inputIndex]) {
      clearTimers();
      runIdRef.current += 1;
      setActivePad(pad);
      schedule(() => setActivePad(null), 360);
      const completed = Math.max(0, sequence.length - 1);
      const nextBest = Math.max(best, completed);
      setBest(nextBest);
      window.localStorage.setItem('arcade-color-recall-best', String(nextBest));
      setPhase('GAME_OVER');
      setMessage(`Wrong color. You completed ${completed} pattern${completed === 1 ? '' : 's'}.`);
      return;
    }

    const nextInputIndex = inputIndex + 1;
    if (nextInputIndex < sequence.length) {
      setInputIndex(nextInputIndex);
      setMessage(`${nextInputIndex} of ${sequence.length} correct…`);
      return;
    }

    const completed = sequence.length;
    const nextBest = Math.max(best, completed);
    setBest(nextBest);
    window.localStorage.setItem('arcade-color-recall-best', String(nextBest));
    setScore(completed);
    setPhase('SHOWING');
    setMessage('Perfect! The next pattern is longer.');
    const nextSequence = [...sequence, randomPad()];
    setSequence(nextSequence);
    setInputIndex(0);
    schedule(() => showSequence(nextSequence), 850);
  }, [best, clearTimers, inputIndex, phase, playTone, schedule, sequence, showSequence]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const index = PADS.findIndex((pad) => pad.key === event.key);
      if (index >= 0) handlePad(index as PadIndex);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePad]);

  useEffect(() => () => {
    clearTimers();
    runIdRef.current += 1;
    void audioRef.current?.close();
  }, [clearTimers]);

  const level = sequence.length || 1;
  const progress = phase === 'INPUT' ? inputIndex : 0;

  return (
    <section className="color-recall-game" aria-label="Color Recall memory game">
      <header className="color-recall-header">
        <div>
          <span>SEQUENCE MEMORY</span>
          <h2>Color Recall</h2>
        </div>
        <div className="color-recall-stats">
          <span><small>LEVEL</small>{level}</span>
          <span><small>SCORE</small>{score}</span>
          <span><small>BEST</small>{best}</span>
        </div>
      </header>

      <div className={`color-recall-stage ${phase.toLowerCase()}`}>
        <div className="color-recall-status" role="status" aria-live="polite">
          <i />
          <span>{message}</span>
        </div>

        <div className="color-wheel" aria-label="Four color memory controls">
          {PADS.map((pad, index) => (
            <button
              key={pad.name}
              type="button"
              className={`color-pad pad-${index}${activePad === index ? ' active' : ''}`}
              disabled={phase !== 'INPUT'}
              onClick={() => handlePad(index as PadIndex)}
              aria-label={`${pad.name} pad, keyboard ${pad.key}`}
            >
              <span>{pad.key}</span>
            </button>
          ))}
          <div className="color-wheel-hub" aria-hidden="true">
            <strong>{phase === 'SHOWING' ? 'WATCH' : phase === 'INPUT' ? 'REPEAT' : phase === 'GAME_OVER' ? 'MISS' : 'READY'}</strong>
            <small>{phase === 'INPUT' ? `${progress}/${sequence.length}` : `LV ${level}`}</small>
          </div>
        </div>

        <div className="sequence-progress" aria-label={`${progress} of ${sequence.length} colors repeated`}>
          {sequence.map((_, index) => <i key={index} className={index < progress ? 'correct' : index === progress && phase === 'INPUT' ? 'current' : ''} />)}
        </div>

        <button type="button" className="color-recall-start" onClick={startGame}>
          {phase === 'IDLE' ? 'START PATTERN' : phase === 'GAME_OVER' ? 'TRY AGAIN' : 'RESTART'}
        </button>
        <p>Use the circle or keyboard keys 1–4. Every completed round adds another color and speeds up the demonstration.</p>
      </div>

      <style>{`
        .color-recall-game{width:min(100%,720px);margin:auto;padding:18px;border:1px solid #33485c;border-radius:20px;background:radial-gradient(circle at 50% 30%,#182b3d,#08111b 66%);box-shadow:0 25px 70px rgba(0,0,0,.42);color:#eef7ff;user-select:none}.color-recall-header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding:3px 4px 16px}.color-recall-header>div:first-child span{color:#7fc8f0;font-size:9px;font-weight:950;letter-spacing:.18em}.color-recall-header h2{margin:3px 0 0;font-size:28px;line-height:1}.color-recall-stats{display:flex;gap:7px}.color-recall-stats span{display:grid;place-items:center;min-width:64px;padding:7px;border:1px solid #37516a;border-radius:8px;background:#0a1622;color:#dceefe;font-size:16px;font-weight:950}.color-recall-stats small{color:#6f8ba2;font-size:7px;letter-spacing:.12em}.color-recall-stage{display:flex;flex-direction:column;align-items:center;padding:14px;border:1px solid #263c50;border-radius:15px;background:linear-gradient(rgba(8,18,28,.86),rgba(5,11,18,.94))}.color-recall-status{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:40px;color:#b9cbd9;font-size:12px;text-align:center}.color-recall-status i{width:8px;height:8px;border-radius:50%;background:#617789}.color-recall-stage.showing .color-recall-status i{background:#f3c850;box-shadow:0 0 12px #f3c850;animation:recall-pulse .7s infinite}.color-recall-stage.input .color-recall-status i{background:#61dea7;box-shadow:0 0 12px #61dea7}.color-recall-stage.game_over .color-recall-status i{background:#ed5b68;box-shadow:0 0 12px #ed5b68}.color-wheel{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:10px;width:min(82vw,390px);aspect-ratio:1;margin:10px 0 14px;padding:12px;border:9px solid #152331;border-radius:50%;overflow:hidden;background:#07101a;box-shadow:inset 0 0 0 2px #476077,0 18px 35px rgba(0,0,0,.55)}.color-pad{position:relative;border:0;outline:0;cursor:pointer;filter:brightness(.52) saturate(.86);transition:filter .1s,transform .1s,box-shadow .1s}.color-pad:disabled{cursor:default}.color-pad span{position:absolute;color:rgba(255,255,255,.32);font-size:12px;font-weight:950}.pad-0{border-radius:100% 8px 8px 8px;background:linear-gradient(135deg,#ff7b84,#c51f35)}.pad-0 span{right:20%;bottom:17%}.pad-1{border-radius:8px 100% 8px 8px;background:linear-gradient(225deg,#75c9ff,#176fc5)}.pad-1 span{left:20%;bottom:17%}.pad-2{border-radius:8px 8px 8px 100%;background:linear-gradient(45deg,#68e7a1,#119151)}.pad-2 span{right:20%;top:17%}.pad-3{border-radius:8px 8px 100% 8px;background:linear-gradient(315deg,#ffe575,#d7a70d)}.pad-3 span{left:20%;top:17%}.color-pad.active{z-index:2;filter:brightness(1.48) saturate(1.15);transform:scale(.985);box-shadow:inset 0 0 35px rgba(255,255,255,.85),0 0 30px currentColor}.color-wheel-hub{position:absolute;z-index:4;left:50%;top:50%;display:grid;place-items:center;width:31%;aspect-ratio:1;transform:translate(-50%,-50%);border:7px solid #1c2c3a;border-radius:50%;background:radial-gradient(circle,#162a3c,#07111b 72%);box-shadow:0 7px 18px rgba(0,0,0,.65),inset 0 1px rgba(255,255,255,.13)}.color-wheel-hub strong{font-size:13px;letter-spacing:.09em}.color-wheel-hub small{color:#7992a6;font-size:9px}.sequence-progress{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;min-height:12px;max-width:420px}.sequence-progress i{width:7px;height:7px;border-radius:50%;background:#26394a}.sequence-progress i.current{background:#f0c852;box-shadow:0 0 8px #f0c852}.sequence-progress i.correct{background:#53d69d}.color-recall-start{min-width:210px;margin-top:18px;padding:13px 22px;border:1px solid #9bc7df;border-radius:10px;background:linear-gradient(#e7f6ff,#8cbdd7);box-shadow:0 5px 0 #426e87;color:#102230;font-size:14px;font-weight:950;letter-spacing:.08em;cursor:pointer}.color-recall-start:active{transform:translateY(4px);box-shadow:0 1px 0 #426e87}.color-recall-stage p{max-width:480px;margin:15px 0 2px;color:#70889b;font-size:10px;text-align:center}.color-recall-stage.showing .color-recall-start{opacity:.55}.color-recall-stage.showing .color-recall-start:hover{opacity:.8}@keyframes recall-pulse{50%{opacity:.35;transform:scale(.75)}}@media(max-width:560px){.color-recall-game{padding:11px}.color-recall-header{align-items:flex-start;flex-direction:column}.color-recall-stats{width:100%}.color-recall-stats span{flex:1;min-width:0}.color-wheel{width:min(88vw,350px);gap:7px;padding:9px}.color-wheel-hub{border-width:5px}.color-recall-header h2{font-size:24px}}
      `}</style>
    </section>
  );
};

export default RubiksCubeGame;
