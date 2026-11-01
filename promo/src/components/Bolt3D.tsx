import React from 'react';
import { C } from '../theme';

const POINTS = '24,4 44,28 32,28 48,60 20,32 34,32';
const LAYERS = 18;

/** The Wattrix bolt, extruded by stacking layers along Z. */
export const Bolt3D: React.FC<{ size: number; rotY: number; rotX?: number; glow?: number }> = ({ size, rotY, rotX = 0, glow = 1 }) => {
  const depth = size * 0.012;
  return (
    <div style={{ width: size, height: size, perspective: size * 4 }}>
      <div style={{ width: size, height: size, position: 'relative', transformStyle: 'preserve-3d', transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)` }}>
        {Array.from({ length: LAYERS }, (_, i) => {
          const back = LAYERS - 1 - i; // render back to front
          const isFront = back === 0;
          const shade = 0.25 + 0.5 * (1 - back / LAYERS);
          return (
            <svg
              key={i}
              viewBox="0 0 64 64"
              width={size}
              height={size}
              style={{
                position: 'absolute',
                inset: 0,
                transform: `translateZ(${(LAYERS / 2 - back) * depth}px)`,
                filter: isFront ? `drop-shadow(0 0 ${size * 0.08 * glow}px ${C.violet}aa)` : undefined,
              }}
            >
              <defs>
                <linearGradient id={`bg${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor={C.violet} />
                  <stop offset="1" stopColor={C.mint} />
                </linearGradient>
              </defs>
              <polygon points={POINTS} fill={isFront ? `url(#bg${i})` : `rgb(${Math.round(40 * shade)},${Math.round(70 * shade)},${Math.round(150 * shade)})`} />
            </svg>
          );
        })}
      </div>
    </div>
  );
};
