
import React from 'react';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const GlassButton: React.FC<GlassButtonProps> = ({ children, className, ...props }) => {
  return (
    <button
      className={`bg-white/10 hover:bg-yellow-400/20 focus:bg-yellow-400/20 rounded-xl text-yellow-400 hover:text-white focus:text-white py-2 px-6 font-bold border-none shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default GlassButton;
