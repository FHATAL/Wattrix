import React from 'react';
import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, F, GRAD, SITE } from '../theme';
import { useLayout } from '../layout';
import { SceneShell } from '../components/SceneShell';

const CHIPS = ['Free, no paywall', 'No sign-up', 'Works offline', '48 car presets', 'Installs as an app'];

const Check: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.mint} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const Proof: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { tall } = useLayout();

  const win = spring({ frame: f - 2, fps, config: { damping: 17, mass: 1.1 } });
  const head = spring({ frame: f - 4, fps, config: { damping: 16 } });
  const bw = tall ? 920 : 1060;
  const bh = (bw * 1800) / 2880 + 52;

  const browser = (
    <div style={{ perspective: 1800 }}>
      <div
        style={{
          width: bw,
          height: bh,
          borderRadius: 22,
          overflow: 'hidden',
          background: '#0b0d14',
          border: '1px solid rgba(255,255,255,.12)',
          boxShadow: `0 60px 140px rgba(0,0,0,.75), 0 0 90px ${C.violet}33`,
          transform: `translateZ(${-900 * (1 - win)}px) rotateY(${(tall ? 0 : -16) + 40 * (1 - win) + Math.sin(f / 30) * 2}deg) rotateX(${(tall ? 12 : 8) + 20 * (1 - win)}deg)`,
          opacity: Math.min(1, win * 1.3),
        }}
      >
        <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', background: '#11131c', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          {['#f4515b', '#f5a524', '#38fbd0'].map((c) => (
            <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c, opacity: 0.8 }} />
          ))}
          <div style={{ marginLeft: 18, flex: 1, height: 32, borderRadius: 10, background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', padding: '0 16px', fontFamily: F.mono, fontSize: 18, color: C.muted }}>
            {SITE}
          </div>
        </div>
        <Img src={staticFile('shots/desktop-home.png')} style={{ width: '100%', display: 'block' }} />
      </div>
    </div>
  );

  const chips = (
    <div style={{ display: 'flex', flexDirection: tall ? 'row' : 'column', flexWrap: 'wrap', justifyContent: tall ? 'center' : 'flex-start', gap: tall ? 18 : 16 }}>
      {CHIPS.map((c, i) => {
        const s = spring({ frame: f - 16 - i * 8, fps, config: { damping: 13 } });
        return (
          <div
            key={c}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: tall ? '16px 26px' : '14px 24px',
              borderRadius: 999,
              background: 'rgba(16,19,32,.88)',
              border: '1px solid rgba(255,255,255,.1)',
              fontFamily: F.body,
              fontWeight: 600,
              fontSize: tall ? 34 : 30,
              color: C.text,
              alignSelf: tall ? undefined : 'flex-start',
              transform: `perspective(800px) translateZ(${-400 * (1 - s)}px) rotateY(${(tall ? 0 : 60) * (1 - s)}deg) rotateX(${(tall ? 60 : 0) * (1 - s)}deg)`,
              opacity: Math.min(1, s * 1.5),
            }}
          >
            <Check size={tall ? 30 : 26} />
            {c}
          </div>
        );
      })}
    </div>
  );

  const headline = (
    <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: tall ? 84 : 72, lineHeight: 1.04, letterSpacing: '-0.035em', color: C.text, transform: `translateY(${30 * (1 - head)}px)`, opacity: head, textAlign: tall ? 'center' : 'left' }}>
      Runs in your browser.
      <br />
      <span style={{ backgroundImage: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Nothing leaves it.</span>
    </div>
  );

  if (tall) {
    return (
      <SceneShell duration={duration}>
        <AbsoluteFill style={{ padding: '200px 70px 300px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 60 }}>
          {headline}
          {browser}
          {chips}
        </AbsoluteFill>
      </SceneShell>
    );
  }
  return (
    <SceneShell duration={duration}>
      <AbsoluteFill style={{ padding: '0 110px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 60 }}>
        <div style={{ width: 620, display: 'flex', flexDirection: 'column', gap: 40 }}>
          {headline}
          {chips}
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>{browser}</div>
      </AbsoluteFill>
    </SceneShell>
  );
};
