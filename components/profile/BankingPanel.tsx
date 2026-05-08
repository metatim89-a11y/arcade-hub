
import React, { useState } from 'react';
import { useSolanaPayments } from '../../context/SolanaContext';
import { useCoinSystem } from '../../context/CoinContext';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const BankingPanel: React.FC = () => {
    const { solPrice, isLoadingPrice, deposit, requestWithdraw, isBanking, error } = useSolanaPayments();
    const { realCoins } = useCoinSystem();
    const { connected } = useWallet();
    
    const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
    const [usdAmount, setUsdAmount] = useState<string>('10');
    const [rcAmount, setRcAmount] = useState<string>('20');
    const [statusMsg, setStatusMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

    const handleDeposit = async () => {
        const amount = parseFloat(usdAmount);
        if (isNaN(amount) || amount <= 0) return;
        
        setStatusMsg(null);
        const success = await deposit(amount);
        if (success) {
            setStatusMsg({ type: 'success', text: `Successfully deposited $${amount}! Your Real Coins have been credited.` });
        } else if (error) {
            setStatusMsg({ type: 'error', text: error });
        }
    };

    const handleWithdraw = async () => {
        const amount = parseFloat(rcAmount);
        if (isNaN(amount) || amount <= 0) return;
        
        setStatusMsg(null);
        const success = await requestWithdraw(amount);
        if (success) {
            setStatusMsg({ type: 'success', text: `Withdrawal request for ${amount} RC submitted! It will be processed manually.` });
        } else if (error) {
            setStatusMsg({ type: 'error', text: error });
        }
    };

    const { transactions } = useCoinSystem();
    const bankingTransactions = transactions.filter(tx => 
        tx.reason.toLowerCase().includes('solana') || tx.reason.toLowerCase().includes('withdraw')
    ).slice(0, 5);

    if (!connected) {
        return (
            <div className="bg-gray-800/50 p-6 rounded-xl border border-yellow-500/20 flex flex-col items-center gap-4 text-center">
                <h3 className="text-xl font-bold text-yellow-400">Solana Banking</h3>
                <p className="text-gray-300 text-sm">Connect your Solana wallet to deposit or withdraw real coins.</p>
                <WalletMultiButton className="!bg-yellow-500 !text-black !font-bold hover:!bg-yellow-400" />
                <p className="text-xs text-gray-500 mt-2">Currently supporting Devnet for testing.</p>
            </div>
        );
    }

    const solToReceive = solPrice ? (parseFloat(rcAmount) / 2 * 0.8) / solPrice : 0;

    return (
        <div className="bg-gray-800/80 p-6 rounded-xl border border-yellow-500/30 flex flex-col gap-6 shadow-2xl backdrop-blur-sm">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <h3 className="text-2xl font-bold text-yellow-400">Bank & Cashier</h3>
                <div className="text-right">
                    <p className="text-xs text-gray-400 uppercase tracking-widest">Live SOL Price</p>
                    <p className="text-lg font-mono text-green-400">
                        {isLoadingPrice ? 'Loading...' : solPrice ? `$${solPrice.toFixed(2)}` : 'Unavailable'}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-black/40 p-1 rounded-lg">
                <button 
                    onClick={() => setActiveTab('deposit')}
                    className={`flex-1 py-2 rounded-md font-bold transition-all ${activeTab === 'deposit' ? 'bg-yellow-500 text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    Deposit
                </button>
                <button 
                    onClick={() => setActiveTab('withdraw')}
                    className={`flex-1 py-2 rounded-md font-bold transition-all ${activeTab === 'withdraw' ? 'bg-yellow-500 text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    Withdraw
                </button>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-4">
                {activeTab === 'deposit' ? (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-300">Amount to Deposit (USD)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                <input 
                                    type="number" 
                                    value={usdAmount}
                                    onChange={(e) => setUsdAmount(e.target.value)}
                                    className="w-full bg-black/50 border border-white/20 rounded-lg py-3 pl-8 pr-4 text-xl font-mono focus:border-yellow-500 outline-none"
                                />
                            </div>
                            <p className="text-xs text-gray-400">
                                You will receive <span className="text-yellow-400 font-bold">{parseFloat(usdAmount) * 2 || 0} Real Coins</span>
                            </p>
                            <p className="text-xs text-gray-500 italic">
                                Approx. {solPrice ? (parseFloat(usdAmount) / solPrice).toFixed(4) : '...'} SOL
                            </p>
                        </div>
                        <button 
                            onClick={handleDeposit}
                            disabled={isBanking || !solPrice}
                            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform active:scale-95"
                        >
                            {isBanking ? 'Processing Transaction...' : 'Confirm Deposit'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-300">Real Coins to Withdraw</label>
                            <input 
                                type="number" 
                                value={rcAmount}
                                onChange={(e) => setRcAmount(e.target.value)}
                                className="w-full bg-black/50 border border-white/20 rounded-lg py-3 px-4 text-xl font-mono focus:border-yellow-500 outline-none"
                            />
                            <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">Gross USD:</span>
                                    <span className="text-white">${(parseFloat(rcAmount) / 2 || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-red-400">
                                    <span>House Fee (20%):</span>
                                    <span>-${((parseFloat(rcAmount) / 2) * 0.2 || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold border-t border-white/10 pt-1 mt-1">
                                    <span className="text-yellow-400">Net to You:</span>
                                    <span className="text-green-400">${((parseFloat(rcAmount) / 2) * 0.8 || 0).toFixed(2)}</span>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 italic">
                                Approx. {solToReceive.toFixed(4)} SOL
                            </p>
                        </div>
                        <button 
                            onClick={handleWithdraw}
                            disabled={isBanking || !solPrice || parseFloat(rcAmount) > realCoins}
                            className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 text-black font-bold py-4 rounded-xl shadow-lg transition-all transform active:scale-95"
                        >
                            {isBanking ? 'Processing...' : 'Submit Withdrawal Request'}
                        </button>
                        <p className="text-[10px] text-gray-500 text-center italic mt-2">
                            *This will deduct coins from your balance. The Admin will then manually send the SOL to your wallet.
                        </p>
                    </div>
                )}
            </div>

            {statusMsg && (
                <div className={`p-4 rounded-lg text-sm font-medium ${statusMsg.type === 'success' ? 'bg-green-900/40 text-green-200 border border-green-500/50' : 'bg-red-900/40 text-red-200 border border-red-500/50'}`}>
                    {statusMsg.text}
                </div>
            )}

            <div className="mt-2 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
                <p className="text-[10px] text-yellow-200/70 leading-relaxed uppercase tracking-wider text-center">
                    All deposits are instant. Withdrawals are processed manually within 24 hours. 
                    Testnet SOL only. 2 Real Coins = $1.00 USD.
                </p>
            </div>

            {/* Banking History Preview */}
            <div className="mt-4 pt-4 border-t border-white/10">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Recent Banking Activity</h4>
                <div className="space-y-2">
                    {bankingTransactions.length > 0 ? (
                        bankingTransactions.map(tx => (
                            <div key={tx.id} className="flex justify-between items-center bg-black/30 p-2 rounded-lg border border-white/5 text-[10px]">
                                <div className="flex flex-col">
                                    <span className="text-gray-200 font-medium truncate max-w-[150px]">{tx.reason}</span>
                                    <span className="text-gray-500">{new Date(tx.timestamp).toLocaleDateString()}</span>
                                </div>
                                <span className={`font-mono font-bold ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                                    {tx.type === 'credit' ? '+' : '-'}{tx.amount} RC
                                </span>
                            </div>
                        ))
                    ) : (
                        <p className="text-[10px] text-gray-600 italic text-center py-2">No recent deposits or withdrawals.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BankingPanel;
