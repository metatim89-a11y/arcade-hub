
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCoinSystem } from '../../context/CoinContext';
import GlassButton from '../ui/GlassButton';

const ProfilePage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { user, updateProfile } = useAuth();
  const { funCoins, realCoins, transactions } = useCoinSystem();
  
  // Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(user?.bio || '');
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'dev'>('overview');

  // Dev/Git State
  const [currentBranch, setCurrentBranch] = useState('main');
  const [branches, setBranches] = useState(['main', 'dev', 'staging', 'feature/ui-update']);
  const [newBranchName, setNewBranchName] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null); // 'branch', 'commit', 'pull', 'create_repo'

  if (!user) return null;

  const handleSave = () => {
    updateProfile({ bio });
    setIsEditing(false);
  };

  // Simulated Git Actions
  const handleCreateBranch = () => {
      if(!newBranchName.trim()) return;
      setLoadingAction('branch');
      setTimeout(() => {
          const name = newBranchName.trim().replace(/\s+/g, '-').toLowerCase();
          setBranches(prev => [...prev, name]);
          setCurrentBranch(name);
          setNewBranchName('');
          setLoadingAction(null);
      }, 800);
  };

  const handleCommitAndPush = () => {
      if(!commitMessage.trim()) return;
      setLoadingAction('commit');
      setTimeout(() => {
          setLoadingAction(null);
          setCommitMessage('');
          alert(`[${currentBranch}] Changes committed and pushed successfully!`);
      }, 1500);
  };

  const handlePull = () => {
      setLoadingAction('pull');
      setTimeout(() => {
          setLoadingAction(null);
          alert(`Fast-forwarded ${currentBranch} from origin/${currentBranch}.`);
      }, 2000);
  };

  const handleCreateRepo = () => {
      setLoadingAction('create_repo');
      setTimeout(() => {
          setLoadingAction(null);
          alert("Repository '5idecoders-arcade' created successfully on GitHub!");
      }, 2000);
  };

  const handleOpenRepo = () => {
      window.open('https://github.com/5idescoder/arcade-hub', '_blank');
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 animate-slide-in">
        {/* Header Navigation */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <GlassButton onClick={onBack} className="text-sm px-4 self-start md:self-auto">← Back to Games</GlassButton>
            <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 bg-gray-900/50 p-1 rounded-xl">
                <button 
                    onClick={() => setActiveTab('overview')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-yellow-400 text-black shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    Overview
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-yellow-400 text-black shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    History
                </button>
                <button 
                    onClick={() => setActiveTab('dev')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'dev' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    Git Control
                </button>
            </div>
        </div>
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
            <div className="grid md:grid-cols-3 gap-6">
                {/* Profile Card */}
                <div className="bg-gray-900/80 border border-gray-700 rounded-2xl p-6 flex flex-col items-center text-center backdrop-blur-sm h-fit shadow-xl">
                    <div className="w-32 h-32 rounded-full bg-gray-800 border-4 border-yellow-400 mb-4 overflow-hidden shadow-lg shadow-yellow-400/20">
                        <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-1">{user.username}</h2>
                    <div className="text-gray-400 text-xs mb-4 flex items-center justify-center gap-2">
                         {user.isVerified ? (
                             <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30 flex items-center gap-1">
                                 ✓ Verified
                             </span>
                         ) : (
                             <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">Unverified</span>
                         )}
                         <span className="text-gray-600">•</span>
                         <span>Joined {new Date(user.joinedAt).toLocaleDateString()}</span>
                    </div>

                    <div className="w-full bg-black/30 rounded-xl p-3 mb-4">
                        {isEditing ? (
                            <div className="flex flex-col gap-2">
                                <textarea 
                                    value={bio} 
                                    onChange={(e) => setBio(e.target.value)}
                                    className="bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white w-full focus:border-yellow-400 outline-none"
                                    rows={3}
                                    placeholder="Tell us about yourself..."
                                />
                                <div className="flex gap-2">
                                    <button onClick={handleSave} className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs py-2 rounded font-bold">Save</button>
                                    <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 rounded font-bold">Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <div className="group relative">
                                <p className="text-gray-300 text-sm italic">"{bio || "No bio yet."}"</p>
                                <button 
                                    onClick={() => setIsEditing(true)}
                                    className="absolute top-0 right-0 text-xs text-gray-500 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    Edit
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats & Balances */}
                <div className="md:col-span-2 flex flex-col gap-6">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         {/* Fun Balance */}
                         <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 rounded-2xl p-6 relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">🪙</div>
                             <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Fun Coins Balance</h3>
                             <div className="text-4xl font-black text-yellow-400">{Math.floor(funCoins).toLocaleString()} <span className="text-lg">FC</span></div>
                         </div>
                         
                         {/* Real Balance */}
                         <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-2xl p-6 relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">💵</div>
                             <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Real Coins Balance</h3>
                             <div className="text-4xl font-black text-green-400">{Math.floor(realCoins).toLocaleString()} <span className="text-lg">RC</span></div>
                         </div>
                     </div>

                     {/* Recent Activity Preview */}
                     <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-6 flex-1">
                         <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                             <span>Recent Activity</span>
                         </h3>
                         <div className="space-y-2">
                             {transactions.length > 0 ? (
                                 transactions.slice(0, 3).map(tx => (
                                    <div key={tx.id} className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-200">{tx.reason}</span>
                                            <span className="text-xs text-gray-500">{new Date(tx.timestamp).toLocaleString()}</span>
                                        </div>
                                        <span className={`font-mono font-bold ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                                            {tx.type === 'credit' ? '+' : '-'}{tx.amount}
                                        </span>
                                    </div>
                                 ))
                             ) : (
                                 <div className="text-center text-gray-500 py-8">No transactions yet. Play some games!</div>
                             )}
                         </div>
                         {transactions.length > 3 && (
                             <button 
                                onClick={() => setActiveTab('history')}
                                className="w-full mt-4 text-sm text-gray-400 hover:text-white hover:underline text-center"
                             >
                                 View All Activity
                             </button>
                         )}
                     </div>
                </div>
            </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
            <div className="bg-gray-900/80 border border-gray-700 rounded-2xl p-6 backdrop-blur-sm">
                <h2 className="text-2xl font-bold text-white mb-6">Transaction History</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                                <th className="p-3">Time</th>
                                <th className="p-3">Type</th>
                                <th className="p-3">Description</th>
                                <th className="p-3 text-right">Amount</th>
                                <th className="p-3 text-right">Currency</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {transactions.length > 0 ? transactions.map(tx => (
                                <tr key={tx.id} className="border-b border-gray-800 hover:bg-white/5">
                                    <td className="p-3 text-gray-400">{new Date(tx.timestamp).toLocaleString()}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${tx.type === 'credit' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className="p-3 font-medium text-gray-200">{tx.reason}</td>
                                    <td className={`p-3 text-right font-mono font-bold ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                                        {tx.type === 'credit' ? '+' : '-'}{tx.amount}
                                    </td>
                                    <td className="p-3 text-right text-gray-500 uppercase">{tx.currency === 'fun' ? 'Fun' : 'Real'}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500">No transactions found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* DEV / GIT TAB */}
        {activeTab === 'dev' && (
            <div className="grid md:grid-cols-3 gap-6">
                {/* Repo Info */}
                <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl p-6 md:col-span-3 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black text-2xl">
                            <svg height="32" viewBox="0 0 16 16" version="1.1" width="32" aria-hidden="true"><path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">5idescoder/arcade-hub</h2>
                            <p className="text-gray-400 text-sm">Public Repository • TypeScript • React</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#21262d] border border-[#30363d] rounded-md text-xs text-gray-300">
                             <span className="w-2 h-2 rounded-full bg-green-400"></span>
                             {currentBranch}
                        </div>
                        <button 
                            onClick={handleCreateRepo}
                            disabled={loadingAction === 'create_repo'}
                            className="px-4 py-2 bg-[#1f6feb] hover:bg-[#388bfd] text-white rounded-md text-sm font-bold transition-colors disabled:opacity-50"
                        >
                            {loadingAction === 'create_repo' ? 'Creating...' : 'Create Repo'}
                        </button>
                        <button onClick={handleOpenRepo} className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded-md text-sm font-bold transition-colors">
                            View on GitHub
                        </button>
                    </div>
                </div>

                {/* Branch Management */}
                <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl p-6 flex flex-col gap-4">
                    <h3 className="text-white font-bold border-b border-[#30363d] pb-2">Branch Management</h3>
                    
                    <div>
                        <label className="text-xs text-gray-400 uppercase font-bold">Current Branch</label>
                        <select 
                            value={currentBranch} 
                            onChange={(e) => setCurrentBranch(e.target.value)}
                            className="w-full mt-1 bg-[#21262d] border border-[#30363d] text-white rounded p-2 outline-none focus:border-blue-500"
                        >
                            {branches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>

                    <div className="pt-2">
                        <label className="text-xs text-gray-400 uppercase font-bold">Create New Branch</label>
                        <div className="flex gap-2 mt-1">
                            <input 
                                type="text" 
                                value={newBranchName}
                                onChange={(e) => setNewBranchName(e.target.value)}
                                placeholder="feature/new-game"
                                className="flex-1 bg-[#21262d] border border-[#30363d] text-white rounded p-2 outline-none focus:border-blue-500 text-sm"
                            />
                            <button 
                                onClick={handleCreateBranch}
                                disabled={!newBranchName || loadingAction === 'branch'}
                                className="bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white px-3 rounded font-bold disabled:opacity-50"
                            >
                                {loadingAction === 'branch' ? '...' : '+'}
                            </button>
                        </div>
                    </div>
                    
                    <div className="mt-auto pt-4 border-t border-[#30363d]">
                        <button 
                            onClick={handlePull} 
                            disabled={loadingAction === 'pull'}
                            className="w-full bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white py-2 rounded font-bold text-sm flex items-center justify-center gap-2"
                        >
                            <span>⬇</span> Pull Origin
                        </button>
                    </div>
                </div>

                {/* Commit & Push */}
                <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl p-6 md:col-span-2 flex flex-col gap-4">
                    <h3 className="text-white font-bold border-b border-[#30363d] pb-2">Commit Changes</h3>
                    
                    <div className="flex-1 bg-[#161b22] rounded border border-[#30363d] p-4 font-mono text-xs text-gray-400 overflow-y-auto max-h-[150px]">
                        <p><span className="text-yellow-400">M</span> components/profile/ProfilePage.tsx</p>
                        <p><span className="text-green-400">A</span> assets/images/avatar_v2.png</p>
                        <p><span className="text-yellow-400">M</span> styles/globals.css</p>
                    </div>

                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={commitMessage}
                            onChange={(e) => setCommitMessage(e.target.value)}
                            placeholder="Commit message..."
                            className="flex-1 bg-[#21262d] border border-[#30363d] text-white rounded p-2 outline-none focus:border-blue-500 text-sm"
                        />
                        <button 
                            onClick={handleCommitAndPush}
                            disabled={!commitMessage || loadingAction === 'commit'}
                            className="bg-[#238636] hover:bg-[#2ea043] text-white px-6 py-2 rounded font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                        >
                            {loadingAction === 'commit' ? 'Pushing...' : 'Commit & Push'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ProfilePage;
