
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useCoinSystem } from '../../context/CoinContext';
import GlassButton from '../ui/GlassButton';

const SEGMENTS = [
    { color: '#FFD700', label: '2x', multiplier: 2 },
    { color: '#C0C0C0', label: '0.5x', multiplier: 0.5 },
    { color: '#CD7F32', label: '1.5x', multiplier: 1.5 },
    { color: '#FFD700', label: '5x', multiplier: 5 },
    { color: '#C0C0C0', label: '0.2x', multiplier: 0.2 },
    { color: '#CD7F32', label: '1.5x', multiplier: 1.5 },
    { color: '#FFD700', label: '2x', multiplier: 2 },
    { color: '#C0C0C0', label: '0.5x', multiplier: 0.5 },
    { color: '#8b0000', label: '10x', multiplier: 10 },
    { color: '#C0C0C0', label: '0.2x', multiplier: 0.2 },
];

const SpinWheelGame: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { canBet, subtractCoins, addCoins, currencyMode } = useCoinSystem();
    const [bet, setBet] = useState(10);
    const [feedback, setFeedback] = useState('Place your bet and spin the wheel!');
    const [isSpinning, setIsSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
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
            ctx.fillStyle = segment.color;
            ctx.fill();
            ctx.stroke();

            ctx.save();
            ctx.rotate(i * segmentAngle + segmentAngle / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#000';
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText(segment.label, radius - 15, 10);
            ctx.restore();
        });
        ctx.restore();
        
        // Draw pointer
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.moveTo(centerX + radius - 5, centerY);
        ctx.lineTo(centerX + radius + 15, centerY - 10);
        ctx.lineTo(centerX + radius + 15, centerY + 10);
        ctx.closePath();
        ctx.fill();
    }, [segmentAngle]);

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

    const handleSpin = () => {
        if (!canBet(bet)) {
            setFeedback('Not enough coins!');
            return;
        }
        subtractCoins(bet, 'Wheel Spin');
        setIsSpinning(true);
        setFeedback('Spinning...');

        const spinDuration = 5000 + Math.random() * 3000; // 5-8 seconds
        const randomSpins = 8 + Math.random() * 8; // 8-16 full spins
        
        const currentAngle = rotation % (2 * Math.PI);
        const randomAngle = Math.random() * 2 * Math.PI;
        
        const targetRotation = currentAngle + randomSpins * 2 * Math.PI + randomAngle;
        
        let startTime: number | null = null;

        const animate = (timestamp: number) => {
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
                
                const winningIndex = Math.floor((SEGMENTS.length - (finalAngle / segmentAngle) + (SEGMENTS.length / 2)) % SEGMENTS.length);
                const winningSegment = SEGMENTS[winningIndex];
                
                const winnings = bet * winningSegment.multiplier;
                if (winnings > 0) addCoins(winnings, 'Wheel Win');
                
                setFeedback(`You landed on ${winningSegment.label}! You won ${winnings.toFixed(2)} ${currencySymbol}.`);
                setIsSpinning(false);
            }
        };

        animationFrameId.current = requestAnimationFrame(animate);
    };

    return (
        <div className="flex flex-col items-center gap-4 text-center p-4">
            <h2 className="text-3xl font-bold text-yellow-400">Spin Wheel</h2>
            <canvas ref={canvasRef} className="w-full max-w-[350px] aspect-square"></canvas>
            <div className="bg-black/20 p-3 rounded-lg text-center w-full max-w-sm min-h-[40px] flex items-center justify-center text-yellow-300 font-semibold">{feedback}</div>
            <div className="flex items-center gap-2 bg-gray-800/30 p-2 rounded-xl text-lg shadow-md">
                <label className="text-yellow-400 font-bold">Bet ({currencySymbol}):</label>
                <button onClick={() => setBet(b => Math.max(1, b - 1))} disabled={isSpinning} className="bg-yellow-400 text-gray-800 rounded-md px-2 font-bold">-</button>
                <input type="number" value={bet} onChange={e => setBet(Math.max(1, Number(e.target.value)))} disabled={isSpinning} className="w-24 text-center font-bold border-yellow-400/20 border rounded-md bg-gray-900 text-yellow-400 p-1" />
                <button onClick={() => setBet(b => Math.min(1000, b + 1))} disabled={isSpinning} className="bg-yellow-400 text-gray-800 rounded-md px-2 font-bold">+</button>
            </div>
            <GlassButton onClick={handleSpin} disabled={isSpinning} className="w-full max-w-sm text-xl py-3">
                {isSpinning ? 'Spinning...' : 'Spin'}
            </GlassButton>
        </div>
    );
};

export default SpinWheelGame;
