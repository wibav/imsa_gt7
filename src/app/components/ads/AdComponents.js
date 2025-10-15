'use client';

import { AdSense } from './AdSense';

export function BannerAd({ className = '' }) {
  return (
    <AdSense
      adSlot="1234567890" // Reemplaza con tu slot real
      adFormat="horizontal"
      className={`banner-ad ${className}`}
      style={{ minHeight: '90px' }}
    />
  );
}

export function RectangleAd({ className = '' }) {
  return (
    <AdSense
      adSlot="0987654321" // Reemplaza con tu slot real
      adFormat="rectangle"
      className={`rectangle-ad ${className}`}
      style={{ minHeight: '250px', minWidth: '300px' }}
    />
  );
}

export function VerticalAd({ className = '' }) {
  return (
    <AdSense
      adSlot="1357924680" // Reemplaza con tu slot real
      adFormat="vertical"
      className={`vertical-ad ${className}`}
      style={{ minHeight: '600px', minWidth: '160px' }}
    />
  );
}