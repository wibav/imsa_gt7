'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';

export function AdSense({
  adSlot,
  adFormat = 'auto',
  fullWidthResponsive = true,
  style = {},
  className = '',
}) {
  const adRef = useRef(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;

    const tryPush = () => {
      try {
        if (typeof window !== 'undefined' && window.adsbygoogle && adRef.current) {
          window.adsbygoogle.push({});
          pushed.current = true;
        }
      } catch (err) {
        // Silenciar errores de AdSense (ad blockers, slots inválidos, etc.)
      }
    };

    // Esperar a que el script esté disponible
    if (window.adsbygoogle) {
      tryPush();
    } else {
      const interval = setInterval(() => {
        if (window.adsbygoogle) {
          tryPush();
          clearInterval(interval);
        }
      }, 300);
      // Limpiar si el componente se desmonta
      return () => clearInterval(interval);
    }
  }, [adSlot]);

  return (
    <div className={`ad-container ${className}`} style={style}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-3229768467294527"
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive.toString()}
      />
    </div>
  );
}

export function AdSenseScript() {
  return (
    <Script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3229768467294527"
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}