'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

const SplashScreen = ({ onFinished }: { onFinished: () => void }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Mock biometric success
      setVisible(false);
      onFinished();
    }, 4000); // Splash screen visible for 4 seconds

    return () => clearTimeout(timer);
  }, [onFinished]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center animate-fadeIn">
      <div className="animate-pulse">
        <Image
          src="/wolf-vector.png"
          alt="Wolf Network logo"
          width={256}
          height={256}
          className="w-40 h-40 md:w-56 md:h-56 lg:w-64 lg:h-64 drop-shadow-[0_0_24px_rgba(255,255,255,0.18)]"
          priority
        />
      </div>
      <p className="text-main-text text-lg mt-8 animate-pulse">
        One call. Total control.
      </p>
    </div>
  );
};

export default SplashScreen;
