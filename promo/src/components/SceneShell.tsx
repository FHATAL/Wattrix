import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';

/** Camera push: each scene arrives from depth and leaves through the lens. */
export const SceneShell: React.FC<{ duration: number; children: React.ReactNode; enter?: number; exit?: number }> = ({
  duration,
  children,
  enter = 14,
  exit = 12,
}) => {
  const f = useCurrentFrame();
  const inP = interpolate(f, [0, enter], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const outP = interpolate(f, [duration - exit, duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });
  const z = -700 * (1 - inP) + 520 * outP;
  const opacity = Math.min(inP, 1 - outP);
  const blur = 10 * (1 - inP) + 14 * outP;
  return (
    <AbsoluteFill style={{ perspective: 1200 }}>
      <AbsoluteFill style={{ transform: `translateZ(${z}px)`, opacity, filter: blur > 0.3 ? `blur(${blur}px)` : undefined, transformStyle: 'preserve-3d' }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
