import React from 'react';

const WolfIcon = ({ className }: { className?: string }) => {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={1} 
        d="M12 2 L2 22 H22 L12 2 Z M12 9 L7 20 H17 L12 9 Z" 
      />
    </svg>
  );
};

export default WolfIcon;

