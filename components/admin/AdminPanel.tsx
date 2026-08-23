import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ADULT_GAMES, UNDER18_GAMES } from '../../constants';
import { useAdminSettings } from '../../context/AdminSettingsContext';
import { useCoinSystem } from '../../context/CoinContext';
import { getSupabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface AdminPanelProps { onClose: () => void; }

interface AdminPlayer {
  id: string;
  displayName: string | null;
  email?: string | null;
  status: string;
  createdAt: string;
  lastSeenAt: string | null;
  funCoins: number;
  tickets: number;
}

interface AdminDashboard {
  totals: { players: number; events: number; uniqueVisitors: number };
  eventsByType: Record<string, number>;
  gameActivity: { gameId: string; launches: number }[];
  recentEvents: { eventType: string; gameId: string | null; createdAt: string }[];
  players: AdminPlayer[];
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const { funCoins, realCoins, setCoinBalances } = useCoinSystem();
  const { rtpByGame, setGameRtp, setAllGameRtp, resetRtp } = useAdminSettings();
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState('');
  const [nextFunCoins, setNextFunCoins] = useState(String(Math.floor(funCoins)));
  const [nextRealCoins, setNextRealCoins] = useState(String(Math.floor(realCoins)));
  const [allRtp, setAllRtp] = useState('100');
  const [selectedPlayer, setSelectedPlayer] = useState<AdminPlayer | null>(null);
  const [playerFunCoins, setPlayerFunCoins] = useState('0');
  const [playerTickets, setPlayerTickets] = useState('0');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [isManagingPlayer, setIsManagingPlayer] = useState(false);
  const games = useMemo(() => [...ADULT_GAMES, ...UNDER18_GAMES], []);

  const loadDashboard = async () => {
    setError('');
    try {
      const { data, error: rpcError } = await getSupabase().rpc('get_admin_dashboard');
      if (rpcError) throw rpcError;
      if (data) setDashboard(data as AdminDashboard);
    } catch (err: any) {
      setError(err?.message || 'Unable to load administrator dashboard.');
    }
  };

  useEffect(() => {
    void loadDashboard();
    const refreshTimer = window.setInterval(() => void loadDashboard(), 20_000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const saveBalances = async () => {
    const fun = Math.max(0, Number(nextFunCoins) || 0);
    const real = Math.max(0, Number(nextRealCoins) || 0);
    await setCoinBalances(fun, real);
    setNextFunCoins(String(fun));
    setNextRealCoins(String(real));
  };

  const openPlayer = (player: AdminPlayer) => {
    if (player.id === user?.id) return;
    setSelectedPlayer(player);
    setPlayerFunCoins(String(Math.floor(player.funCoins || 0)));
    setPlayerTickets(String(Math.floor(player.tickets || 0)));
    setTemporaryPassword('');
    setDeleteConfirmation('');
    setActionMessage('');
  };

  const invokePlayerAction = async (action: 'send_reset_email' | 'set_temporary_password' | 'delete_user') => {
    if (!selectedPlayer) return;
    setActionMessage('');
    setIsManagingPlayer(true);
    try {
      const { data, error: functionError } = await getSupabase().functions.invoke('admin-user-management', { body: { action, userId: selectedPlayer.id, temporaryPassword } });
      if (functionError) throw functionError;
      if (data?.error) throw new Error(data.error);
      if (action === 'delete_user') { setSelectedPlayer(null); await loadDashboard(); }
      else setActionMessage(action === 'send_reset_email' ? 'Password-reset email sent.' : 'Temporary password saved.');
    } catch (err: any) { setActionMessage(err?.message || 'Account action failed.'); }
    finally { setIsManagingPlayer(false); }
  };

  const savePlayerFunCoins = async () => {
    if (!selectedPlayer) return;
    setActionMessage('');
    setIsManagingPlayer(true);
    try {
      const amount = Math.max(0, Number(playerFunCoins) || 0);
      const { error: rpcError } = await getSupabase().rpc('set_admin_player_fun_coins', { p_user_id: selectedPlayer.id, p_fun_coins: amount });
      if (rpcError) throw rpcError;
      setActionMessage('Fun Coin balance saved.');
      await loadDashboard();
    } catch (err: any) { setActionMessage(err?.message || 'Unable to save Fun Coins.'); }
    finally { setIsManagingPlayer(false); }
  };

  const savePlayerTickets = async () => {
    if (!selectedPlayer) return;
    setActionMessage('');
    setIsManagingPlayer(true);
    try {
      const amount = Math.max(0, Math.floor(Number(playerTickets) || 0));
      const { error: rpcError } = await getSupabase().rpc('set_admin_player_tickets', { p_user_id: selectedPlayer.id, p_tickets: amount });
      if (rpcError) throw rpcError;
      setActionMessage(`Ticket balance saved at ${amount.toLocaleString()}.`);
      await loadDashboard();
    } catch (err: any) { setActionMessage(err?.message || 'Unable to save tickets.'); }
    finally { setIsManagingPlayer(false); }
  };

  const eventCount = (eventType: string) => dashboard?.eventsByType[eventType] ?? 0;
  const gameLaunches = eventCount('game_opened');
  const completedGames = eventCount('game_completed');
  const completionRate = gameLaunches ? Math.round((completedGames / gameLaunches) * 100) : 0;
  const gameLabels = Object.fromEntries(games.map((game) => [game.id, game.label]));
  const formatEvent = (event: AdminDashboard['recentEvents'][number]) => `${event.eventType.replaceAll('_', ' ')}${event.gameId ? ` · ${gameLabels[event.gameId] || event.gameId}` : ''}`;

  return createPortal((
    <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Arcade administration panel" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-panel">
        <header><div><span>ARCADE CONTROL</span><h2>Administrator Panel</h2></div><button type="button" onClick={onClose} aria-label="Close admin panel">×</button></header>
        <div className="admin-content">
          {error && <div className="admin-error">Dashboard unavailable: {error}</div>}
          <section className="admin-metrics"><div><span>PLAYERS</span><strong>{dashboard?.totals.players ?? '—'}</strong></div><div><span>EVENTS</span><strong>{dashboard?.totals.events ?? '—'}</strong></div><div><span>VISITORS</span><strong>{dashboard?.totals.uniqueVisitors ?? '—'}</strong></div></section>
          <section className="admin-mission-card"><div className="admin-section-heading"><div><span>ARCADE MISSION CONTROL</span><small>Live activity refreshes every 20 seconds.</small></div><b className="admin-online"><i /> ONLINE</b></div><div className="admin-mission-grid"><div><strong>{gameLaunches}</strong><span>GAME LAUNCHES</span></div><div><strong>{completedGames}</strong><span>COMPLETIONS</span></div><div><strong>{completionRate}%</strong><span>FINISH RATE</span></div><div><strong>{eventCount('session_start')}</strong><span>SESSIONS</span></div></div><div className="admin-activity-track"><span style={{ width: `${Math.min(100, completionRate)}%` }} /></div><small className="admin-activity-caption">Mission progress: completed games compared with launches</small><div className="admin-monitor-columns"><div><b>HOT GAMES</b>{(dashboard?.gameActivity ?? []).map((game) => <div className="admin-hot-game" key={game.gameId}><span>{gameLabels[game.gameId] || game.gameId}</span><strong>{game.launches}</strong></div>)}{dashboard && dashboard.gameActivity.length === 0 && <small>No game launches recorded yet.</small>}</div><div><b>RECENT ACTIVITY</b><div className="admin-event-feed">{(dashboard?.recentEvents ?? []).map((event, index) => <div key={`${event.createdAt}-${index}`}><span>{formatEvent(event)}</span><small>{new Date(event.createdAt).toLocaleTimeString()}</small></div>)}{dashboard && dashboard.recentEvents.length === 0 && <small>No recent events.</small>}</div></div></div></section>
          <section className="admin-balance-card">
            <div><span>YOUR TEST BALANCES</span><small>Local admin testing balances for this browser.</small></div>
            <label>Fun Coins<input type="number" min="0" step="1" value={nextFunCoins} onChange={(event) => setNextFunCoins(event.target.value)} /></label>
            <label>Virtual RC<input type="number" min="0" step="1" value={nextRealCoins} onChange={(event) => setNextRealCoins(event.target.value)} /></label>
            <div className="admin-balance-actions"><button type="button" onClick={() => { setNextFunCoins('1000'); setNextRealCoins('0'); void setCoinBalances(1000, 0); }}>RESET DEFAULTS</button><button type="button" className="primary" onClick={() => void saveBalances()}>APPLY BALANCES</button></div>
          </section>
          <section className="admin-players-card">
            <div className="admin-section-heading"><div><span>PLAYER DIRECTORY</span><small>Select a registered player to manage Fun Coins, tickets, or account access.</small></div></div>
            <div className="admin-player-list">
              {(dashboard?.players ?? []).map((player) => <button type="button" key={player.id} onClick={() => openPlayer(player)} disabled={player.id === user?.id}><div><strong>{player.displayName || 'Unnamed player'}</strong>{player.email && <div className="admin-email">{player.email}</div>}</div><span>{Math.floor(player.funCoins || 0)} FC · 🎟 {Math.floor(player.tickets || 0)}</span><small>{player.id === user?.id ? 'Your admin account' : player.status}</small></button>)}
              {dashboard && dashboard.players.length === 0 && <p>No registered players yet.</p>}
            </div>
          </section>
          <section className="admin-rtp-card">
            <div className="admin-section-heading"><div><span>GAME RTP</span><small>Update the virtual payout tuning used by supported games.</small></div><button type="button" onClick={() => void resetRtp().catch((err) => setError(err.message))}>RESET ALL</button></div>
            <div className="admin-rtp-apply"><label>RTP %<input type="number" min="0" max="200" step="1" value={allRtp} onChange={(event) => setAllRtp(event.target.value)} /></label><button type="button" onClick={() => void setAllGameRtp(Number(allRtp)).catch((err) => setError(err.message))}>APPLY TO ALL GAMES</button></div>
            <div className="admin-rtp-list">{games.map((game) => <label key={game.id}><span>{game.label}<small>{game.id}</small></span><input type="number" min="0" max="200" step="1" value={rtpByGame[game.id] ?? 100} onChange={(event) => void setGameRtp(game.id, Number(event.target.value)).catch((err) => setError(err.message))} /><b>%</b></label>)}</div>
          </section>
        </div>
        {selectedPlayer && <div className="admin-player-modal" role="dialog" aria-modal="true" aria-label="Manage player"><section><button type="button" className="close" onClick={() => setSelectedPlayer(null)} aria-label="Close player controls">×</button><span>PLAYER CONTROLS</span><h3>{selectedPlayer.displayName || 'Unnamed player'}</h3>{selectedPlayer.email && <p className="admin-email">{selectedPlayer.email}</p>}{actionMessage && <p className="admin-action-message">{actionMessage}</p>}<div className="wallet-grid"><label>Fun Coins<input type="number" min="0" max="1000000" value={playerFunCoins} onChange={(event) => setPlayerFunCoins(event.target.value)} /></label><button type="button" disabled={isManagingPlayer} onClick={() => void savePlayerFunCoins()}>SAVE FUN COINS</button><label>Shop Tickets<input type="number" min="0" max="10000000" step="1" value={playerTickets} onChange={(event) => setPlayerTickets(event.target.value)} /></label><button type="button" className="tickets" disabled={isManagingPlayer} onClick={() => void savePlayerTickets()}>🎟 SET TICKETS</button></div><hr/><button type="button" disabled={isManagingPlayer} onClick={() => void invokePlayerAction('send_reset_email')}>SEND PASSWORD-RESET EMAIL</button><label>Temporary password<input type="password" minLength={8} value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} placeholder="At least 8 characters" /></label><button type="button" disabled={isManagingPlayer || temporaryPassword.length < 8} onClick={() => void invokePlayerAction('set_temporary_password')}>SET TEMPORARY PASSWORD</button><hr/><label className="danger-label">Type DELETE to permanently remove this account<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label><button type="button" className="danger" disabled={isManagingPlayer || deleteConfirmation !== 'DELETE'} onClick={() => void invokePlayerAction('delete_user')}>DELETE ACCOUNT</button></section></div>}
      </section>
      <style>{`
        .admin-overlay{position:fixed;z-index:1000;inset:0;display:grid;place-items:center;padding:18px;background:rgba(2,7,12,.82);backdrop-filter:blur(12px)}.admin-panel{position:relative;width:min(94vw,820px);max-height:90vh;overflow:auto;border:1px solid #426078;border-radius:18px;background:linear-gradient(145deg,#122131,#08111b);box-shadow:0 30px 90px #000;color:#edf7ff}.admin-panel>header{position:sticky;z-index:2;top:0;display:flex;justify-content:space-between;align-items:center;padding:17px 19px;border-bottom:1px solid #2d465b;background:rgba(10,20,30,.96);backdrop-filter:blur(9px)}.admin-panel>header span,.admin-balance-card>div>span,.admin-section-heading span,.admin-metrics span,.admin-player-modal span{color:#71c5ee;font-size:8px;font-weight:950;letter-spacing:.17em}.admin-panel>header h2{margin:2px 0 0;font-size:21px}.admin-panel>header>button,.close{width:34px;height:34px;border:1px solid #3c566c;border-radius:8px;background:#142739;color:#bdd3e3;font-size:24px;cursor:pointer}.admin-content{display:grid;gap:13px;padding:15px}.admin-error,.admin-action-message{padding:10px;border:1px solid #834953;border-radius:8px;background:#35171d;color:#ffb3bc}.admin-action-message{border-color:#356c58;background:#133325;color:#baf0d2;font-size:11px}.admin-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.admin-metrics>div{padding:14px;border:1px solid #2d4659;border-radius:10px;background:#0a1722}.admin-metrics strong{display:block;margin-top:4px;font-size:25px}.admin-balance-card,.admin-rtp-card,.admin-players-card{padding:14px;border:1px solid #2d4659;border-radius:12px;background:#0a1722}.admin-balance-card{display:grid;grid-template-columns:1fr 1fr;gap:11px}.admin-balance-card>div:first-child{grid-column:1/-1}.admin-balance-card small,.admin-section-heading small{display:block;margin-top:3px;color:#7890a2;font-size:9px}.admin-balance-card label,.admin-player-modal label{display:grid;gap:5px;color:#9bb1c0;font-size:10px;font-weight:850}.admin-balance-card input,.admin-rtp-list input,.admin-rtp-apply input,.admin-player-modal input{min-width:0;padding:9px;border:1px solid #334e62;border-radius:7px;outline:none;background:#06101a;color:white}.admin-balance-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px}.admin-balance-actions button,.admin-section-heading button,.admin-rtp-apply button,.admin-player-modal button{padding:10px 14px;border:1px solid #47677e;border-radius:8px;background:#132a3c;color:#d9effd;font-weight:900;cursor:pointer}.admin-balance-actions button.primary{border-color:#7ec5e8;background:#8fd2f2;color:#102331}.admin-section-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:11px}.admin-section-heading button{padding:7px 10px;color:#f1b4ba;border-color:#70434a;background:#341b22;font-size:9px}.admin-player-list{display:grid;gap:6px}.admin-player-list>button{display:grid;grid-template-columns:1fr auto auto;gap:12px;padding:10px;border:1px solid #233a4c;border-radius:7px;background:#08131d;color:#dceafa;text-align:left;font-size:10px;cursor:pointer}.admin-player-list>button:not(:disabled):hover{border-color:#71c5ee}.admin-player-list>button:disabled{opacity:.6;cursor:default}.admin-player-list span{color:#79d1a5}.admin-player-list small{color:#7890a2}.admin-email{color:#71c5ee;font-size:9px;font-family:monospace;margin-top:2px}.admin-rtp-apply{display:grid;grid-template-columns:90px 1fr;gap:8px;margin:0 0 10px}.admin-rtp-apply label{display:grid;gap:4px;color:#9bb1c0;font-size:9px;font-weight:900}.admin-rtp-list{display:grid;grid-template-columns:1fr 1fr;gap:7px}.admin-rtp-list label{display:grid;grid-template-columns:1fr 70px 15px;align-items:center;gap:6px;padding:7px;border:1px solid #233a4c;border-radius:7px;background:#08131d;color:#d2e0e9;font-size:10px}.admin-rtp-list label small{display:block;color:#5e788c;font-size:7px}.admin-player-modal{position:absolute;z-index:4;inset:0;display:grid;place-items:center;padding:15px;background:rgba(0,0,0,.68);backdrop-filter:blur(4px)}.admin-player-modal section{position:relative;display:grid;gap:10px;width:min(100%,430px);padding:20px;border:1px solid #48677d;border-radius:13px;background:#0b1823;box-shadow:0 20px 50px #000}.admin-player-modal h3{margin:0}.admin-player-modal .close{position:absolute;right:12px;top:12px}.admin-player-modal hr{width:100%;border:0;border-top:1px solid #2b465a}.admin-player-modal .danger-label{color:#ffafb6}.admin-player-modal button.danger{border-color:#87434d;background:#4b2027;color:#ffd4d7}.admin-player-modal button.tickets{border-color:#38bdf8;background:#12384b;color:#d7f4ff}.admin-player-modal button:disabled{opacity:.5;cursor:not-allowed}.wallet-grid{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}@media(max-width:560px){.admin-rtp-list,.admin-metrics{grid-template-columns:1fr}.admin-balance-card{grid-template-columns:1fr}.admin-balance-card>div:first-child,.admin-balance-actions{grid-column:1}.admin-balance-actions{flex-direction:column}.admin-content{padding:9px}.admin-player-list>button{grid-template-columns:1fr auto}.admin-player-list small{grid-column:1/-1}.admin-rtp-apply,.wallet-grid{grid-template-columns:1fr}}
      `}</style>
      <style>{`
        .admin-overlay{z-index:2147483000}.admin-panel{isolation:isolate;width:min(94vw,820px);max-width:100%;max-height:min(90vh,920px)}.admin-mission-card{padding:14px;border:1px solid #287d91;border-radius:12px;background:linear-gradient(135deg,#0b2532,#0a1722);box-shadow:inset 0 0 25px #0bc3dd12}.admin-mission-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.admin-mission-grid div{padding:10px;border:1px solid #24546a;border-radius:8px;background:#071923;text-align:center}.admin-mission-grid strong{display:block;color:#f6d365;font-size:21px}.admin-mission-grid span{display:block;margin-top:3px;color:#7899a8;font-size:8px;font-weight:900;letter-spacing:.1em}.admin-online{display:flex;align-items:center;gap:5px;color:#70e1a7;font-size:9px;letter-spacing:.12em}.admin-online i{width:7px;height:7px;border-radius:50%;background:#55e39c;box-shadow:0 0 10px #55e39c;animation:admin-pulse 1.4s infinite}.admin-activity-track{height:7px;margin-top:13px;overflow:hidden;border-radius:99px;background:#061018}.admin-activity-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#39c6d8,#61e3a0);transition:width .3s}.admin-activity-caption{display:block;margin-top:6px;color:#7890a2;font-size:9px}.admin-monitor-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.admin-monitor-columns>b,.admin-monitor-columns>div>b{display:block;color:#71c5ee;font-size:8px;letter-spacing:.14em}.admin-hot-game,.admin-event-feed>div{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid #1b3b4d;color:#c4dbe5;font-size:10px}.admin-hot-game strong{color:#f6d365}.admin-event-feed{max-height:150px;overflow:auto}.admin-event-feed small,.admin-monitor-columns>div>small{color:#7890a2;font-size:8px}@keyframes admin-pulse{50%{opacity:.45;transform:scale(.75)}}
        @media(max-width:560px){.admin-overlay{padding:8px}.admin-panel{width:100%;max-height:94vh;border-radius:12px}.admin-content{padding:10px;gap:10px}.admin-metrics{grid-template-columns:1fr 1fr}.admin-metrics>div:last-child{grid-column:1/-1}.admin-mission-grid{grid-template-columns:1fr 1fr}.admin-monitor-columns{grid-template-columns:1fr}.admin-balance-card{grid-template-columns:1fr}.admin-balance-card>div:first-child,.admin-balance-actions{grid-column:1}.admin-rtp-apply{align-items:stretch;flex-direction:column}.admin-player-modal{padding:8px}.admin-player-modal>section{width:100%;padding:14px}.wallet-grid{grid-template-columns:1fr}.admin-player-list>button{grid-template-columns:1fr}.admin-player-list>button>span{margin-top:4px}}
      `}</style>
    </div>
  ), document.body);
};

export default AdminPanel;
