import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import TexasHoldemGame from './TexasHoldemGame';
import OnlineHoldemGame from './OnlineHoldemGame';

type OnlineTable = { id: string; name: string; owner_id: string; max_players: number; bot_count: number; small_blind: number; big_blind: number; buy_in: number; status: string };
type OnlineSeat = { table_id: string; user_id: string; display_name: string; seat_number: number };

const TexasHoldemLobby: React.FC = () => {
  const { user } = useAuth();
  const [tables, setTables] = useState<OnlineTable[]>([]);
  const [seats, setSeats] = useState<OnlineSeat[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [tableName, setTableName] = useState('Tim’s Table');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [botCount, setBotCount] = useState(1);
  const [stakeIndex, setStakeIndex] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [practiceMode, setPracticeMode] = useState(false);

  const loadLobby = useCallback(async () => {
    if (!isSupabaseConfigured || !user || user.isGuest) return;
    const supabase = getSupabase();
    const [{ data: tableRows, error: tableError }, { data: seatRows, error: seatError }] = await Promise.all([
      supabase.from('holdem_tables').select('id,name,owner_id,max_players,bot_count,small_blind,big_blind,buy_in,status').in('status', ['waiting', 'playing']).order('created_at'),
      supabase.from('holdem_table_seats').select('table_id,user_id,display_name,seat_number').order('seat_number'),
    ]);
    if (tableError || seatError) throw tableError || seatError;
    setTables((tableRows ?? []) as OnlineTable[]);
    setSeats((seatRows ?? []) as OnlineSeat[]);
  }, [user]);

  useEffect(() => {
    if (!user || user.isGuest || !isSupabaseConfigured) return;
    void loadLobby().catch((reason) => setError(reason.message));
    const supabase = getSupabase();
    const channel = supabase.channel('holdem-lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'holdem_tables' }, () => void loadLobby())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'holdem_table_seats' }, () => void loadLobby())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadLobby, user]);

  const selectedTable = tables.find((table) => table.id === selectedTableId);
  const stakes = [{ small: 5, big: 10, buyIn: 250 }, { small: 10, big: 20, buyIn: 500 }, { small: 25, big: 50, buyIn: 1250 }, { small: 50, big: 100, buyIn: 2500 }];
  const selectedSeats = seats.filter((seat) => seat.table_id === selectedTableId);
  const myTable = useMemo(() => tables.find((table) => seats.some((seat) => seat.table_id === table.id && seat.user_id === user?.id)), [seats, tables, user?.id]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await work(); await loadLobby(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update the table.'); }
    finally { setBusy(false); }
  };

  const createTable = () => run(async () => {
    const stake = stakes[stakeIndex];
    const { data, error: rpcError } = await getSupabase().rpc('create_holdem_table', { table_name: tableName, requested_max_players: maxPlayers, requested_bot_count: botCount, requested_small_blind: stake.small, requested_big_blind: stake.big, requested_buy_in: stake.buyIn, player_name: user!.username });
    if (rpcError) throw rpcError;
    setSelectedTableId(data as string); setShowCreate(false);
  });
  const joinTable = (id: string) => run(async () => {
    const { error: rpcError } = await getSupabase().rpc('join_holdem_table', { target_table_id: id, player_name: user!.username });
    if (rpcError) throw rpcError;
    setSelectedTableId(id);
  });
  const leaveTable = (id: string) => run(async () => {
    const { error: rpcError } = await getSupabase().rpc('leave_holdem_table', { target_table_id: id });
    if (rpcError) throw rpcError;
    setSelectedTableId(null);
  });
  const startOnlineGame = (id: string) => run(async () => {
    const { data, error: functionError } = await getSupabase().functions.invoke('holdem-game', { body: { tableId: id, action: 'start' } });
    if (functionError || data?.error) throw new Error(data?.error || functionError?.message);
  });

  if (practiceMode) return <div className="online-holdem"><button className="lobby-back" onClick={() => setPracticeMode(false)}>← TABLE LOBBY</button><TexasHoldemGame /></div>;
  if (myTable?.status === 'playing' && user) return <OnlineHoldemGame tableId={myTable.id} userId={user.id} onLeave={() => void leaveTable(myTable.id)} />;
  if (!user || user.isGuest || !isSupabaseConfigured) return (
    <section className="holdem-lobby"><h2>Hold’em Tables</h2><p>Sign in with an Arcade Hub account to join online tables from another device.</p><button onClick={() => setPracticeMode(true)}>PLAY WITH BOTS</button></section>
  );

  return (
    <section className="holdem-lobby">
      <header><div><small>ONLINE POKER</small><h2>Hold’em Tables</h2></div><span className="live-dot">LIVE</span></header>
      {error && <div className="lobby-error" role="alert">{error}</div>}
      {myTable ? (
        <div className="waiting-room">
          <small>YOU JOINED</small><h3>{myTable.name}</h3><div className="stakes-pill">BLINDS {myTable.small_blind}/{myTable.big_blind} · BUY-IN {myTable.buy_in}</div>
          <div className="seat-grid">{Array.from({ length: myTable.max_players }, (_, index) => {
            const seat = seats.find((candidate) => candidate.table_id === myTable.id && candidate.seat_number === index);
            const botStart = myTable.max_players - myTable.bot_count;
            return <div key={index} className={seat ? 'filled' : index >= botStart ? 'bot' : ''}><b>{seat?.display_name ?? (index >= botStart ? `CPU ${index + 1}` : 'Open seat')}</b><span>SEAT {index + 1}</span></div>;
          })}</div>
          <p>Waiting for players. Seats update live across every device.</p>
          {myTable.owner_id === user.id && <button disabled={busy} onClick={() => startOnlineGame(myTable.id)}>START GAME</button>}
          <button disabled={busy} onClick={() => leaveTable(myTable.id)}>LEAVE TABLE</button>
        </div>
      ) : showCreate ? (
        <div className="create-table"><h3>Create a table</h3><label>TABLE NAME<input value={tableName} maxLength={32} onChange={event => setTableName(event.target.value)} /></label><label>TABLE STAKES<select value={stakeIndex} onChange={event => setStakeIndex(Number(event.target.value))}>{stakes.map((stake, index) => <option key={stake.big} value={index}>{stake.small}/{stake.big} blinds · {stake.buyIn} buy-in</option>)}</select></label><label>SEATS<select value={maxPlayers} onChange={event => { const value = Number(event.target.value); setMaxPlayers(value); setBotCount(current => Math.min(current, value - 1)); }}><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option></select></label><label>BOT SEATS<select value={botCount} onChange={event => setBotCount(Number(event.target.value))}>{Array.from({ length: maxPlayers }, (_, index) => <option key={index} value={index}>{index}</option>)}</select></label><div><button onClick={() => setShowCreate(false)}>CANCEL</button><button disabled={busy || tableName.trim().length < 3} onClick={createTable}>CREATE TABLE</button></div></div>
      ) : (
        <><div className="lobby-actions"><button onClick={() => setShowCreate(true)}>+ CREATE TABLE</button><button onClick={() => setPracticeMode(true)}>PLAY WITH BOTS</button></div><div className="table-list">{tables.length === 0 && <p>No open tables yet. Create the first one.</p>}{tables.map(table => { const humanSeats = seats.filter(seat => seat.table_id === table.id).length; const humanCapacity = table.max_players - table.bot_count; return <article key={table.id} className={selectedTable?.id === table.id ? 'selected' : ''} onClick={() => setSelectedTableId(table.id)}><div><h3>{table.name}</h3><span>{humanSeats}/{humanCapacity} humans · {table.bot_count} bots</span><b className="table-stakes">{table.small_blind}/{table.big_blind} · BUY-IN {table.buy_in}</b></div><button disabled={busy || humanSeats >= humanCapacity} onClick={event => { event.stopPropagation(); void joinTable(table.id); }}>{humanSeats >= humanCapacity ? 'FULL' : 'JOIN'}</button></article>; })}</div></>
      )}
      <style>{`.holdem-lobby{width:min(100%,820px);min-height:520px;padding:24px;border:1px solid #40584c;border-radius:22px;background:linear-gradient(150deg,#111b18,#18251f);color:#edf4f0}.holdem-lobby header{display:flex;align-items:center;justify-content:space-between}.holdem-lobby h2,.holdem-lobby h3{margin:3px 0}.holdem-lobby small{color:#d6ae4a;font-weight:900;letter-spacing:.16em}.live-dot{padding:6px 10px;border:1px solid #2da66f;border-radius:20px;color:#68dba2;font-size:10px;font-weight:900}.live-dot:before{content:'';display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:50%;background:#49d78f;box-shadow:0 0 10px #49d78f}.lobby-actions{display:flex;gap:10px;margin:22px 0}.holdem-lobby button{padding:11px 15px;border:0;border-radius:9px;background:#258257;color:white;font-weight:900;cursor:pointer}.holdem-lobby button:disabled{opacity:.45}.lobby-actions button+button,.waiting-room>button,.create-table button:first-child{background:#33483e}.table-list{display:grid;gap:10px}.table-list article{display:flex;align-items:center;justify-content:space-between;padding:14px;border:1px solid #385346;border-radius:12px;background:#0d1c16;cursor:pointer}.table-list article:hover,.table-list article.selected{border-color:#d6ae4a}.table-list span{display:block;color:#91a79a;font-size:11px}.table-stakes,.stakes-pill{display:inline-block;margin-top:7px;padding:4px 7px;border-radius:6px;background:#2b2412;color:#edc65e;font-size:9px;letter-spacing:.05em}.lobby-error{margin:12px 0;padding:10px;border-radius:8px;background:#672a33}.create-table,.waiting-room{display:grid;gap:14px;margin-top:22px;padding:20px;border:1px solid #385346;border-radius:14px;background:#0d1c16}.create-table label{display:grid;gap:5px;color:#91a79a;font-size:10px;font-weight:900}.create-table input,.create-table select{padding:11px;border:1px solid #385346;border-radius:8px;background:#15271f;color:white}.create-table>div{display:flex;justify-content:flex-end;gap:9px}.seat-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.seat-grid>div{display:grid;padding:13px;border:1px dashed #466256;border-radius:10px;color:#779084}.seat-grid>div.filled{border-style:solid;border-color:#d6ae4a;color:#f0c85f}.seat-grid>div.bot{border-style:solid;color:#b792d7}.seat-grid span{font-size:8px}.waiting-room p{color:#91a79a;font-size:12px}.online-holdem{width:100%}.lobby-back{margin-bottom:10px;padding:8px 12px;border:0;border-radius:8px;background:#33483e;color:white;font-weight:900}@media(max-width:520px){.holdem-lobby{padding:15px}.seat-grid{grid-template-columns:1fr}.lobby-actions{flex-direction:column}}`}</style>
    </section>
  );
};

export default TexasHoldemLobby;
