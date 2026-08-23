import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCoinSystem } from '../../context/CoinContext';
import { H2HMatchRoom, Game } from '../../types';
import { getSupabase } from '../../lib/supabase';
import GlassButton from '../ui/GlassButton';

interface HeadToHeadLobbyProps {
  games: Game[];
  onStartMatch: (room: H2HMatchRoom) => void;
  onBack: () => void;
}

const STAKE_OPTIONS = [0, 50, 250, 500, 1000];

const HeadToHeadLobby: React.FC<HeadToHeadLobbyProps> = ({ games, onStartMatch, onBack }) => {
  const { user } = useAuth();
  const { funCoins } = useCoinSystem();
  const supabase = getSupabase();

  const [rooms, setRooms] = useState<H2HMatchRoom[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>(games[0]?.id || 'mancala');
  const [selectedStake, setSelectedStake] = useState<number>(100);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [activeWaitingRoom, setActiveWaitingRoom] = useState<H2HMatchRoom | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch active matches from Supabase
  const fetchMatches = async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase.rpc('get_h2h_active_matches');
      
      if (fetchError) throw fetchError;

      const convertedRooms: H2HMatchRoom[] = (data || []).map((m: any) => ({
        id: m.id,
        roomCode: m.room_code,
        gameId: m.game_id,
        gameLabel: m.game_label,
        hostUser: {
          id: m.host_user_id,
          username: m.host_username || 'Unknown',
          avatar: m.host_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
        },
        guestUser: m.guest_user_id ? {
          id: m.guest_user_id,
          username: m.guest_username || 'Unknown',
          avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80',
        } : undefined,
        stakeGc: m.stake_gc,
        status: m.status as 'waiting' | 'in_progress',
        hostScore: 0,
        guestScore: 0,
        createdAt: m.created_at,
      }));

      setRooms(convertedRooms);
    } catch (err) {
      console.error('Failed to fetch matches:', err);
      setError('Failed to load matches. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchMatches();
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    const subscription = supabase
      .channel('h2h_matches_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'h2h_matches' }, () => {
        fetchMatches();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleCreateRoom = async () => {
    if (selectedStake > funCoins) {
      setError(`Insufficient GC balance (${Math.floor(funCoins)} GC). Claim free GC from the faucet or choose a lower stake!`);
      return;
    }

    try {
      setError(null);
      const chosenGame = games.find(g => g.id === selectedGameId) || games[0];

      const { data, error: createError } = await supabase.rpc('create_h2h_match', {
        p_game_id: chosenGame.id,
        p_game_label: chosenGame.label,
        p_stake_gc: selectedStake,
        p_match_duration_seconds: 60,
      });

      if (createError) throw createError;
      if (!data || data.length === 0) throw new Error('Failed to create match');

      const matchId = data[0].id;
      const roomCode = data[0].room_code;

      // Create local representation for waiting room display
      const newRoom: H2HMatchRoom = {
        id: matchId,
        roomCode: roomCode,
        gameId: chosenGame.id,
        gameLabel: chosenGame.label,
        hostUser: {
          id: user?.id || 'guest',
          username: user?.username || 'Challenger',
          avatar: user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
        },
        stakeGc: selectedStake,
        status: 'waiting',
        hostScore: 0,
        guestScore: 0,
        createdAt: new Date().toISOString(),
      };

      setActiveWaitingRoom(newRoom);
      setIsCreating(false);
      
      // Refresh matches
      await fetchMatches();
    } catch (err: any) {
      console.error('Failed to create match:', err);
      setError(err.message || 'Failed to create match room. Please try again.');
    }
  };

  const handleJoinRoom = async (room: H2HMatchRoom) => {
    if (room.hostUser.id === user?.id) {
      setError("You are the host of this match! Waiting for an opponent to enter.");
      return;
    }
    if (room.stakeGc > funCoins) {
      setError(`Insufficient GC balance (${Math.floor(funCoins)} GC) to join this ${room.stakeGc} GC stake match.`);
      return;
    }

    try {
      setError(null);
      const { data, error: joinError } = await supabase.rpc('join_h2h_match', {
        p_match_id: room.id,
      });

      if (joinError) throw joinError;

      // Update local room state
      const updatedRoom: H2HMatchRoom = {
        ...room,
        guestUser: {
          id: user?.id || 'guest-2',
          username: user?.username || 'RivalPlayer',
          avatar: user?.avatar || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80',
        },
        status: 'in_progress',
      };

      onStartMatch(updatedRoom);
    } catch (err: any) {
      console.error('Failed to join match:', err);
      setError(err.message || 'Failed to join match. Please try again.');
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCodeInput.trim().toUpperCase();
    const found = rooms.find(r => r.roomCode === cleanCode);
    if (!found) {
      setError(`Match room '${cleanCode}' not found. Please check the code and try again.`);
      return;
    }
    await handleJoinRoom(found);
  };

  return (
    <div className="w-full max-w-5xl px-4 py-6 text-white select-none">
      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-950/80 border border-red-500/60 flex items-start gap-3 shadow-lg">
          <span className="text-xl mt-0.5">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-100">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 font-bold text-xl leading-none"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-950/80 via-slate-900/90 to-amber-950/80 p-6 sm:p-8 border border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.2)] mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-400/40 text-red-300 text-xs font-black tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
            LIVE MULTIPLAYER ARENA
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
            ⚔️ HEAD-TO-HEAD BATTLES
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-semibold leading-relaxed">
            Challenge players online or invite friends using room codes! Stake GC, compete live side-by-side, and claim victory rewards!
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.5)] hover:scale-105 active:scale-95 transition-all text-center"
          >
            + CREATE MATCH ROOM
          </button>
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-3 rounded-2xl bg-slate-800/80 text-slate-300 font-bold text-sm hover:bg-slate-700 transition-all text-center border border-slate-700"
          >
            ← BACK TO LOBBY
          </button>
        </div>
      </div>

      {/* Waiting Room Popup Modal if active */}
      {activeWaitingRoom && (
        <div className="mb-8 p-6 rounded-3xl bg-slate-900/95 border-2 border-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.4)] flex flex-col items-center text-center space-y-4">
          <div className="text-amber-300 text-xs font-black uppercase tracking-widest animate-pulse">
            ⏳ WAITING FOR OPPONENT TO JOIN...
          </div>
          <h2 className="text-2xl font-black text-white">
            {activeWaitingRoom.gameLabel} • {activeWaitingRoom.stakeGc} GC STAKE
          </h2>
          <div className="flex items-center gap-3 bg-black/60 px-5 py-2.5 rounded-xl border border-amber-500/30">
            <span className="text-slate-400 text-xs font-bold uppercase">ROOM CODE:</span>
            <span className="text-2xl font-black text-yellow-300 tracking-wider">{activeWaitingRoom.roomCode}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(activeWaitingRoom.roomCode);
                alert(`Room Code '${activeWaitingRoom.roomCode}' copied to clipboard! Share it with a friend.`);
              }}
              className="text-xs bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 px-3 py-1 rounded-lg font-bold border border-amber-400/40 transition"
            >
              📋 COPY
            </button>
          </div>
          <div className="flex gap-3 pt-2">
            <GlassButton onClick={() => handleJoinRoom(activeWaitingRoom)} className="!bg-emerald-600 hover:!bg-emerald-500 py-2 px-6 text-sm">
              START PRACTICE VS BOT
            </GlassButton>
            <button
              onClick={() => setActiveWaitingRoom(null)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition"
            >
              DISMISS
            </button>
          </div>
        </div>
      )}

      {/* Create Match Modal Form */}
      {isCreating && (
        <div className="mb-8 p-6 rounded-3xl bg-slate-900 border-2 border-amber-400/80 shadow-2xl space-y-5 animate-pop-in">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="text-2xl font-black text-yellow-300 uppercase">CREATE HEAD-TO-HEAD ROOM</h3>
            <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-white font-black text-lg">✕</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-slate-300 text-xs font-bold uppercase mb-2">Select Game Title</label>
              <select
                value={selectedGameId}
                onChange={(e) => setSelectedGameId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-bold focus:outline-none focus:border-amber-400"
              >
                {games.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 text-xs font-bold uppercase mb-2">Select GC Buy-In Stake</label>
              <div className="flex gap-2 flex-wrap">
                {STAKE_OPTIONS.map((stake) => (
                  <button
                    key={stake}
                    type="button"
                    onClick={() => setSelectedStake(stake)}
                    className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all ${
                      selectedStake === stake
                        ? 'bg-amber-400 text-slate-950 scale-105 shadow-[0_0_15px_rgba(252,211,77,0.5)]'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {stake === 0 ? 'FREE' : `${stake} GC`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsCreating(false)}
              className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs hover:bg-slate-700"
            >
              CANCEL
            </button>
            <button
              onClick={handleCreateRoom}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-110"
            >
              CREATE CHALLENGE ROOM
            </button>
          </div>
        </div>
      )}

      {/* Join Code Input Row */}
      <div className="mb-8 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="text-center sm:text-left">
          <h4 className="text-sm font-black text-amber-300 uppercase">HAVE A PRIVATE ROOM CODE?</h4>
          <p className="text-xs text-slate-400 font-semibold">Enter your friend's room code to join their challenge instantly.</p>
        </div>

        <form onSubmit={handleJoinByCode} className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={joinCodeInput}
            onChange={(e) => setJoinCodeInput(e.target.value)}
            placeholder="e.g. HUB-8821"
            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white font-bold text-sm tracking-wider uppercase focus:outline-none focus:border-amber-400 w-full sm:w-40"
          />
          <GlassButton type="submit" className="!bg-cyan-600 hover:!bg-cyan-500 py-2 px-5 text-xs whitespace-nowrap">
            JOIN MATCH
          </GlassButton>
        </form>
      </div>

      {/* Open Match Rooms Grid */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xl font-black text-yellow-300 uppercase tracking-tight">OPEN CHALLENGE ROOMS</h3>
          <span className="text-xs font-bold text-slate-400">
            {isLoading ? 'LOADING...' : `${rooms.filter(r => r.status === 'waiting').length} WAITING`}
          </span>
        </div>

        {isLoading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-slate-400 font-semibold">Loading match rooms...</p>
            </div>
          </div>
        ) : rooms.filter(r => r.status === 'waiting').length === 0 ? (
          <div className="col-span-full text-center py-12 px-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-4xl mb-3 block">🎮</span>
            <p className="text-slate-300 font-semibold">No open challenge rooms right now.</p>
            <p className="text-xs text-slate-400 mt-1">Be the first to create one and get matched with opponents!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.filter(r => r.status === 'waiting').map((room) => {
            const isMyRoom = room.hostUser.id === user?.id;
            return (
              <div
                key={room.id}
                className={`p-5 rounded-2xl bg-slate-900/90 border transition-all flex flex-col justify-between h-48 relative overflow-hidden shadow-xl ${
                  isMyRoom ? 'border-amber-400/80 bg-amber-950/20' : 'border-slate-800 hover:border-amber-400/50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <img
                      src={room.hostUser.avatar}
                      alt={room.hostUser.username}
                      className="w-10 h-10 rounded-xl border border-amber-400/40 object-cover"
                    />
                    <div>
                      <strong className="block text-sm font-black text-white">{room.hostUser.username}</strong>
                      <span className="text-[10px] font-bold text-amber-400/80 tracking-wider">CHALLENGER</span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-black">
                    {room.stakeGc === 0 ? 'FREE' : `${room.stakeGc} GC`}
                  </span>
                </div>

                <div className="my-2 space-y-0.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{room.gameLabel}</span>
                  <div className="text-xs text-slate-300 font-semibold">Room Code: <span className="text-yellow-300 font-black">{room.roomCode}</span></div>
                </div>

                <button
                  type="button"
                  onClick={() => handleJoinRoom(room)}
                  className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 ${
                    isMyRoom
                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                      : 'bg-gradient-to-r from-red-500 to-amber-500 text-white hover:brightness-110 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                  }`}
                >
                  {isMyRoom ? 'MANAGE MY ROOM' : '⚔️ ACCEPT CHALLENGE'}
                </button>
              </div>
            );
          })}
          </div>
        )}

export default HeadToHeadLobby;
