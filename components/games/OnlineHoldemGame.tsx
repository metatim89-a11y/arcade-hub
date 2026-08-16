import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { PokerTable3D } from './CardGames3D';
import { resolveBlindPositions } from '../../lib/holdemPositions';

type Card = { r: number; s: string } | null;
type Player = { id: string; name: string; seat: number; stack: number; bet: number; total: number; folded: boolean; allIn: boolean; hand: Card[]; bot: boolean };
type GameState = { phase: string; board: Card[]; players: Player[]; dealer: number; actor: number; currentBet: number; pot: number; message: string; hand: number; smallBlind: number; bigBlind: number; smallBlindSeat?: number; bigBlindSeat?: number; buyIn: number };

const ranks: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const suits: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

const OnlineHoldemGame: React.FC<{ tableId: string; userId: string; onLeave: () => void }> = ({ tableId, userId, onLeave }) => {
  const [state, setState] = useState<GameState | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [animating, setAnimating] = useState(false);
  const previousRef = useRef<{ hand: number; board: number; actor: number } | null>(null);
  const versionRef = useRef(0);
  const refreshTimerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await getSupabase().functions.invoke('holdem-game', { body: { tableId, action: 'state' } });
    if (error || data?.error) throw new Error(data?.error || error?.message);
    const nextVersion = Number(data.version ?? 0);
    if (nextVersion < versionRef.current) return;
    setState(data.state); setVersion(nextVersion); versionRef.current = nextVersion;
  }, [tableId]);

  useEffect(() => {
    void load().catch((loadError) => setError(loadError.message));
    const db = getSupabase();
    const channel = db.channel(`holdem-game-${tableId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'holdem_game_snapshots', filter: `table_id=eq.${tableId}` }, (payload) => {
      const nextVersion = Number((payload.new as { version?: number } | null)?.version ?? 0);
      if (nextVersion && nextVersion <= versionRef.current) return;
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => void load(), 45);
    }).subscribe();
    return () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      void db.removeChannel(channel);
    };
  }, [load, tableId]);

  useEffect(() => {
    if (!state) return;
    const previous = previousRef.current;
    const changed = !previous || previous.hand !== state.hand || previous.board !== state.board.length || previous.actor !== state.actor;
    previousRef.current = { hand: state.hand, board: state.board.length, actor: state.actor };
    if (!changed) return;
    setAnimating(true);
    const duration = !previous || previous.hand !== state.hand ? 1150 : previous.board !== state.board.length ? 760 : 360;
    const timer = window.setTimeout(() => setAnimating(false), duration);
    return () => window.clearTimeout(timer);
  }, [state?.actor, state?.board.length, state?.hand]);

  const act = async (action: string, raiseTo?: number) => {
    setBusy(true); setError('');
    try {
      const { data, error } = await getSupabase().functions.invoke('holdem-game', { body: { tableId, action, raiseTo, expectedVersion: version } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const nextVersion = Number(data.version ?? 0);
      if (nextVersion < versionRef.current) return;
      setState(data.state); setVersion(nextVersion); versionRef.current = nextVersion;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action failed');
      void load();
    } finally { setBusy(false); }
  };

  if (!state) return <div className="online-loading">{error || 'Connecting to table…'} <button onClick={onLeave}>BACK</button></div>;

  const me = state.players.find((player) => player.id === userId);
  const actor = state.players[state.actor];
  const myTurn = actor?.id === userId;
  const call = Math.max(0, state.currentBet - (me?.bet || 0));
  const { smallBlindSeat: sbIndex, bigBlindSeat: bbIndex } = resolveBlindPositions(state.players, state.dealer, state.smallBlindSeat, state.bigBlindSeat);
  const tablePlayers = state.players.map((player) => ({
    id: player.id,
    hand: player.hand.map((card, index) => ({ id: `${state.hand}-${player.id}-${index}`, rank: card ? ranks[card.r] || String(card.r) : '', suit: card ? suits[card.s] || card.s : '' })),
    isHuman: player.id === userId,
    folded: player.folded,
    bet: player.bet,
  }));
  const tableBoard = state.board.filter((card): card is NonNullable<Card> => Boolean(card)).map((card, index) => ({ id: `${state.hand}-board-${index}`, rank: ranks[card.r] || String(card.r), suit: suits[card.s] || card.s }));

  return (
    <section className="online-table-game canonical-holdem-hud">
      <header className="canonical-header">
        <button onClick={onLeave}>← LOBBY</button>
        <div><small>TABLE CHIPS</small><b>HOLD’EM</b></div>
        <div className="canonical-meta"><span>HAND {state.hand}</span><span>{state.phase}</span><span>POT {state.pot}</span></div>
      </header>
      <div className="online-room">
        <div className="online-felt">
          <div className="online-table-3d"><PokerTable3D players={tablePlayers} community={tableBoard} showdown={state.phase === 'SHOWDOWN'} activeIndex={state.actor} dealerIndex={state.dealer} /></div>
          <div className="online-board"><small>TOTAL POT</small><h2 key={`pot-${state.pot}`} className="pot-pop">{state.pot}</h2><p key={`message-${version}`}>{state.message}</p></div>
          {state.players.map((player, index) => (
            <div key={player.id} className={`online-seat seat-${index}${index === state.actor ? ' acting' : ''}${player.folded ? ' folded' : ''}`}>
              {index === state.actor && <i key={`turn-${version}-${index}`} className="turn-marker">{player.id === userId ? 'YOUR TURN' : `${player.name}’S TURN`}</i>}
              <div className="canonical-seat-info"><b>{player.name}</b><strong>{player.stack}</strong><span>{player.bot ? 'CPU' : 'PLAYER'}</span></div>
              <div className="canonical-badges">
                {index === state.dealer && <em className="position-token dealer-token">D</em>}
                {index === sbIndex && <em className="position-token sb-token">SB</em>}
                {index === bbIndex && <em className="position-token bb-token">BB</em>}
                {player.bet > 0 && <i key={`bet-${version}-${player.bet}`} className="bet-flight">{player.bet}</i>}
                {player.bet > 0 && <em>BET {player.bet}</em>}{player.allIn && <em>ALL IN</em>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {error && <div className="online-error">{error}</div>}
      <footer className="canonical-controls">
        {animating && state.phase !== 'SHOWDOWN' ? <span className="dealing-status">Dealing…</span> : state.phase === 'SHOWDOWN' ? <>
          {me && me.stack < state.bigBlind && <button disabled={busy} onClick={() => act('buy-in')}>BUY IN {state.buyIn}</button>}
          <button disabled={busy} onClick={() => act('next')}>DEAL NEXT HAND</button>
        </> : myTurn ? <>
          <button className="fold-button" disabled={busy || animating} onClick={() => act('fold')}>FOLD</button>
          <button className="call-button" disabled={busy || animating} onClick={() => act(call ? 'call' : 'check')}>{call ? `CALL ${call}` : 'CHECK'}</button>
          <button className="raise-button" disabled={busy || animating} onClick={() => act('raise', state.currentBet + state.bigBlind)}>RAISE TO {state.currentBet + state.bigBlind}</button>
          <button className="allin-button" disabled={busy || animating} onClick={() => act('all-in')}>ALL IN {me?.stack ?? ''}</button>
        </> : <span>{actor?.name || 'Server'} is thinking…</span>}
      </footer>
      <style>{`
        .online-table-game{width:min(100%,1160px);margin:auto;padding:16px;border:1px solid #40584c;border-radius:20px;background:linear-gradient(150deg,#111b18,#18251f);box-shadow:0 26px 75px #0007;color:#edf4f0}.canonical-header,.canonical-controls{display:flex;justify-content:center;align-items:center;gap:10px;padding:12px}.canonical-header{justify-content:space-between}.canonical-header>div:nth-child(2){display:grid}.canonical-header small{color:#c9a747;font-size:8px;font-weight:900;letter-spacing:.18em}.canonical-header b{font-size:23px}.canonical-meta{display:flex!important;gap:7px}.canonical-meta span{padding:5px 7px;border:1px solid #385346;border-radius:5px;background:#102018;color:#91a79a;font-size:9px;font-weight:850}.online-table-game button{padding:10px 14px;border:0;border-radius:8px;background:#33483e;color:white;font-weight:900}.online-table-game button:disabled{opacity:.45}.online-room{padding:12px;border:1px solid #483c2a;border-radius:18px;background:radial-gradient(circle,#3d3021,#16120d)}.online-felt{position:relative;height:680px;border:12px solid #5d3e25;border-radius:42%;background:#07150e;box-shadow:inset 0 0 0 4px #b58a42;overflow:hidden}.online-table-3d{position:absolute;z-index:1;inset:0}.online-board{position:absolute;z-index:3;inset:43% 15% auto;text-align:center;pointer-events:none}.online-board h2{margin:2px;color:#edc65e}.online-board p{padding:6px;border-radius:14px;background:#082216dd;animation:message-in .3s ease-out}.online-seat{position:absolute;z-index:4;display:grid;justify-items:center;width:158px;border:1px solid #486456;border-radius:10px;background:linear-gradient(#1a3026e8,#0d1d16e8);box-shadow:0 7px 14px #0006;transition:opacity .25s,filter .25s,border-color .25s,box-shadow .25s}.canonical-seat-info{display:grid;width:100%;padding:7px 10px}.canonical-seat-info strong{color:#edc65e;font-size:15px}.canonical-seat-info span{color:#718b7c;font-size:7px;font-weight:900}.canonical-badges{display:flex;align-items:center;min-height:23px;padding:0 5px 5px}.canonical-badges>em:not(.position-token){padding:3px 5px;border-radius:4px;background:#d1a73c;color:#231a08;font-size:7px;font-style:normal;font-weight:950}.online-seat.acting{border-color:#edc65e;box-shadow:0 0 24px #edc65e88;animation:seat-breathe 1.1s ease-in-out infinite}.online-seat.folded{opacity:.45}.turn-marker{position:absolute;left:50%;top:-8px;transform:translate(-50%,-100%);padding:4px 8px;border-radius:12px;background:#edc65e;color:#201704;font-size:8px;font-style:normal;font-weight:950;white-space:nowrap;animation:turn-arrive .36s cubic-bezier(.2,.9,.3,1.3)}.position-token{display:inline-grid;place-items:center;width:23px;height:23px;margin:0 2px;border:2px solid #999;border-radius:50%;background:white;color:#222;font-size:7px;font-style:normal;font-weight:950;animation:token-roll .45s ease-out}.sb-token{border-color:#55bde6;background:#d9f5ff;color:#07516d}.bb-token{border-color:#e2b33e;background:#fff1bb;color:#624500}.bet-flight{position:absolute;left:50%;top:45%;padding:4px 6px;border-radius:50%;background:#e4b83f;color:#221906;font-style:normal;font-weight:950;animation:chips-to-pot .65s ease-in both}.pot-pop{animation:pot-pop .35s ease-out}.seat-0{bottom:3%;left:50%;transform:translateX(-50%)}.seat-1{left:2%;top:50%;transform:translateY(-50%)}.seat-2{top:3%;left:50%;transform:translateX(-50%)}.seat-3{right:2%;top:50%;transform:translateY(-50%)}.online-error{padding:9px;background:#702f38;text-align:center}.canonical-controls{min-height:62px}.canonical-controls .fold-button{background:#9f3541}.canonical-controls .call-button{background:#258257}.canonical-controls .raise-button{background:#b58225}.canonical-controls .allin-button{background:#6e3ca1}.dealing-status{color:#edc65e;font-weight:900;letter-spacing:.08em;animation:status-pulse .65s infinite alternate}@keyframes turn-arrive{from{opacity:0;transform:translate(-50%,-160%) scale(.45)}}@keyframes seat-breathe{50%{box-shadow:0 0 34px #edc65eaa}}@keyframes chips-to-pot{to{opacity:0;transform:translateY(-120px) scale(.6)}}@keyframes token-roll{from{opacity:0;transform:translateX(18px) rotate(160deg) scale(.5)}}@keyframes pot-pop{50%{transform:scale(1.18)}}@keyframes message-in{from{opacity:0;transform:translateY(8px)}}@keyframes status-pulse{to{opacity:.45}}@media(max-width:520px){.online-table-game{padding:8px}.canonical-header{display:grid;grid-template-columns:auto 1fr;gap:8px;padding:8px}.canonical-header>button{font-size:9px;padding:8px 10px}.canonical-header>div:nth-child(2){justify-self:end}.canonical-header>div:nth-child(2) small{display:none}.canonical-header>div:nth-child(2) b{font-size:18px}.canonical-meta{grid-column:1/-1;display:grid!important;grid-template-columns:repeat(3,1fr);width:100%;gap:5px}.canonical-meta span{padding:6px 4px;text-align:center}.online-room{padding:6px}.online-felt{height:680px;border-width:9px;border-radius:34%}.online-seat{width:112px}.online-board{top:48%;left:3%;right:3%}.online-board p{max-width:260px;margin:8px auto;font-size:10px}.seat-2{top:3%}.seat-1{left:3%;top:35%}.seat-3{right:3%;top:35%}.seat-0{bottom:3%}.canonical-seat-info{padding:6px 8px}.canonical-seat-info b{font-size:10px}.canonical-seat-info strong{font-size:13px}.canonical-badges{min-height:20px}.position-token{width:20px;height:20px}.canonical-controls{flex-wrap:wrap;padding:10px 4px}.canonical-controls button{min-width:44%;font-size:10px}}@media(max-width:380px){.online-felt{height:720px}.online-seat{width:102px}.seat-1{left:1%}.seat-3{right:1%}}@media(prefers-reduced-motion:reduce){.online-seat.acting,.turn-marker,.position-token,.bet-flight,.pot-pop,.online-board p,.dealing-status{animation:none!important}.online-seat{transition:none}}
      `}</style>
    </section>
  );
};

export default OnlineHoldemGame;
