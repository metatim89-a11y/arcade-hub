
import React, { useState, useEffect } from 'react';
import { useCoinSystem } from '../../context/CoinContext';
import { useSolanaPayments } from '../../context/SolanaContext';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

interface GlobalWithdrawRequest {
    id: string;
    userAddress: string;
    username: string;
    rcAmount: number;
    usdValue: number;
    netSol: number;
    feeJup: number;
    timestamp: number;
    status: 'pending' | 'paid';
}

const AdminWithdrawalPanel: React.FC = () => {
    const { houseEarningsJup, jupPrice } = useSolanaPayments();
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();
    
    const [requests, setRequests] = useState<GlobalWithdrawRequest[]>([]);
    const [isPaying, setIsPaying] = useState<string | null>(null);

    const loadRequests = () => {
        const globalRequests = JSON.parse(localStorage.getItem('arcade_global_withdrawals') || '[]');
        setRequests(globalRequests.filter((r: any) => r.status === 'pending').reverse());
    };

    useEffect(() => {
        loadRequests();
        const interval = setInterval(loadRequests, 5000); // Refresh every 5s
        return () => clearInterval(interval);
    }, []);

    const handlePayout = async (request: GlobalWithdrawRequest) => {
        if (!publicKey) {
            alert("Please connect your Admin wallet to perform payouts.");
            return;
        }

        if (!window.confirm(`Are you sure you want to send ${request.netSol.toFixed(4)} SOL to ${request.userAddress}?`)) {
            return;
        }

        setIsPaying(request.id);
        try {
            const recipient = new PublicKey(request.userAddress);
            const lamports = Math.floor(request.netSol * LAMPORTS_PER_SOL);

            // Fetch fresh blockhash
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: recipient,
                    lamports,
                })
            );

            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            const signature = await sendTransaction(transaction, connection);
            await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });

            // Mark as Paid in Global Registry
            const allRequests = JSON.parse(localStorage.getItem('arcade_global_withdrawals') || '[]');
            const updated = allRequests.map((r: any) => 
                r.id === request.id ? { ...r, status: 'paid' } : r
            );
            localStorage.setItem('arcade_global_withdrawals', JSON.stringify(updated));
            
            alert(`Payout Successful! Sig: ${signature.slice(0, 8)}...`);
            loadRequests();
        } catch (error: any) {
            console.error("[payout-logic.sh] Error: " + error.message);
            alert(`Payout Failed: ${error.message}`);
            throw error;
        } finally {
            setIsPaying(null);
        }
    };

    return (
        <div className="bg-gray-900/90 border border-red-500/30 rounded-2xl p-6 backdrop-blur-md shadow-2xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-red-500/20 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center text-red-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Withdrawal Requests</h3>
                        <p className="text-xs text-red-400 uppercase tracking-widest font-bold">Admin Review Panel</p>
                    </div>
                </div>

                <div className="bg-black/40 p-3 rounded-xl border border-yellow-500/20 flex flex-col items-end">
                    <span className="text-[10px] text-gray-500 uppercase font-bold">Total House Earnings</span>
                    <span className="text-xl font-black text-yellow-400">{houseEarningsJup.toFixed(2)} JUP</span>
                    {jupPrice && <span className="text-[10px] text-green-500/80">≈ ${(houseEarningsJup * jupPrice).toFixed(2)} USD</span>}
                </div>
            </div>

            <div className="space-y-4">
                {requests.length > 0 ? (
                    requests.map(req => (
                        <div key={req.id} className="bg-black/40 border border-white/5 p-4 rounded-xl flex flex-col md:flex-row justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-bold uppercase">Pending</span>
                                    <span className="text-gray-400 text-[10px]">{new Date(req.timestamp).toLocaleString()}</span>
                                    <span className="text-blue-400 text-[10px] font-bold">Player: {req.username}</span>
                                </div>
                                <p className="text-sm text-gray-200 font-mono break-all">{req.userAddress}</p>
                                <p className="text-xs text-gray-500 italic">User requested payout for {req.rcAmount} RC (${req.usdValue.toFixed(2)})</p>
                                <p className="text-xs text-yellow-500/80">Fee Collected: {req.feeJup.toFixed(2)} JUP</p>
                            </div>
                            <div className="flex flex-col items-end justify-center">
                                <span className="text-2xl font-black text-green-400">{req.netSol.toFixed(4)} SOL</span>
                                <button 
                                    onClick={() => handlePayout(req)}
                                    disabled={isPaying === req.id}
                                    className="mt-2 px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white text-xs font-bold rounded-lg transition-colors shadow-lg active:scale-95"
                                >
                                    {isPaying === req.id ? 'Processing...' : 'Send SOL Payout'}
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-10 bg-black/20 rounded-xl border border-dashed border-gray-800">
                        <p className="text-gray-500">No pending withdrawal requests found.</p>
                    </div>
                )}
            </div>

            <div className="mt-6 p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl">
                <p className="text-[10px] text-yellow-500/60 uppercase tracking-tighter leading-tight">
                    Notice: This panel reads from the local transaction history. In this demo version, 
                    clearing your browser cache or switching devices will hide these requests. 
                    Manual SOL transfers must be verified on-chain via Solscan.
                </p>
            </div>
        </div>
    );
};

export default AdminWithdrawalPanel;
