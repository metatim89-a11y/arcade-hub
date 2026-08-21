const fs = require('fs');

let content = fs.readFileSync('components/ArcadeLobby.tsx', 'utf8');

// 1. Add imports to ArcadeLobby.tsx
if (!content.includes('useCoinSystem')) {
    content = content.replace("import type { Game, GameMode } from '../types';", 
`import type { Game, GameMode } from '../types';
import { useCoinSystem } from '../context/CoinContext';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';`);
}

// 2. Add GC Claim Button JSX logic
const hookInsertStr = `  const featured = games.find((game) => game.id === (mode === 'Adult' ? 'fishing' : 'nim')) ?? games[0];`;
if (content.includes(hookInsertStr) && !content.includes('claimLevelFaucet')) {
    const hooksCode = `
  const { progression, claimLevelFaucet } = useCoinSystem();
  const { user } = useAuth();
  const [faucetReadyStr, setFaucetReadyStr] = useState<string>('');
  const [faucetReady, setFaucetReady] = useState(false);

  useEffect(() => {
    if (!progression.nextFaucetAt) {
      setFaucetReady(true);
      setFaucetReadyStr('CLAIM FREE GC NOW');
      return;
    }
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const nextTime = new Date(progression.nextFaucetAt!).getTime();
      if (now >= nextTime) {
         setFaucetReady(true);
         setFaucetReadyStr('CLAIM FREE GC NOW');
      } else {
         setFaucetReady(false);
         const diff = Math.floor((nextTime - now) / 1000);
         const m = Math.floor(diff / 60);
         const s = diff % 60;
         setFaucetReadyStr(\`COOLDOWN: \${m}m \${String(s).padStart(2, '0')}s\`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [progression.nextFaucetAt]);

  const handleClaim = async () => {
     if (!faucetReady) return;
     const result = await claimLevelFaucet();
     if (result) {
       alert("Successfully claimed free GC!");
     }
  };
`;    
    content = content.replace(hookInsertStr, hooksCode + "\n" + hookInsertStr);
}

// 3. Add the Faucet button to the hero row
const claimBtn = `
          {/* Claim GC Faucet Button */}
          {user && !user.isGuest && (
              <div className="absolute top-4 right-4 z-20">
                <button
                  type="button"
                  disabled={!faucetReady}
                  onClick={handleClaim}
                  className={\`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all \${faucetReady ? 'bg-gradient-to-b from-emerald-400 to-green-600 text-slate-950 hover:brightness-110 active:scale-95 animate-pulse shadow-[0_0_20px_rgba(52,211,153,0.5)]' : 'bg-slate-800 text-slate-400 opacity-70 cursor-not-allowed'}\`}
                >
                  {faucetReadyStr}
                </button>
              </div>
          )}
`;
if (!content.includes('Claim GC Faucet Button')) {
    content = content.replace(
        '<div className="relative overflow-hidden rounded-3xl onyx-glass-panel p-8 md:p-12 mb-8 border border-black/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_25px_60px_rgba(0,0,0,0.9)]">',
        '<div className="relative overflow-hidden rounded-3xl onyx-glass-panel p-8 md:p-12 mb-8 border border-black/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_25px_60px_rgba(0,0,0,0.9)]">\n' + claimBtn
    );
}

// 4. Add Rules / Details area at the bottom
const rulesStr = `
<!-- RULES AREA -->
`;
const newSection = `
      {/* Game Rules & About Info */}
      <div className="mt-12 bg-slate-950/60 p-8 rounded-3xl border border-white/5 space-y-6">
        <div>
          <h3 className="text-3xl font-black text-amber-200">About Arcade Hub</h3>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Welcome to the Arcade Hub! This is a dedicated platform designed to bring highly polished, high-performance web experiences right to your device in a seamless arcade environment. As you play, you can collect GC (Gas Coins) to dive into Head-to-Head competition or redeem Tickets for unique, beautiful cosmetics in the Shop. You can claim free GC every 4.75 minutes!
          </p>
        </div>
        
        <div className="pt-4 space-y-4">
          <h4 className="text-xl font-bold text-amber-100 uppercase tracking-widest border-b border-amber-500/20 pb-2">Rule Sets</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <strong className="text-amber-300">Neon Hopper</strong>
              <p className="text-xs text-slate-400">Navigate the glowing ball using the arrow keys or WASD across the high-speed highway and the floating neon logs. Do not get hit by the laser cars, and don't fall in the water! Reach the top safe zone to earn massive points.</p>
            </div>
            <div className="space-y-1">
              <strong className="text-amber-300">Mancala</strong>
              <p className="text-xs text-slate-400">Pick up stones from one of your pits. They distribute counter-clockwise. Landing the last stone in your store (the large end pit) grants another turn! Landing your last stone in an empty pit on your side captures the enemy pieces directly across.</p>
            </div>
            <div className="space-y-1">
              <strong className="text-amber-300">Block Drop</strong>
              <p className="text-xs text-slate-400">Classic brick stacking. Move left/right to steer and press ↻ to rotate. Clear full horizontal lines to score points and keep the board clear. If pieces stack over the top, the game is over.</p>
            </div>
            <div className="space-y-1">
              <strong className="text-amber-300">Nim Game</strong>
              <p className="text-xs text-slate-400">A pure mathematical logic game. On your turn, take any number of tokens (at least 1) from *a single pile*. Whoever is forced to take the very last token loses the game.</p>
            </div>
            <div className="space-y-1">
              <strong className="text-amber-300">Chutes & Ladders</strong>
              <p className="text-xs text-slate-400">Race your rival to exactly 100! Roll the dice and advance. If you land on a green ladder, you climb up. If you land on a red chute, you slide back down.</p>
            </div>
            <div className="space-y-1">
              <strong className="text-amber-300">Head-to-Head Economics</strong>
              <p className="text-xs text-slate-400">In Head-to-Head play, you use GC to buy in, but payouts are awarded entirely in Tickets. Tickets serve as a high score leaderboard mechanic, showing off your lifetime arcade success, which can then be redeemed for premium Shop Cosmetics.</p>
            </div>
          </div>
        </div>
      </div>
`;
if (!content.includes('About Arcade Hub')) {
    content = content.replace('</section>', newSection + '\n    </section>');
}

fs.writeFileSync('components/ArcadeLobby.tsx', content);

