import React from 'react';
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, F, GRAD } from '../theme';
import { useLayout } from '../layout';
import { SceneShell } from '../components/SceneShell';

const WORDS = ['Charging', 'slows', 'down', 'as', 'you', 'fill', 'up.'];
const HOT = new Set([1, 2]);

export const Hook: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { tall } = useLayout();

  const inS = spring({ frame: f - 4, fps, config: { damping: 14, mass: 0.9 } });
  const strike = interpolate(f, [40, 47], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const shake = f >= 42 && f < 50 ? (random(`sh${f}`) - 0.5) * 22 * (1 - (f - 42) / 8) : 0;
  const away = interpolate(f, [47, 57], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });

  const bigSize = tall ? 168 : 230;

  return (
    <SceneShell duration={duration} enter={1}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', perspective: 1100 }}>
        {/* Part 1: the wrong formula */}
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transformStyle: 'preserve-3d',
            transform: `translate3d(${shake}px, ${-120 * away}px, ${-900 * (1 - inS) - 600 * away}px) rotateX(${80 * (1 - inS) + 55 * away}deg)`,
            opacity: Math.min(1, inS * 1.4) * (1 - away),
          }}
        >
          <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: tall ? 46 : 44, color: C.muted, marginBottom: 18, letterSpacing: '0.01em' }}>
            Most EV calculators do this:
          </div>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                fontFamily: F.mono,
                fontWeight: 700,
                fontSize: bigSize,
                letterSpacing: '-0.03em',
                color: strike > 0.5 ? '#c7cdd8' : C.text,
                textShadow: `0 0 60px ${C.violet}88`,
                lineHeight: 1,
              }}
            >
              kWh ÷ kW
            </div>
            <div
              style={{
                position: 'absolute',
                left: -24,
                right: -24,
                top: '50%',
                height: tall ? 16 : 20,
                marginTop: -8,
                background: C.danger,
                borderRadius: 10,
                transformOrigin: '0% 50%',
                transform: `rotate(-3deg) scaleX(${strike})`,
                boxShadow: `0 0 30px ${C.danger}, 0 0 80px ${C.danger}88`,
              }}
            />
          </div>
        </div>

        {/* Part 2: the truth */}
        <div
          style={{
            position: 'absolute',
            width: tall ? 900 : 1500,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            columnGap: tall ? 28 : 34,
            rowGap: 0,
            transformStyle: 'preserve-3d',
          }}
        >
          {WORDS.map((w, i) => {
            const s = spring({ frame: f - 55 - i * 4, fps, config: { damping: 13, mass: 0.7 } });
            return (
              <span
                key={w}
                style={{
                  display: 'inline-block',
                  fontFamily: F.display,
                  fontWeight: 700,
                  fontSize: tall ? 128 : 124,
                  lineHeight: 1.08,
                  letterSpacing: '-0.035em',
                  color: C.text,
                  backgroundImage: HOT.has(i) ? GRAD : undefined,
                  WebkitBackgroundClip: HOT.has(i) ? 'text' : undefined,
                  WebkitTextFillColor: HOT.has(i) ? 'transparent' : undefined,
                  transformOrigin: '50% 100%',
                  transform: `translateZ(${-300 * (1 - s)}px) rotateX(${-95 * (1 - s)}deg)`,
                  opacity: Math.min(1, s * 1.6),
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
