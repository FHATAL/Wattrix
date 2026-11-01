import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, F, GRAD, SITE } from '../theme';
import { useLayout } from '../layout';
import { SceneShell } from '../components/SceneShell';
import { Bolt3D } from '../components/Bolt3D';

const WORD = 'WATTRIX';

export const Cta: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { tall } = useLayout();

  const bolt = spring({ frame: f - 2, fps, config: { damping: 11, mass: 1.2 } });
  const rotY = -140 * (1 - bolt) + Math.sin(f / 22) * 14;
  const tag = spring({ frame: f - 26, fps, config: { damping: 16 } });
  const btn = spring({ frame: f - 34, fps, config: { damping: 12 } });
  const sweep = interpolate(f, [56, 80], [-0.4, 1.4], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ring = (f - 50) % 30;
  const ringP = f >= 50 ? ring / 30 : 0;
  const by = interpolate(f, [44, 58], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const boltSize = tall ? 300 : 250;

  return (
    <SceneShell duration={duration + 20} exit={1}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingBottom: tall ? 120 : 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ transform: `translateZ(0) scale(${0.4 + 0.6 * bolt})`, opacity: Math.min(1, bolt * 2) }}>
            <Bolt3D size={boltSize} rotY={rotY} rotX={8} glow={1 + 0.3 * Math.sin(f / 8)} />
          </div>

          <div style={{ display: 'flex', marginTop: tall ? 10 : 0, perspective: 900 }}>
            {WORD.split('').map((ch, i) => {
              const s = spring({ frame: f - 10 - i * 2.5, fps, config: { damping: 13 } });
              return (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    fontFamily: F.display,
                    fontWeight: 700,
                    fontSize: tall ? 150 : 150,
                    letterSpacing: '0.04em',
                    color: C.text,
                    transform: `translateZ(${-500 * (1 - s)}px) rotateY(${90 * (1 - s)}deg)`,
                    opacity: Math.min(1, s * 1.5),
                    textShadow: `0 0 50px ${C.violet}66`,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </div>

          <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: tall ? 46 : 42, color: C.muted, marginTop: 8, opacity: tag, transform: `translateY(${24 * (1 - tag)}px)`, textAlign: 'center', maxWidth: tall ? 880 : undefined }}>
            Know what the drive really costs.
          </div>

          <div style={{ position: 'relative', marginTop: tall ? 64 : 50, transform: `perspective(800px) translateZ(${-300 * (1 - btn)}px) rotateX(${60 * (1 - btn)}deg)`, opacity: Math.min(1, btn * 1.5) }}>
            {/* pulse ring */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: 999, border: `3px solid ${C.mint}`, transform: `scale(${1 + ringP * 0.35}, ${1 + ringP * 0.9})`, opacity: f >= 50 ? 0.7 * (1 - ringP) : 0 }} />
            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                padding: tall ? '30px 56px' : '26px 52px',
                borderRadius: 999,
                background: GRAD,
                boxShadow: `0 20px 70px ${C.violet}77, 0 0 50px ${C.mint}55`,
              }}
            >
              <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: tall ? 50 : 44, color: '#06070c', letterSpacing: '-0.01em' }}>Plan your drive free</span>
              <svg width={tall ? 44 : 40} height={tall ? 44 : 40} viewBox="0 0 24 24" fill="none" stroke="#06070c" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              <div style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', left: `${sweep * 100}%`, background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.65), transparent)', transform: 'skewX(-20deg)' }} />
            </div>
          </div>

          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: tall ? 64 : 58, color: C.text, marginTop: tall ? 44 : 34, letterSpacing: '0.02em', opacity: btn }}>
            {SITE}
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: tall ? 320 : 60, display: 'flex', alignItems: 'center', gap: 12, opacity: by, fontFamily: F.body, fontSize: tall ? 28 : 24, color: C.dim, letterSpacing: '0.04em' }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: C.ember, boxShadow: `0 0 14px ${C.ember}` }} />
          by <span style={{ color: C.muted, fontWeight: 600 }}>FHATAL</span> · Built in Finland
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
