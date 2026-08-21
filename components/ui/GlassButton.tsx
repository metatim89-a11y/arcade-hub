
import React from 'react';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const GlassButton: React.FC<GlassButtonProps> = ({ children, className, ...props }) => {
  return (
    <button
      className={`bg-gradient-to-b from-amber-500/20 to-amber-900/40 hover:from-amber-500/30 hover:to-amber-800/50 text-amber-300 hover:text-amber-100 py-2.5 px-6 font-bold rounded-xl border border-amber-500/30 hover:border-amber-400/60 shadow-[0_4px_15px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-md transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default GlassButton;
