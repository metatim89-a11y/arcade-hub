
import React from 'react';
import { useCoinSystem } from '../../context/CoinContext';
import { useSolanaPayments } from '../../context/SolanaContext';

const AdminWithdrawalPanel: React.FC = () => {
    const { transactions } = useCoinSystem();
    const { houseEarningsJup, jupPrice } = useSolanaPayments();
    
    // Filter transactions for withdraw requests
    const withdrawalRequests = transactions.filter(tx => 
        tx.type === 'debit' && tx.reason.toLowerCase().includes('withdraw request')
    );

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
                {withdrawalRequests.length > 0 ? (
                    withdrawalRequests.map(req => (
                        <div key={req.id} className="bg-black/40 border border-white/5 p-4 rounded-xl flex flex-col md:flex-row justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-bold uppercase">Pending</span>
                                    <span className="text-gray-400 text-[10px]">{new Date(req.timestamp).toLocaleString()}</span>
                                </div>
                                <p className="text-sm text-gray-200 font-mono break-all">{req.reason}</p>
                                <p className="text-xs text-gray-500 italic">User requested payout for {req.amount} RC</p>
                            </div>
                            <div className="flex flex-col items-end justify-center">
                                <span className="text-2xl font-black text-red-400">-{req.amount} RC</span>
                                <button 
                                    onClick={() => alert("Mark as Paid: This would notify the user and clear the log in a production backend.")}
                                    className="mt-2 px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg"
                                >
                                    Mark as Paid
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
