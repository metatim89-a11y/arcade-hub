import React from 'react';
import type { Game, GameMode } from '../types';

type ArcadeLobbyProps = {
  games: Game[];
  mode: GameMode;
  onPlay: (game: Game) => void;
};

const cardArt: Record<string, { icon: string; className: string; blurb: string }> = {
  fishing: { icon: '🐋', className: 'lobby-art-ocean', blurb: 'Track the big catch' },
  slots: { icon: '🎰', className: 'lobby-art-vault', blurb: 'Spin the Volt Vault' },
  plinko: { icon: '💎', className: 'lobby-art-plinko', blurb: 'Drop into the multipliers' },
  crash: { icon: '🚀', className: 'lobby-art-crash', blurb: 'Ride the curve' },
  wheel: { icon: '🎡', className: 'lobby-art-wheel', blurb: 'Pick your lucky lane' },
  worm: { icon: '🪱', className: 'lobby-art-worm', blurb: 'Grow and survive' },
  mancala: { icon: '🟠', className: 'lobby-art-mancala', blurb: 'Classic strategy' },
  rps: { icon: '🃏', className: 'lobby-art-rps', blurb: 'Read the table' },
};

const ArcadeLobby: React.FC<ArcadeLobbyProps> = ({ games, mode, onPlay }) => {
  const featured = games.find((game) => game.id === (mode === 'Adult' ? 'fishing' : 'worm')) ?? games[0];
  const art = cardArt[featured.id] ?? { icon: '✨', className: 'lobby-art-default', blurb: 'Play the latest Arcade Hub game' };
  const originals = games.slice(0, 6);

  return (
    <section className="arcade-lobby" aria-label="Arcade Hub lobby">
      <div className={`lobby-hero ${art.className}`}>
        <div className="lobby-hero-copy">
          <span className="lobby-eyebrow">ARCADE HUB ORIGINAL</span>
          <h1>{featured.label}</h1>
          <p>{art.blurb}. Jump in instantly, then share your run with a friend.</p>
          <button type="button" onClick={() => onPlay(featured)}>PLAY NOW <span>→</span></button>
        </div>
        <div className="lobby-hero-icon" aria-hidden="true">{art.icon}</div>
      </div>

      <div className="lobby-section-heading"><div><span>CURATED FOR YOU</span><h2>Arcade Originals</h2></div><small>{games.length} games</small></div>
      <div className="lobby-card-row">
        {originals.map((game) => {
          const gameArt = cardArt[game.id] ?? { icon: '✨', className: 'lobby-art-default', blurb: 'Arcade Hub original' };
          return <button type="button" key={game.id} className={`lobby-game-card ${gameArt.className}`} onClick={() => onPlay(game)}><span className="lobby-card-icon" aria-hidden="true">{gameArt.icon}</span><strong>{game.label}</strong><small>{gameArt.blurb}</small></button>;
        })}
      </div>

      <div className="lobby-challenge"><div><span>DAILY CHALLENGE</span><h2>Make one great run.</h2><p>Try a new game today and keep your streak alive.</p></div><button type="button" onClick={() => onPlay(games[Math.min(2, games.length - 1)])}>START CHALLENGE <span>→</span></button></div>

      <style>{`
        .arcade-lobby{width:100%;max-width:1120px;padding:14px 0 22px;color:#e8f5ff}.lobby-hero{position:relative;display:flex;align-items:center;justify-content:space-between;min-height:260px;overflow:hidden;padding:28px 32px;border:1px solid #31536b;border-radius:24px;background:radial-gradient(circle at 80% 30%,rgba(63,213,245,.34),transparent 35%),linear-gradient(135deg,#132d3c,#08131d);box-shadow:0 24px 55px rgba(0,0,0,.32),inset 0 1px rgba(255,255,255,.1)}.lobby-hero:after{content:'';position:absolute;inset:auto -10% -55%;height:180px;background:radial-gradient(ellipse,rgba(255,207,78,.28),transparent 64%);transform:rotate(-5deg)}.lobby-hero-copy{position:relative;z-index:1;max-width:520px}.lobby-eyebrow,.lobby-section-heading span,.lobby-challenge>div>span{color:#f1c84e;font-size:9px;font-weight:950;letter-spacing:.2em}.lobby-hero h1{margin:5px 0 8px;font-size:clamp(36px,6vw,70px);line-height:.95;letter-spacing:-.06em;text-shadow:0 7px 22px rgba(0,0,0,.36)}.lobby-hero p{max-width:440px;margin:0 0 18px;color:#b1c9d8;font-size:14px}.lobby-hero button,.lobby-challenge button{padding:12px 18px;border:0;border-radius:10px;background:linear-gradient(#ffe066,#e89520);box-shadow:0 5px 0 #81500d;color:#261b08;font-weight:950;cursor:pointer}.lobby-hero button span,.lobby-challenge button span{margin-left:10px;font-size:18px}.lobby-hero-icon{position:relative;z-index:1;display:grid;place-items:center;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,#fef3b4,#f1a522 42%,#7b3517 70%,transparent 71%);font-size:112px;filter:drop-shadow(0 20px 25px rgba(0,0,0,.45));animation:lobby-float 4s ease-in-out infinite}.lobby-section-heading{display:flex;align-items:end;justify-content:space-between;margin:26px 2px 10px}.lobby-section-heading h2{margin:3px 0 0;font-size:27px;letter-spacing:-.04em}.lobby-section-heading small{color:#8ba8b9;font-size:11px}.lobby-card-row{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.lobby-game-card{display:flex;min-height:172px;flex-direction:column;align-items:flex-start;justify-content:flex-end;gap:4px;overflow:hidden;padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:15px;background:linear-gradient(160deg,#7d4ce8,#e5368c);color:white;text-align:left;box-shadow:0 12px 22px rgba(0,0,0,.2);cursor:pointer;transition:transform .18s,filter .18s}.lobby-game-card:hover{transform:translateY(-5px);filter:brightness(1.12)}.lobby-game-card strong{font-size:16px;text-shadow:0 2px 5px rgba(0,0,0,.35)}.lobby-game-card small{color:rgba(255,255,255,.8);font-size:9px}.lobby-card-icon{align-self:center;margin:auto 0 8px;font-size:54px;filter:drop-shadow(0 8px 5px rgba(0,0,0,.28))}.lobby-art-plinko{background:linear-gradient(160deg,#7849ef,#fa3155)}.lobby-art-vault{background:linear-gradient(160deg,#182b92,#eb3f3f)}.lobby-art-ocean{background:linear-gradient(160deg,#067da4,#38d8bd)}.lobby-art-crash{background:linear-gradient(160deg,#152e76,#f04e38)}.lobby-art-wheel{background:linear-gradient(160deg,#0f826f,#f2ae2e)}.lobby-art-worm{background:linear-gradient(160deg,#1e88c7,#7c3aed)}.lobby-art-mancala{background:linear-gradient(160deg,#8b4513,#e6a437)}.lobby-art-rps{background:linear-gradient(160deg,#853fe7,#ea3f98)}.lobby-challenge{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:24px;padding:20px 24px;border:1px solid #2d536b;border-radius:16px;background:linear-gradient(115deg,#142c3b,#0c1a26)}.lobby-challenge h2{margin:4px 0;font-size:24px}.lobby-challenge p{margin:0;color:#9bb4c4;font-size:12px}@keyframes lobby-float{50%{transform:translateY(-8px) rotate(2deg)}}@media(max-width:760px){.arcade-lobby{padding:6px 0 14px}.lobby-hero{min-height:270px;padding:22px 18px;border-radius:17px}.lobby-hero-icon{position:absolute;right:-38px;bottom:-35px;width:205px;height:205px;font-size:92px;opacity:.82}.lobby-hero-copy{max-width:80%}.lobby-hero h1{font-size:42px}.lobby-hero p{font-size:12px}.lobby-section-heading{margin-top:20px}.lobby-section-heading h2{font-size:22px}.lobby-card-row{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.lobby-game-card{min-height:145px;padding:9px;border-radius:12px}.lobby-card-icon{font-size:40px}.lobby-game-card strong{font-size:12px}.lobby-game-card small{font-size:8px}.lobby-challenge{align-items:flex-start;flex-direction:column;padding:16px}.lobby-challenge button{width:100%}}
      `}</style>
    </section>
  );
};

export default ArcadeLobby;
