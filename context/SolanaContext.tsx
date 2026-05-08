
import React, { createContext, useContext, useMemo, useState, useEffect, ReactNode } from 'react';
import { ConnectionProvider, WalletProvider, useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useCoinSystem } from './CoinContext';

// Import styles
import '@solana/wallet-adapter-react-ui/styles.css';

// --- Configuration ---
const NETWORK = WalletAdapterNetwork.Devnet;
const TREASURY_WALLET = new PublicKey('AL6hAPJ6SNmgy9UYf4H3CDhAhtvSr3Sg75WvJaf95jMJ'); 
const RC_TO_USD = 2; // 2 Real Coins = $1 USD
const WITHDRAW_FEE_PERCENT = 0.20; // 20% House Fee

interface SolanaContextType {
    solPrice: number | null;
    isLoadingPrice: boolean;
    deposit: (usdAmount: number) => Promise<boolean>;
    requestWithdraw: (rcAmount: number) => Promise<boolean>;
    isBanking: boolean;
    error: string | null;
}

const SolanaContext = createContext<SolanaContextType | undefined>(undefined);

export const SolanaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const endpoint = useMemo(() => clusterApiUrl(NETWORK), []);
    const wallets = useMemo(() => [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
    ], []);

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    <SolanaLogicProvider>
                        {children}
                    </SolanaLogicProvider>
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

const SolanaLogicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();
    const { addCoins, subtractCoins, realCoins, setCurrencyMode } = useCoinSystem();

    const [solPrice, setSolPrice] = useState<number | null>(null);
    const [isLoadingPrice, setIsLoadingPrice] = useState(false);
    const [isBanking, setIsBanking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch SOL price from CoinGecko
    const fetchPrice = async () => {
        setIsLoadingPrice(true);
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
            const data = await response.json();
            if (data.solana && data.solana.usd) {
                setSolPrice(data.solana.usd);
            }
        } catch (err) {
            console.error('Failed to fetch SOL price:', err);
            setError('Could not fetch live SOL price.');
        } finally {
            setIsLoadingPrice(false);
        }
    };

    useEffect(() => {
        fetchPrice();
        const interval = setInterval(fetchPrice, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    const deposit = async (usdAmount: number): Promise<boolean> => {
        if (!publicKey || !solPrice) {
            setError('Wallet not connected or price unavailable.');
            return false;
        }

        setIsBanking(true);
        setError(null);

        try {
            const solAmount = usdAmount / solPrice;
            const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: TREASURY_WALLET,
                    lamports,
                })
            );

            const {
                context: { slot: minContextSlot },
                value: { blockhash, lastValidBlockHeight }
            } = await connection.getLatestBlockhashAndContext();

            const signature = await sendTransaction(transaction, connection, { minContextSlot });
            await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });

            // On Success, add Real Coins (2 RC per 1 USD)
            const rcAmount = usdAmount * RC_TO_USD;
            addCoins(rcAmount, `Solana Deposit: ${usdAmount}$ (${solAmount.toFixed(4)} SOL)`, 'real');
            
            // Switch to real coins mode automatically
            setCurrencyMode('real');
            
            return true;
        } catch (err: any) {
            console.error('Deposit failed:', err);
            setError(err.message || 'Deposit failed');
            return false;
        } finally {
            setIsBanking(false);
        }
    };

    const requestWithdraw = async (rcAmount: number): Promise<boolean> => {
        if (!publicKey || !solPrice) {
            setError('Wallet not connected or price unavailable.');
            return false;
        }

        if (rcAmount > realCoins) {
            setError('Insufficient Real Coins balance.');
            return false;
        }

        setIsBanking(true);
        setError(null);

        try {
            const usdValue = rcAmount / RC_TO_USD;
            const fee = usdValue * WITHDRAW_FEE_PERCENT;
            const netUsd = usdValue - fee;
            const netSol = netUsd / solPrice;

            // Subtract coins immediately (locking it in)
            const success = subtractCoins(rcAmount, `Withdraw Request: ${netSol.toFixed(4)} SOL (Wallet: ${publicKey.toBase58()})`);
            
            if (success) {
                // In a real app, you'd send this to a backend. 
                // Here, it's logged in the transactions list for manual processing.
                console.log(`Withdraw Request Submitted: ${rcAmount} RC -> ${netSol.toFixed(4)} SOL to ${publicKey.toBase58()}`);
                return true;
            } else {
                setError('Failed to process coin deduction.');
                return false;
            }
        } catch (err: any) {
            console.error('Withdrawal failed:', err);
            setError(err.message || 'Withdrawal failed');
            return false;
        } finally {
            setIsBanking(false);
        }
    };

    return (
        <SolanaContext.Provider value={{
            solPrice,
            isLoadingPrice,
            deposit,
            requestWithdraw,
            isBanking,
            error
        }}>
            {children}
        </SolanaContext.Provider>
    );
};

export const useSolanaPayments = () => {
    const context = useContext(SolanaContext);
    if (context === undefined) {
        throw new Error('useSolanaPayments must be used within a SolanaProvider');
    }
    return context;
};
