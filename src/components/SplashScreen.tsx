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
          width={160}
          height={160}
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
