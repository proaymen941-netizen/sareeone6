import React from 'react';

interface AssistantMascotIconProps {
  className?: string;
  size?: number;
}

export const AssistantMascotIcon: React.FC<AssistantMascotIconProps> = ({ 
  className = "w-14 h-14", 
  size 
}) => {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <div 
      className={`relative flex items-center justify-center rounded-full bg-gradient-to-tr from-[#d83500] via-[#ff4500] to-[#ff6a1a] p-2.5 shadow-[0_8px_22px_rgba(255,69,0,0.45)] border-2 border-white/95 ring-4 ring-orange-500/20 transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_10px_28px_rgba(255,69,0,0.6)] group-active:scale-95 ${className}`}
      style={style}
    >
      {/* Glossy top shine */}
      <div className="absolute top-1 left-2 right-2 h-1/3 bg-gradient-to-b from-white/40 to-transparent rounded-t-full pointer-events-none" />

      {/* SVG Icon: Modern Support Bot Mascot with Headset & Message Tail */}
      <svg 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className="w-full h-full drop-shadow-sm select-none"
      >
        {/* Headset Arc */}
        <path 
          d="M10 24 C10 16 16 10 24 10 C32 10 38 16 38 24" 
          stroke="white" 
          strokeWidth="3" 
          strokeLinecap="round" 
          opacity="0.95"
        />

        {/* Headset Earcups */}
        <rect x="7" y="21" width="4" height="8" rx="2" fill="white" />
        <rect x="37" y="21" width="4" height="8" rx="2" fill="white" />

        {/* Mascot Head / Face Container */}
        <rect 
          x="12" 
          y="15" 
          width="24" 
          height="20" 
          rx="9" 
          fill="white" 
        />

        {/* Friendly Eyes in Orange-Red */}
        <circle cx="18.5" cy="22.5" r="2" fill="#e63900" />
        <circle cx="29.5" cy="22.5" r="2" fill="#e63900" />
        <circle cx="17.8" cy="21.8" r="0.7" fill="white" />
        <circle cx="28.8" cy="21.8" r="0.7" fill="white" />

        {/* Rosy/Warm Cheeks */}
        <circle cx="15.5" cy="26" r="1.3" fill="#ffb499" />
        <circle cx="32.5" cy="26" r="1.3" fill="#ffb499" />

        {/* Sweet Smile */}
        <path 
          d="M21 26.5 Q24 29.5 27 26.5" 
          stroke="#e63900" 
          strokeWidth="1.8" 
          strokeLinecap="round" 
          fill="none"
        />

        {/* Microphone Boom */}
        <path 
          d="M10 27 Q10 34 18 34" 
          stroke="white" 
          strokeWidth="2.2" 
          strokeLinecap="round" 
          fill="none" 
        />
        <circle cx="19" cy="34" r="2" fill="white" />

        {/* Small Bottom Chat Tail Badge */}
        <path 
          d="M20 35 L24 40 L28 35 Z" 
          fill="white" 
          opacity="0.95"
        />
      </svg>
    </div>
  );
};

export default AssistantMascotIcon;
