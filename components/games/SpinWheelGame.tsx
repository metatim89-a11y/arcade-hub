
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useCoinSystem } from '../../context/CoinContext';

const SEGMENT_STYLE: Record<number, { color: string; label: string }> = {
    0: { color: '#4d2330', label: '0x' },
    0.5: { color: '#9aa1ad', label: '0.5x' },
    1: { color: '#c98b31', label: '1x' },
    1.5: { color: '#d6b84c', label: '1.5x' },
    3: { color: '#f4d35e', label: '3x' },
    6: { color: '#ffd700', label: '6x' },
};

// Keep the exact payout distribution, but deliberately alternate outcomes so
// wins and losses are visually mixed around the wheel.
const SEGMENT_MULTIPLIERS = [0, 0.5, 1, 0, 1.5, 0.5, 1, 0, 3, 0.5, 1, 0, 6, 0.5, 1.5, 0, 0.5, 1, 0, 0.5];
const SEGMENTS = SEGMENT_MULTIPLIERS.map((multiplier) => ({ ...SEGMENT_STYLE[multiplier], multiplier }));

const SpinWheelGame: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { canBet, subtractCoins, addCoins, currencyMode, isProcessing } = useCoinSystem();
    const [bet, setBet] = useState(10);
    const [feedback, setFeedback] = useState('Place your bet and spin the wheel!');
    const [isSpinning, setIsSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [winningIndex, setWinningIndex] = useState<number | null>(null);
    const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';
    const animationFrameId = useRef<number | null>(null);
    const rotationRef = useRef(rotation);
    rotationRef.current = rotation;

    const segmentAngle = 2 * Math.PI / SEGMENTS.length;

    const drawWheel = useCallback((angle: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle);

        SEGMENTS.forEach((segment, i) => {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, i * segmentAngle, (i + 1) * segmentAngle);
            ctx.closePath();
            
            // Winning Glow
            if (winningIndex === i) {
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#fff';
            } else {
                ctx.fillStyle = segment.color;
                ctx.shadowBlur = 0;
            }
            
            ctx.fill();
            ctx.strokeStyle = '#4a3107';
            ctx.lineWidth = 5;
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.save();
            ctx.rotate(i * segmentAngle + segmentAngle / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#000';
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText(segment.label, radius - 15, 10);
            ctx.restore();
        });
        ctx.restore();

        const rim = ctx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
        rim.addColorStop(0, '#3c2705');
        rim.addColorStop(.5, '#b88727');
        rim.addColorStop(1, '#402806');
        ctx.strokeStyle = rim;
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 5, 0, Math.PI * 2);
        ctx.stroke();
        const glass = ctx.createRadialGradient(centerX - radius * .35, centerY - radius * .42, 4, centerX, centerY, radius);
        glass.addColorStop(0, 'rgba(255,255,255,.32)');
        glass.addColorStop(.42, 'rgba(255,255,255,.06)');
        glass.addColorStop(1, 'rgba(20,12,4,.2)');
        ctx.fillStyle = glass;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 11, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw pointer with click react
        const tickerOffset = Math.sin(angle * SEGMENTS.length) * 5;

        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.moveTo(centerX + radius - 5, centerY + tickerOffset);
        ctx.lineTo(centerX + radius + 15, centerY - 10);
        ctx.lineTo(centerX + radius + 15, centerY + 10);
        ctx.closePath();
        ctx.fill();
    }, [segmentAngle, winningIndex]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const parent = canvas.parentElement;
        if (!parent) return;
        
        const resizeObserver = new ResizeObserver(entries => {
            window.requestAnimationFrame(() => {
                if (!Array.isArray(entries) || !entries.length) {
                    return;
                }
                const entry = entries[0];
                if (entry) {
                    const newSize = Math.floor(Math.min(entry.contentRect.width, 400) - 32);
                    if (canvas.width !== newSize) {
                        canvas.width = newSize;
                        canvas.height = newSize;
                        drawWheel(rotationRef.current);
                    }
                }
            });
        });
        
        resizeObserver.observe(parent);

        // Initial sizing
        const initialSize = Math.floor(Math.min(parent.clientWidth, 400) - 32);
        canvas.width = initialSize;
        canvas.height = initialSize;
        drawWheel(rotationRef.current);
        
        return () => resizeObserver.disconnect();
    }, [drawWheel]);

    useEffect(() => {
        drawWheel(rotation);
        return () => {
            if(animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        }
    }, [rotation, drawWheel]);

    // Easing function for slow start, fast middle, slow end
    const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const handleSpin = async () => {
        if (isSpinning || isProcessing) return;
        if (!canBet(bet)) {
            setFeedback('Not enough coins!');
            return;
        }
        setIsSpinning(true);
        setWinningIndex(null);
        setFeedback('Confirming your wheel bet…');
        const roundBet = bet;
        const roundCurrency = currencyMode;
        const charged = await subtractCoins(roundBet, 'Wheel Spin', roundCurrency);
        if (!charged) {
            setFeedback('The bet was not charged, so the wheel did not spin.');
            setIsSpinning(false);
            return;
        }
        setFeedback('Spinning…');

        const spinDuration = 5000 + Math.random() * 3000; // 5-8 seconds
        const randomSpins = 8 + Math.random() * 8; // 8-16 full spins
        
        const currentAngle = rotation % (2 * Math.PI);
        const randomAngle = Math.random() * 2 * Math.PI;
        
        const targetRotation = currentAngle + randomSpins * 2 * Math.PI + randomAngle;
        
        let startTime: number | null = null;

        const animate = async (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / spinDuration, 1);
            const easedProgress = easeInOutCubic(progress);
            
            const currentRotation = rotation + (targetRotation - rotation) * easedProgress;

            drawWheel(currentRotation);
            
            if (progress < 1) {
                animationFrameId.current = requestAnimationFrame(animate);
            } else {
                const finalAngle = currentRotation % (2 * Math.PI);
                setRotation(finalAngle);
                
                // The pointer sits at 0 radians (the right edge). Undo the wheel rotation,
                // then use that same segment for the label, payout, and highlighted slice.
                const pointerAngle = ((-finalAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
                const winIdx = Math.floor(pointerAngle / segmentAngle) % SEGMENTS.length;
                setWinningIndex(winIdx);
                const winningSegment = SEGMENTS[winIdx];
                
                const winnings = roundBet * winningSegment.multiplier;
                const credited = winnings > 0 && await addCoins(winnings, 'Wheel Win', roundCurrency);
                setFeedback(credited
                    ? `Landed on ${winningSegment.label} — paid ${winnings.toFixed(2)} ${roundCurrency === 'fun' ? 'FC' : 'RC'}.`
                    : `Landed on ${winningSegment.label}, but the ${winnings.toFixed(2)} ${roundCurrency === 'fun' ? 'FC' : 'RC'} payout was not confirmed.`);
                setIsSpinning(false);
            }
        };

        animationFrameId.current = requestAnimationFrame(animate);
    };

    return (
        <section className="wheel-game">
            <div className="wheel-kicker">GLASS SERIES · 95% RTP</div><h2>Spin Wheel</h2>
            <div className="wheel-glass"><canvas ref={canvasRef} /></div>
            <div className="wheel-feedback" role="status">{feedback}</div>
            <div className="wheel-controls"><label>BET <span>{currencySymbol}</span></label><button onClick={() => setBet(value => Math.max(1, value - 1))} disabled={isSpinning}>−</button><input type="number" value={bet} onChange={event => setBet(Math.min(1000, Math.max(1, Number(event.target.value))))} disabled={isSpinning} /><button onClick={() => setBet(value => Math.min(1000, value + 1))} disabled={isSpinning}>+</button></div>
            <button type="button" className="wheel-spin" onClick={() => void handleSpin()} disabled={isSpinning || isProcessing}>{isSpinning ? 'SPINNING…' : 'SPIN THE WHEEL'}</button>
            <style>{`
              .wheel-game{width:min(100%,620px);margin:auto;padding:22px;border:1px solid rgba(210,165,70,.42);border-radius:22px;background:linear-gradient(145deg,rgba(35,29,39,.72),rgba(10,13,18,.76));backdrop-filter:blur(18px) saturate(1.25);box-shadow:inset 0 1px rgba(255,255,255,.15),0 25px 65px rgba(0,0,0,.42);text-align:center}.wheel-kicker{color:#cfa94e;font-size:9px;font-weight:900;letter-spacing:.2em}.wheel-game h2{margin:3px 0 13px;color:#f4e6b7;font-size:28px}.wheel-glass{position:relative;width:min(100%,430px);margin:auto;padding:15px;border:1px solid rgba(255,255,255,.2);border-radius:50%;background:radial-gradient(circle at 32% 20%,rgba(255,255,255,.2),rgba(255,255,255,.04) 48%,rgba(77,48,12,.18));box-shadow:inset 0 0 28px rgba(255,255,255,.1),0 18px 40px rgba(0,0,0,.4);backdrop-filter:blur(12px)}.wheel-glass:after{content:'';position:absolute;inset:9% 20% 55%;border-radius:50%;background:linear-gradient(rgba(255,255,255,.25),transparent);pointer-events:none;transform:rotate(-12deg)}.wheel-glass canvas{display:block;width:100%;aspect-ratio:1}.wheel-feedback{display:flex;align-items:center;justify-content:center;min-height:43px;margin:14px auto 10px;padding:9px 12px;border:1px solid rgba(211,169,75,.3);border-radius:9px;background:rgba(7,9,12,.42);color:#e7d49c;font-size:12px}.wheel-controls{display:grid;grid-template-columns:1fr 38px 90px 38px;align-items:center;gap:6px;max-width:380px;margin:auto}.wheel-controls label{color:#a99565;font-size:9px;font-weight:900;letter-spacing:.12em;text-align:left}.wheel-controls label span{color:#e5c765}.wheel-controls button,.wheel-controls input{height:38px;border:1px solid rgba(204,160,63,.4);border-radius:7px;background:rgba(11,14,17,.55);color:#f2dfaa;text-align:center;font-weight:900}.wheel-controls button{cursor:pointer}.wheel-spin{width:min(100%,380px);margin-top:10px;padding:14px;border:1px solid #d6a73b;border-radius:9px;background:linear-gradient(#e6c15d,#a97419);box-shadow:0 5px 0 #5c3d0a;color:#281a05;font-weight:950;letter-spacing:.08em;cursor:pointer}.wheel-spin:disabled,.wheel-controls button:disabled{opacity:.48;cursor:not-allowed}@media(max-width:480px){.wheel-game{padding:13px}.wheel-glass{padding:9px}.wheel-controls{grid-template-columns:1fr 34px 74px 34px}}
            `}</style>
        </section>
    );
};

export default SpinWheelGame;
