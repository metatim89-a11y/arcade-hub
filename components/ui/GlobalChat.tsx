// components/ui/GlobalChat.tsx v1.0.0
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import GlassButton from './GlassButton';

interface Message {
    id: string;
    username: string;
    text: string;
    timestamp: number;
    avatar?: string;
}

const GlobalChat: React.FC = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Mock initial messages
    useEffect(() => {
        setMessages([
            { id: '1', username: 'System', text: 'Welcome to the Global Chat!', timestamp: Date.now() - 100000 },
            { id: '2', username: 'ArcadeBot', text: 'Someone just won big in Crash!', timestamp: Date.now() - 50000 }
        ]);
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = () => {
        if (!inputText.trim() || !user) return;
        
        const newMessage: Message = {
            id: Date.now().toString(),
            username: user.username,
            text: inputText.trim(),
            timestamp: Date.now(),
            avatar: user.avatar
        };
        
        setMessages(prev => [...prev, newMessage]);
        setInputText('');
    };

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="global-chat-launcher fixed z-50 bg-gradient-to-b from-amber-400 to-amber-600 text-slate-950 font-black rounded-xl shadow-[0_10px_25px_rgba(245,158,11,0.3)] hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2 border border-amber-300"
                aria-label="Open global chat"
                title="Open global chat"
            >
                <svg className="w-4 h-4 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="hidden md:inline uppercase text-xs tracking-wider">Chat</span>
                <style>{`
                    .global-chat-launcher{right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));min-width:44px;height:44px;padding:0 14px;}
                    @media(max-width:640px){.global-chat-launcher{min-width:40px;width:40px;height:40px;padding:0;}}
                    body:has(.game-engine-stage:fullscreen) .global-chat-launcher{display:none}
                `}</style>
            </button>
        );
    }

    return (
        <div role="dialog" aria-label="Global chat" className="global-chat-panel fixed z-50 w-80 h-96 onyx-glass-panel border border-amber-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="bg-amber-500/10 p-3 border-b border-amber-500/20 flex justify-between items-center">
                <span className="text-amber-300 font-extrabold text-xs uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                    Global Arcade Hub Chat
                </span>
                <button onClick={() => setIsOpen(false)} className="text-amber-400/60 hover:text-amber-300 font-bold" aria-label="Close global chat">✕</button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-grow p-3 overflow-y-auto flex flex-col gap-3 custom-scrollbar">
                {messages.map(msg => (
                    <div key={msg.id} className="flex flex-col gap-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-amber-300 text-xs font-bold">{msg.username}</span>
                            <span className="text-[10px] text-slate-500">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="bg-black/40 p-2.5 rounded-xl text-xs text-slate-200 break-words border border-amber-500/15">
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input */}
            <div className="p-3 bg-black/60 border-t border-amber-500/20 flex gap-2">
                <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={user ? "Type a message..." : "Log in to chat"}
                    disabled={!user}
                    className="flex-grow bg-black/50 border border-amber-500/20 rounded-xl px-3 py-1.5 text-xs text-amber-100 placeholder-amber-400/30 focus:outline-none focus:border-amber-400/60"
                />
                <button
                    onClick={handleSend}
                    disabled={!user || !inputText.trim()}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 text-slate-950 font-black text-xs uppercase disabled:opacity-40"
                >
                    Send
                </button>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(234, 179, 8, 0.3); border-radius: 10px; }
                .global-chat-panel{right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom))}
                @media(max-width:640px){.global-chat-panel{left:10px;right:10px;bottom:max(10px,env(safe-area-inset-bottom));width:auto;max-height:min(70dvh,430px)}}
            `}</style>
        </div>
    );
};

export default GlobalChat;
