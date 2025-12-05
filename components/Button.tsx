import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'game-action';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  
  // Base: Extra rounded, 3D effect with shadow and transform
  const baseStyles = "font-black rounded-[2rem] transition-all duration-200 active:scale-95 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border-b-[6px] active:border-b-0 active:translate-y-[6px]";
  
  const variants = {
    primary: "bg-[#60A5FA] border-[#2563EB] text-white shadow-xl hover:bg-[#93C5FD]", // Soft Blue
    secondary: "bg-[#FCD34D] border-[#D97706] text-[#78350F] shadow-xl hover:bg-[#FDE68A]", // Amber/Yellow
    danger: "bg-[#F87171] border-[#DC2626] text-white shadow-xl hover:bg-[#FCA5A5]", // Red/Pink
    success: "bg-[#34D399] border-[#059669] text-white shadow-xl hover:bg-[#6EE7B7]", // Emerald/Mint
    'game-action': "bg-white border-slate-200 text-slate-700 shadow-xl hover:bg-slate-50"
  };

  const sizes = {
    sm: "px-4 py-2 text-sm border-b-[3px]",
    md: "px-8 py-3 text-lg border-b-[5px]",
    lg: "px-10 py-4 text-xl border-b-[6px]",
    xl: "px-12 py-6 text-2xl w-full border-b-[8px]"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};