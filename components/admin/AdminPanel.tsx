import React, { useEffect, useMemo, useState } from 'react';
import { ADULT_GAMES, UNDER18_GAMES } from '../../constants';
import { useAdminSettings } from '../../context/AdminSettingsContext';
import { useCoinSystem } from '../../context/CoinContext';
import { getSupabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface AdminPanelProps { onClose: () => void; }

interface AdminDashboard {
  totals: { players: number; events: number; uniqueVisitors: number };
  eventsByType: Record<string, number>;
  players: Array<{ id: string; displayName: string | null; status: string; createdAt: string; lastSeenAt: string | null; funCoins: number }>;
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
  const [selectedPlayer, setSelectedPlayer] = useState<AdminDashboard['players'][number] | null>(null);
  const [playerFunCoins, setPlayerFunCoins] = useState('0');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [isManagingPlayer, setIsManagingPlayer] = useState(false);
  const games = useMemo(() => [...ADULT_GAMES, ...UNDER18_GAMES], []);

  const loadDashboard = async () => {
    const { data, error: rpcError } = await getSupabase().rpc('get_admin_dashboard');
    if (rpcError) setError(rpcError.message);
    else setDashboard(data as AdminDashboard);
  };

  useEffect(() => {
    let active = true;
    void loadDashboard();
    return () => { active = false; };
  }, []);

  const saveBalances = async () => {
    const fun = Math.max(0, Number(nextFunCoins) || 0);
    const real = Math.max(0, Number(nextRealCoins) || 0);
    await setCoinBalances(fun, real);
    setNextFunCoins(String(fun));
    setNextRealCoins(String(real));
  };

  const openPlayer = (player: AdminDashboard['players'][number]) => {
    if (player.id === user?.id) return;
    setSelectedPlayer(player);
    setPlayerFunCoins(String(Math.floor(player.funCoins)));
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
    } catch (err: any) { setActionMessage(err.message || 'Account action failed.'); }
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
    } catch (err: any) { setActionMessage(err.message || 'Unable to save Fun Coins.'); }
    finally { setIsManagingPlayer(false); }
  };

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Arcade administration panel" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-panel">
        <header><div><span>ARCADE CONTROL</span><h2>Administrator Panel</h2></div><button type="button" onClick={onClose} aria-label="Close admin panel">×</button></header>
        <div className="admin-content">
          {error && <div className="admin-error">Dashboard unavailable: {error}</div>}
          <section className="admin-metrics">
            <div><span>PLAYERS</span><strong>{dashboard?.totals.players ?? '—'}</strong></div>
            <div><span>EVENTS</span><strong>{dashboard?.totals.events ?? '—'}</strong></div>
            <div><span>VISITORS</span><strong>{dashboard?.totals.uniqueVisitors ?? '—'}</strong></div>
          </section>
          <section className="admin-balance-card">
            <div><span>COIN BALANCES</span><small>Reset or assign this browser's virtual balances.</small></div>
            <label>Fun Coins<input type="number" min="0" step="1" value={nextFunCoins} onChange={(event) => setNextFunCoins(event.target.value)} /></label>
            <label>Virtual RC<input type="number" min="0" step="1" value={nextRealCoins} onChange={(event) => setNextRealCoins(event.target.value)} /></label>
            <div className="admin-balance-actions"><button type="button" onClick={() => { setNextFunCoins('1000'); setNextRealCoins('0'); setCoinBalances(1000, 0); }}>RESET DEFAULTS</button><button type="button" className="primary" onClick={saveBalances}>APPLY BALANCES</button></div>
          </section>
          <section className="admin-players-card">
            <div className="admin-section-heading"><div><span>PLAYER DIRECTORY</span><small>Visible only to database-approved administrators.</small></div></div>
            <div className="admin-player-list">
              {(dashboard?.players ?? []).map((player) => <button type="button" key={player.id} onClick={() => openPlayer(player)} disabled={player.id === user?.id}><strong>{player.displayName || 'Unnamed player'}</strong><span>{player.status} · {Math.floor(player.funCoins)} FC</span><small>{player.id === user?.id ? 'Your admin account' : new Date(player.createdAt).toLocaleDateString()}</small></button>)}
              {dashboard && dashboard.players.length === 0 && <p>No registered players yet.</p>}
            </div>
          </section>
          <section className="admin-rtp-card">
            <div className="admin-section-heading"><div><span>GAME RTP</span><small>Enter one number to fill every game, or adjust a game below.</small></div><button type="button" onClick={resetRtp}>RESET ALL</button></div>
            <div className="admin-rtp-apply"><label>RTP %<input type="number" min="0" max="200" step="1" value={allRtp} onChange={(event) => setAllRtp(event.target.value)} /></label><button type="button" onClick={() => setAllGameRtp(Number(allRtp))}>APPLY TO ALL GAMES</button></div>
            <div className="admin-rtp-list">
              {games.map((game) => <label key={game.id}><span>{game.label}<small>{game.id}</small></span><input type="number" min="0" max="200" step="1" value={rtpByGame[game.id] ?? 100} onChange={(event) => setGameRtp(game.id, Number(event.target.value))} /><b>%</b></label>)}
            </div>
          </section>
        </div>
        {selectedPlayer && <div className="admin-player-modal" role="dialog" aria-modal="true" aria-label="Manage player"><section><button type="button" className="close" onClick={() => setSelectedPlayer(null)} aria-label="Close player controls">×</button><span>PLAYER CONTROLS</span><h3>{selectedPlayer.displayName || 'Unnamed player'}</h3>{actionMessage && <p className="admin-action-message">{actionMessage}</p>}<label>Fun Coins<input type="number" min="0" max="1000000" value={playerFunCoins} onChange={(event) => setPlayerFunCoins(event.target.value)} /></label><button type="button" disabled={isManagingPlayer} onClick={savePlayerFunCoins}>SAVE FUN COINS</button><hr/><button type="button" disabled={isManagingPlayer} onClick={() => void invokePlayerAction('send_reset_email')}>SEND PASSWORD-RESET EMAIL</button><label>Temporary password<input type="password" minLength={8} value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} placeholder="At least 8 characters" /></label><button type="button" disabled={isManagingPlayer || temporaryPassword.length < 8} onClick={() => void invokePlayerAction('set_temporary_password')}>SET TEMPORARY PASSWORD</button><hr/><label className="danger-label">Type DELETE to permanently remove this account<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label><button type="button" className="danger" disabled={isManagingPlayer || deleteConfirmation !== 'DELETE'} onClick={() => void invokePlayerAction('delete_user')}>DELETE ACCOUNT</button></section></div>}
      </section>
      <style>{`
        .admin-overlay{position:fixed;z-index:1000;inset:0;display:grid;place-items:center;padding:18px;background:rgba(2,7,12,.82);backdrop-filter:blur(12px)}.admin-panel{width:min(94vw,780px);max-height:90vh;overflow:auto;border:1px solid #426078;border-radius:18px;background:linear-gradient(145deg,#122131,#08111b);box-shadow:0 30px 90px #000;color:#edf7ff}.admin-panel>header{position:sticky;z-index:2;top:0;display:flex;justify-content:space-between;align-items:center;padding:17px 19px;border-bottom:1px solid #2d465b;background:rgba(10,20,30,.96);backdrop-filter:blur(9px)}.admin-panel>header span,.admin-balance-card>div>span,.admin-section-heading span,.admin-metrics span,.admin-player-modal span{color:#71c5ee;font-size:8px;font-weight:950;letter-spacing:.17em}.admin-panel>header h2{margin:2px 0 0;font-size:21px}.admin-panel>header>button,.close{width:34px;height:34px;border:1px solid #3c566c;border-radius:8px;background:#142739;color:#bdd3e3;font-size:24px;cursor:pointer}.admin-content{display:grid;gap:13px;padding:15px}.admin-error,.admin-action-message{padding:10px;border:1px solid #834953;border-radius:8px;background:#35171d;color:#ffb3bc}.admin-action-message{border-color:#356c58;background:#133325;color:#baf0d2;font-size:11px}.admin-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.admin-metrics>div{padding:14px;border:1px solid #2d4659;border-radius:10px;background:#0a1722}.admin-metrics strong{display:block;margin-top:4px;font-size:25px}.admin-balance-card,.admin-rtp-card,.admin-players-card{padding:14px;border:1px solid #2d4659;border-radius:12px;background:#0a1722}.admin-balance-card{display:grid;grid-template-columns:1fr 1fr;gap:11px}.admin-balance-card>div:first-child{grid-column:1/-1}.admin-balance-card small,.admin-section-heading small{display:block;margin-top:3px;color:#7890a2;font-size:9px}.admin-balance-card label,.admin-player-modal label{display:grid;gap:5px;color:#9bb1c0;font-size:10px;font-weight:850}.admin-balance-card input,.admin-rtp-list input,.admin-rtp-apply input,.admin-player-modal input{min-width:0;padding:9px;border:1px solid #334e62;border-radius:7px;outline:none;background:#06101a;color:white}.admin-balance-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px}.admin-balance-actions button,.admin-section-heading button,.admin-rtp-apply button,.admin-player-modal button{padding:10px 14px;border:1px solid #47677e;border-radius:8px;background:#132a3c;color:#d9effd;font-weight:900;cursor:pointer}.admin-balance-actions button.primary{border-color:#7ec5e8;background:#8fd2f2;color:#102331}.admin-section-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:11px}.admin-section-heading button{padding:7px 10px;color:#f1b4ba;border-color:#70434a;background:#341b22;font-size:9px}.admin-player-list{display:grid;gap:6px}.admin-player-list>button{display:grid;grid-template-columns:1fr auto auto;gap:12px;padding:9px;border:1px solid #233a4c;border-radius:7px;background:#08131d;color:#dceafa;text-align:left;font-size:10px;cursor:pointer}.admin-player-list>button:not(:disabled):hover{border-color:#71c5ee}.admin-player-list>button:disabled{opacity:.6;cursor:default}.admin-player-list span{color:#79d1a5}.admin-player-list small{color:#7890a2}.admin-rtp-apply{display:grid;grid-template-columns:90px 1fr;gap:8px;margin:0 0 10px}.admin-rtp-apply label{display:grid;gap:4px;color:#9bb1c0;font-size:9px;font-weight:900}.admin-rtp-list{display:grid;grid-template-columns:1fr 1fr;gap:7px}.admin-rtp-list label{display:grid;grid-template-columns:1fr 70px 15px;align-items:center;gap:6px;padding:7px;border:1px solid #233a4c;border-radius:7px;background:#08131d;color:#d2e0e9;font-size:10px}.admin-rtp-list label>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:850}.admin-rtp-list label small{display:block;color:#5e788c;font-size:7px}.admin-rtp-list input{text-align:right}.admin-rtp-list b{color:#7791a3}.admin-player-modal{position:absolute;z-index:4;inset:0;display:grid;place-items:center;padding:15px;background:rgba(0,0,0,.68);backdrop-filter:blur(4px)}.admin-player-modal section{position:relative;display:grid;gap:10px;width:min(100%,390px);padding:20px;border:1px solid #48677d;border-radius:13px;background:#0b1823;box-shadow:0 20px 50px #000}.admin-player-modal h3{margin:0}.admin-player-modal .close{position:absolute;right:12px;top:12px}.admin-player-modal hr{width:100%;border:0;border-top:1px solid #2b465a}.admin-player-modal .danger-label{color:#ffafb6}.admin-player-modal button.danger{border-color:#87434d;background:#4b2027;color:#ffd4d7}.admin-player-modal button:disabled{opacity:.5;cursor:not-allowed}@media(max-width:560px){.admin-rtp-list,.admin-metrics{grid-template-columns:1fr}.admin-balance-card{grid-template-columns:1fr}.admin-balance-card>div:first-child,.admin-balance-actions{grid-column:1}.admin-balance-actions{flex-direction:column}.admin-content{padding:9px}.admin-player-list>button{grid-template-columns:1fr auto}.admin-player-list small{grid-column:1/-1}.admin-rtp-apply{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
};

export default AdminPanel;
