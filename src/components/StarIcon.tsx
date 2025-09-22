import React from 'react';

interface StarIconProps {
  width?: number;
  height?: number;
  className?: string;
}

const StarIcon: React.FC<StarIconProps> = ({ width = 50, height = 50, className = "" }) => {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 100 100" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Star shape with gradient fill */}
      <defs>
        <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: "#FFD700", stopOpacity: 1}} />
          <stop offset="50%" style={{stopColor: "#FFA500", stopOpacity: 1}} />
          <stop offset="100%" style={{stopColor: "#FF8C00", stopOpacity: 1}} />
        </linearGradient>
      </defs>
      
      {/* Main star shape */}
      <path 
        d="M50 5 L60 35 L90 35 L68 55 L78 85 L50 67 L22 85 L32 55 L10 35 L40 35 Z" 
        fill="url(#starGradient)" 
        stroke="#8B0000" 
        strokeWidth="3" 
        strokeLinejoin="round"
      />
      
      {/* Sparkle lines around the star */}
      <line x1="15" y1="15" x2="20" y2="20" stroke="#8B0000" strokeWidth="2" strokeLinecap="round"/>
      <line x1="85" y1="15" x2="80" y2="20" stroke="#8B0000" strokeWidth="2" strokeLinecap="round"/>
      <line x1="15" y1="85" x2="20" y2="80" stroke="#8B0000" strokeWidth="2" strokeLinecap="round"/>
      <line x1="85" y1="85" x2="80" y2="80" stroke="#8B0000" strokeWidth="2" strokeLinecap="round"/>
      <line x1="50" y1="0" x2="50" y2="7" stroke="#8B0000" strokeWidth="2" strokeLinecap="round"/>
      <line x1="50" y1="93" x2="50" y2="100" stroke="#8B0000" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
};

export default StarIcon;
