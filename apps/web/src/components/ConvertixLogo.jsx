import React from 'react';

/**
 * ConvertixLogo — Custom SVG brand mark for Convertix.
 * A stylized media conversion icon: two interlocking arrows forming a "C" shape
 * around a central transform diamond, representing file/media conversion.
 *
 * @param {number}  size      - Width/height in px (default: 24)
 * @param {boolean} animated  - Render with loader animation (pulse + orbit)
 * @param {string}  className - Additional CSS classes
 */
export default function ConvertixLogo({ size = 24, animated = false, className = '' }) {
  const id = React.useId();

  return (
    <div
      className={`convertix-logo ${animated ? 'convertix-loader' : ''} ${className}`}
      style={{ width: size, height: size, position: 'relative' }}
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="convertix-mark"
      >
        <defs>
          {/* Primary gradient — Electric Indigo to violet */}
          <linearGradient id={`${id}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          {/* Secondary gradient for the arrows */}
          <linearGradient id={`${id}-arrow`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a5b4fc" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          {/* Glow filter */}
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feFlood floodColor="#6366f1" floodOpacity="0.6" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background circle — dark substrate */}
        <circle cx="32" cy="32" r="30" fill="hsl(240 10% 9%)" />
        <circle cx="32" cy="32" r="30" stroke={`url(#${id}-grad)`} strokeWidth="1.5" strokeOpacity="0.3" fill="none" />

        {/* Conversion arrows — two curved arrows forming a cycle */}
        <g filter={animated ? `url(#${id}-glow)` : undefined}>
          {/* Top-right arrow: clockwise arc */}
          <path
            d="M36 18 A14 14 0 0 1 46 32"
            stroke={`url(#${id}-arrow)`}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          {/* Arrowhead top-right */}
          <path d="M44 27 L46 32 L41 31" fill={`url(#${id}-arrow)`} />

          {/* Bottom-left arrow: clockwise arc */}
          <path
            d="M28 46 A14 14 0 0 1 18 32"
            stroke={`url(#${id}-grad)`}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          {/* Arrowhead bottom-left */}
          <path d="M20 37 L18 32 L23 33" fill={`url(#${id}-grad)`} />
        </g>

        {/* Central diamond — the transformation point */}
        <rect
          x="26"
          y="26"
          width="12"
          height="12"
          rx="2"
          fill={`url(#${id}-grad)`}
          transform="rotate(45 32 32)"
          className={animated ? 'convertix-diamond' : ''}
        />

        {/* Processing dots */}
        <circle cx="32" cy="19" r="1.5" fill="#a5b4fc" className={animated ? 'convertix-node convertix-node-1' : ''} />
        <circle cx="45" cy="32" r="1.5" fill="#c4b5fd" className={animated ? 'convertix-node convertix-node-2' : ''} />
        <circle cx="32" cy="45" r="1.5" fill="#818cf8" className={animated ? 'convertix-node convertix-node-3' : ''} />
        <circle cx="19" cy="32" r="1.5" fill="#a5b4fc" className={animated ? 'convertix-node convertix-node-4' : ''} />

        {/* Orbital ring (visible only in animated/loader mode) */}
        {animated && (
          <circle
            cx="32"
            cy="32"
            r="28"
            stroke={`url(#${id}-grad)`}
            strokeWidth="2"
            strokeDasharray="12 8"
            fill="none"
            className="convertix-orbit"
          />
        )}
      </svg>
    </div>
  );
}

/**
 * ConvertixLoader — Full-page branded loader with text.
 * Provides a premium loading experience.
 *
 * @param {string} message - Optional loading message
 * @param {number} size    - Logo size (default: 48)
 */
export function ConvertixLoader({ message = 'Loading...', size = 48 }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 animate-in-fade">
        <ConvertixLogo size={size} animated />
        <p className="text-sm text-muted-foreground font-medium tracking-wider uppercase animate-pulse">
          {message}
        </p>
      </div>
    </div>
  );
}
