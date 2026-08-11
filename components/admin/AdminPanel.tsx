import React, { useMemo, useState } from 'react';
import { ADULT_GAMES, UNDER18_GAMES } from '../../constants';
import { useAdminSettings } from '../../context/AdminSettingsContext';
import { useCoinSystem } from '../../context/CoinContext';

interface AdminPanelProps {
  onClose: () => void;
}

const ADMIN_PIN = String(import.meta.env.VITE_ADMIN_PIN || '0415');

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const { funCoins, realCoins, setCoinBalances } = useCoinSystem();
  const { rtpByGame, setGameRtp, resetRtp } = useAdminSettings();
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [nextFunCoins, setNextFunCoins] = useState(String(Math.floor(funCoins)));
  const [nextRealCoins, setNextRealCoins] = useState(String(Math.floor(realCoins)));
  const games = useMemo(() => [...ADULT_GAMES, ...UNDER18_GAMES], []);

  const unlock = (event: React.FormEvent) => {
    event.preventDefault();
    if (pin !== ADMIN_PIN) {
      setError('Incorrect admin PIN.');
      setPin('');
      return;
    }
    setUnlocked(true);
    setError('');
  };

  const saveBalances = () => {
    const fun = Math.max(0, Number(nextFunCoins) || 0);
    const real = Math.max(0, Number(nextRealCoins) || 0);
    setCoinBalances(fun, real);
    setNextFunCoins(String(fun));
    setNextRealCoins(String(real));
  };

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Secret Arcade administration panel" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-panel">
        <header><div><span>ARCADE CONTROL</span><h2>{unlocked ? 'Administrator Panel' : 'Restricted Access'}</h2></div><button type="button" onClick={onClose} aria-label="Close admin panel">×</button></header>
        {!unlocked ? (
          <form className="admin-login" onSubmit={unlock}>
            <div className="admin-lock">◆</div>
            <p>Enter the administrator PIN.</p>
            <input type="password" inputMode="numeric" autoFocus value={pin} onChange={(event) => setPin(event.target.value)} placeholder="PIN" aria-label="Administrator PIN" />
            {error && <small>{error}</small>}
            <button type="submit">UNLOCK</button>
          </form>
        ) : (
          <div className="admin-content">
            <section className="admin-balance-card">
              <div><span>COIN BALANCES</span><small>Reset or assign the current browser’s balances.</small></div>
              <label>Fun Coins<input type="number" min="0" step="1" value={nextFunCoins} onChange={(event) => setNextFunCoins(event.target.value)} /></label>
              <label>Virtual RC<input type="number" min="0" step="1" value={nextRealCoins} onChange={(event) => setNextRealCoins(event.target.value)} /></label>
              <div className="admin-balance-actions"><button type="button" onClick={() => { setNextFunCoins('1000'); setNextRealCoins('0'); setCoinBalances(1000, 0); }}>RESET DEFAULTS</button><button type="button" className="primary" onClick={saveBalances}>APPLY BALANCES</button></div>
            </section>
            <section className="admin-rtp-card">
              <div className="admin-section-heading"><div><span>GAME RTP</span><small>100% preserves the game’s normal payout table.</small></div><button type="button" onClick={resetRtp}>RESET ALL</button></div>
              <div className="admin-rtp-list">
                {games.map((game) => (
                  <label key={game.id}><span>{game.label}<small>{game.id}</small></span><input type="number" min="0" max="200" step="1" value={rtpByGame[game.id] ?? 100} onChange={(event) => setGameRtp(game.id, Number(event.target.value))} /><b>%</b></label>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
      <style>{`
        .admin-overlay{position:fixed;z-index:1000;inset:0;display:grid;place-items:center;padding:18px;background:rgba(2,7,12,.82);backdrop-filter:blur(12px)}.admin-panel{width:min(94vw,760px);max-height:90vh;overflow:auto;border:1px solid #426078;border-radius:18px;background:linear-gradient(145deg,#122131,#08111b);box-shadow:0 30px 90px #000;color:#edf7ff}.admin-panel>header{position:sticky;z-index:2;top:0;display:flex;justify-content:space-between;align-items:center;padding:17px 19px;border-bottom:1px solid #2d465b;background:rgba(10,20,30,.96);backdrop-filter:blur(9px)}.admin-panel>header span,.admin-balance-card>div>span,.admin-section-heading span{color:#71c5ee;font-size:8px;font-weight:950;letter-spacing:.17em}.admin-panel>header h2{margin:2px 0 0;font-size:21px}.admin-panel>header>button{width:34px;height:34px;border:1px solid #3c566c;border-radius:8px;background:#142739;color:#bdd3e3;font-size:24px;cursor:pointer}.admin-login{display:flex;flex-direction:column;align-items:center;gap:12px;padding:42px 20px}.admin-lock{display:grid;place-items:center;width:62px;height:62px;border:1px solid #52728a;border-radius:50%;background:#142a3d;color:#7cd5ff;font-size:24px;box-shadow:0 0 25px rgba(76,188,238,.18)}.admin-login p{margin:2px;color:#8da4b5}.admin-login input{width:min(100%,260px);padding:13px;border:1px solid #3b586e;border-radius:8px;outline:none;background:#07111a;color:white;text-align:center;font-size:19px;letter-spacing:.25em}.admin-login small{color:#ff8290}.admin-login button,.admin-balance-actions button,.admin-section-heading button{padding:10px 14px;border:1px solid #47677e;border-radius:8px;background:#132a3c;color:#d9effd;font-weight:900;cursor:pointer}.admin-login button{width:min(100%,260px);border-color:#8bc8e7;background:#9ed7f3;color:#102331}.admin-content{display:grid;gap:13px;padding:15px}.admin-balance-card,.admin-rtp-card{padding:14px;border:1px solid #2d4659;border-radius:12px;background:#0a1722}.admin-balance-card{display:grid;grid-template-columns:1fr 1fr;gap:11px}.admin-balance-card>div:first-child{grid-column:1/-1}.admin-balance-card small,.admin-section-heading small{display:block;margin-top:3px;color:#7890a2;font-size:9px}.admin-balance-card label{display:grid;gap:5px;color:#9bb1c0;font-size:10px;font-weight:850}.admin-balance-card input,.admin-rtp-list input{min-width:0;padding:9px;border:1px solid #334e62;border-radius:7px;outline:none;background:#06101a;color:white}.admin-balance-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px}.admin-balance-actions button.primary{border-color:#7ec5e8;background:#8fd2f2;color:#102331}.admin-section-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:11px}.admin-section-heading button{padding:7px 10px;color:#f1b4ba;border-color:#70434a;background:#341b22;font-size:9px}.admin-rtp-list{display:grid;grid-template-columns:1fr 1fr;gap:7px}.admin-rtp-list label{display:grid;grid-template-columns:1fr 70px 15px;align-items:center;gap:6px;padding:7px;border:1px solid #233a4c;border-radius:7px;background:#08131d;color:#d2e0e9;font-size:10px}.admin-rtp-list label>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:850}.admin-rtp-list label small{display:block;color:#5e788c;font-size:7px}.admin-rtp-list input{text-align:right}.admin-rtp-list b{color:#7791a3}@media(max-width:560px){.admin-rtp-list{grid-template-columns:1fr}.admin-balance-card{grid-template-columns:1fr}.admin-balance-card>div:first-child,.admin-balance-actions{grid-column:1}.admin-balance-actions{flex-direction:column}.admin-content{padding:9px}}
      `}</style>
    </div>
  );
};

export default AdminPanel;
