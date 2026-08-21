import React, { useState, useEffect } from 'react';
import { H2HMatchRoom, Game } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCoinSystem } from '../../context/CoinContext';
import GlassButton from '../ui/GlassButton';

interface HeadToHeadArenaProps {
  room: H2HMatchRoom;
  games: Game[];
  onExitMatch: () => void;
}

const TAUNT_EMOJIS = ['🔥', '💥', '🏆', '👑', '😱', '👏', '⚡', '😎'];

const HeadToHeadArena: React.FC<HeadToHeadArenaProps> = ({ room, games, onExitMatch }) => {
  const { user } = useAuth();
  const { awardLevelExperience, setFunCoins, setTickets } = useCoinSystem();

  const activeGame = games.find(g => g.id === room.gameId) || games[0];
  const GameComponent = activeGame.component;

  const [hostScore, setHostScore] = useState(0);
  const [guestScore, setGuestScore] = useState(0);
  const [matchTime, setMatchTime] = useState(60); // 60s match timer
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<{ username: string; avatar?: string; rewardGc: number } | null>(null);
  const [recentTaunt, setRecentTaunt] = useState<{ emoji: string; sender: string } | null>(null);

  const isHost = user?.id === room.hostUser.id;
  const myUser = isHost ? room.hostUser : (room.guestUser || { id: 'guest-2', username: 'RivalPlayer' });
  const opponentUser = isHost ? (room.guestUser || { id: 'guest-bot', username: 'ArcadeBot' }) : room.hostUser;

  // Simulate opponent score progress during live match
  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      setMatchTime((t) => {
        if (t <= 1) {
          setGameOver(true);
          return 0;
        }
        return t - 1;
      });

      // Opponent score progression
      if (Math.random() < 0.6) {
        if (isHost) {
          setGuestScore((s) => s + Math.floor(Math.random() * 80 + 20));
        } else {
          setHostScore((s) => s + Math.floor(Math.random() * 80 + 20));
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameOver, isHost]);

  // Handle Match Finish & Rewards
  useEffect(() => {
    if (!gameOver) return;

    const myScore = isHost ? hostScore : guestScore;
    const oppScore = isHost ? guestScore : hostScore;
    const prizePool = room.stakeGc * 2;

    if (myScore >= oppScore) {
      setWinner({ username: myUser.username, avatar: myUser.avatar, rewardGc: prizePool });
      if (prizePool > 0) {
        setFunCoins(c => c + prizePool);
      }
      setTickets(t => t + 50);
      void awardLevelExperience(150);
    } else {
      setWinner({ username: opponentUser.username, avatar: opponentUser.avatar, rewardGc: prizePool });
      void awardLevelExperience(30);
    }
  }, [gameOver]);

  const sendTaunt = (emoji: string) => {
    setRecentTaunt({ emoji, sender: myUser.username });
    setTimeout(() => setRecentTaunt(null), 2500);
  };

  return (
    <div className="w-full max-w-6xl px-2 py-4 text-white select-none flex flex-col items-center">
      {/* Top Head-to-Head HUD Bar */}
      <div className="w-full bg-slate-900/90 border border-red-500/40 rounded-2xl p-4 mb-4 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        {/* Player 1 (You) */}
        <div className="flex items-center gap-3">
          <img src={myUser.avatar} alt={myUser.username} className="w-11 h-11 rounded-xl border-2 border-emerald-400 object-cover" />
          <div>
            <span className="text-[10px] font-black text-emerald-400 tracking-wider uppercase">YOU</span>
            <strong className="block text-base font-black text-white">{myUser.username}</strong>
            <span className="text-xl font-black text-yellow-300">{isHost ? hostScore : guestScore} PTS</span>
          </div>
        </div>

        {/* Center Timer & Match Title */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 text-xs font-black text-red-400 uppercase tracking-widest bg-red-950/60 px-4 py-1 rounded-full border border-red-500/30">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
            LIVE BATTLE • {room.gameLabel}
          </div>
          <div className="text-3xl font-black text-amber-300 mt-1 tracking-wider">
            ⏱️ {matchTime}s
          </div>
          <span className="text-[10px] font-bold text-slate-400">PRIZE POOL: <span className="text-yellow-300">{room.stakeGc * 2} GC</span></span>
        </div>

        {/* Player 2 (Opponent) */}
        <div className="flex items-center gap-3 text-right">
          <div>
            <span className="text-[10px] font-black text-red-400 tracking-wider uppercase">OPPONENT</span>
            <strong className="block text-base font-black text-white">{opponentUser.username}</strong>
            <span className="text-xl font-black text-yellow-300">{isHost ? guestScore : hostScore} PTS</span>
          </div>
          <img src={opponentUser.avatar} alt={opponentUser.username} className="w-11 h-11 rounded-xl border-2 border-red-400 object-cover" />
        </div>
      </div>

      {/* Floating Emoji Taunt Notification */}
      {recentTaunt && (
        <div className="fixed top-24 z-50 bg-slate-900 border-2 border-amber-400 text-white px-6 py-2.5 rounded-full shadow-2xl animate-bounce flex items-center gap-3 text-lg font-black">
          <span>{recentTaunt.sender}:</span>
          <span className="text-3xl">{recentTaunt.emoji}</span>
        </div>
      )}

      {/* Game Stage & Live Side Bar */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        {/* Main Active Play Area (3 Cols) */}
        <div className="lg:col-span-3 flex flex-col items-center justify-center bg-slate-950/80 p-4 rounded-3xl border border-slate-800 shadow-2xl min-h-[500px]">
          <React.Suspense fallback={<div className="text-amber-300 font-bold">Loading Arena Game...</div>}>
            <GameComponent />
          </React.Suspense>
        </div>

        {/* Live Opponent Feed & Emoji Taunts Bar (1 Col) */}
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3 text-center">
            <h4 className="text-xs font-black text-amber-300 uppercase tracking-widest">LIVE TAUNT BAR</h4>
            <div className="grid grid-cols-4 gap-2">
              {TAUNT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendTaunt(emoji)}
                  className="text-2xl p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
            <h4 className="text-xs font-black text-cyan-300 uppercase tracking-widest">MATCH DETAILS</h4>
            <div className="space-y-2 text-xs font-semibold text-slate-300">
              <div className="flex justify-between"><span>Room Code:</span><span className="text-yellow-300 font-bold">{room.roomCode}</span></div>
              <div className="flex justify-between"><span>Stake:</span><span className="text-emerald-400 font-bold">{room.stakeGc} GC</span></div>
              <div className="flex justify-between"><span>Status:</span><span className="text-green-400 font-bold">IN PROGRESS</span></div>
            </div>
            <button
              onClick={onExitMatch}
              className="w-full mt-2 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-200 font-bold text-xs border border-red-500/30 transition"
            >
              FORFEIT & EXIT
            </button>
          </div>
        </div>
      </div>

      {/* Match Winner Modal Popup */}
      {winner && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl animate-pop-in">
            <span className="text-5xl">🏆</span>
            <h2 className="text-3xl font-black text-yellow-300 uppercase">MATCH FINISHED!</h2>
            <div className="flex flex-col items-center justify-center gap-2">
              <img src={winner.avatar} alt={winner.username} className="w-16 h-16 rounded-2xl border-2 border-amber-400 object-cover shadow-lg" />
              <span className="text-xl font-black text-white">{winner.username} VICTORY!</span>
              <p className="text-xs font-bold text-emerald-400">AWARDED +{winner.rewardGc} GC & +50 TICKETS!</p>
            </div>
            <GlassButton onClick={onExitMatch} className="w-full justify-center text-sm py-3 !bg-amber-500 text-slate-950 font-black">
              RETURN TO HEAD-TO-HEAD LOBBY
            </GlassButton>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeadToHeadArena;
