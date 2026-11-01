import React from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion';
import { C } from '../theme';
import { useLayout } from '../layout';

const PARTICLES = Array.from({ length: 70 }, (_, i) => ({
  x: random(`px${i}`) * 2 - 1,
  y: random(`py${i}`) * 2 - 1,
  z: random(`pz${i}`),
  s: 2 + random(`ps${i}`) * 4,
  mint: random(`pc${i}`) > 0.5,
}));

/** Endless 3D grid floor, drifting glows and depth particles. Always on screen. */
export const Backdrop: React.FC<{ speed?: number }> = ({ speed = 1 }) => {
  const f = useCurrentFrame();
  const { W, H, tall } = useLayout();
  const travel = f * 7 * speed;
  const glowA = Math.sin(f / 70) * 0.5 + 0.5;
  const glowB = Math.cos(f / 90) * 0.5 + 0.5;
  const fadeIn = interpolate(f, [0, 18], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      {/* glows */}
      <div
        style={{
          position: 'absolute',
          width: W * 0.9,
          height: W * 0.9,
          left: W * (0.05 + glowA * 0.25) - W * 0.25,
          top: H * (tall ? 0.15 : 0.0) - W * 0.3,
          background: `radial-gradient(circle, ${C.violet}55 0%, transparent 62%)`,
          filter: 'blur(40px)',
          opacity: 0.9 * fadeIn,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: W * 0.8,
          height: W * 0.8,
          left: W * (0.55 - glowB * 0.2),
          top: H * (tall ? 0.55 : 0.35),
          background: `radial-gradient(circle, ${C.mint}33 0%, transparent 60%)`,
          filter: 'blur(50px)',
          opacity: 0.8 * fadeIn,
        }}
      />

      {/* grid floor */}
      <AbsoluteFill style={{ perspective: 700, perspectiveOrigin: `50% ${tall ? 42 : 30}%`, opacity: fadeIn }}>
        <div
          style={{
            position: 'absolute',
            left: -W * 1.5,
            width: W * 4,
            top: H * (tall ? 0.62 : 0.58),
            height: H * 2.4,
            transformOrigin: '50% 0%',
            transform: 'rotateX(80deg)',
            backgroundImage: `linear-gradient(${C.violet}66 2px, transparent 2px), linear-gradient(90deg, ${C.violet}55 2px, transparent 2px)`,
            backgroundSize: '140px 140px',
            backgroundPosition: `0px ${travel}px`,
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.9) 22%, #000 60%)',
          }}
        />
        {/* ceiling, fainter */}
        <div
          style={{
            position: 'absolute',
            left: -W * 1.5,
            width: W * 4,
            bottom: H * (tall ? 0.62 : 0.66),
            height: H * 2.4,
            transformOrigin: '50% 100%',
            transform: 'rotateX(-80deg)',
            backgroundImage: `linear-gradient(${C.mint}22 2px, transparent 2px), linear-gradient(90deg, ${C.mint}1c 2px, transparent 2px)`,
            backgroundSize: '140px 140px',
            backgroundPosition: `0px ${-travel}px`,
            WebkitMaskImage: 'linear-gradient(to top, transparent 0%, rgba(0,0,0,.6) 25%, #000 70%)',
          }}
        />
      </AbsoluteFill>

      {/* horizon glow line */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: H * (tall ? 0.62 : 0.58) - 2,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${C.violet}, ${C.mint}, transparent)`,
          boxShadow: `0 0 40px 8px ${C.violet}66`,
          opacity: 0.35 * fadeIn,
        }}
      />

      {/* particles flying toward camera */}
      <AbsoluteFill style={{ perspective: 900, opacity: fadeIn }}>
        <div style={{ position: 'absolute', left: W / 2, top: H / 2, transformStyle: 'preserve-3d' }}>
          {PARTICLES.map((p, i) => {
            const z = (((p.z * 2400 + travel * 1.6) % 2400) + 2400) % 2400 - 2000;
            const op = interpolate(z, [-2000, -1400, 200, 400], [0, 0.9, 0.9, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  width: p.s,
                  height: p.s,
                  borderRadius: '50%',
                  background: p.mint ? C.mint : C.violet,
                  boxShadow: `0 0 ${p.s * 3}px ${p.mint ? C.mint : C.violet}`,
                  transform: `translate3d(${p.x * W}px, ${p.y * H}px, ${z}px)`,
                  opacity: op,
                }}
              />
            );
          })}
        </div>
      </AbsoluteFill>

      {/* vignette */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,.75) 100%)' }} />
    </AbsoluteFill>
  );
};
