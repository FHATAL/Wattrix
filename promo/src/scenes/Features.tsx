import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, F, GRAD } from '../theme';
import { useLayout } from '../layout';
import { SceneShell } from '../components/SceneShell';

type Feature = { tag: string; title: string; sub: string; stat: string; shot: string };

// Every stat below is the calculator's own output for the scenario in scripts/capture.mjs,
// or a figure the site publishes (llms.txt / reference tables).
const FEATURES: Feature[] = [
  { tag: '01  TRIP', title: 'Will I make it?', sub: 'Stops, charging time and cost, door to door.', stat: '610 km, -5 °C: 2 stops, 52 min', shot: 'shots/trip-card.png' },
  { tag: '02  CHARGE', title: 'How long, really?', sub: 'Session time on a real taper curve, not a guess.', stat: '10-80% on 150 kW: 26 min', shot: 'shots/charge-card.png' },
  { tag: '03  RANGE', title: "Today's range.", sub: 'Cold, speed, load and tyres, multiplied together.', stat: '75 kWh at -10 °C: 322 km, not 429', shot: 'shots/range-card.png' },
  { tag: '04  EV VS FUEL', title: 'What it saves.', sub: 'Cost per 100 km against petrol or diesel.', stat: 'Example: €4.96 vs €12.25 / 100 km', shot: 'shots/compare-card.png' },
];

const STEP = 46; // degrees between cards on the ring

export const Features: React.FC<{ duration: number; each: number }> = ({ duration, each }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { tall } = useLayout();

  // Continuous carousel position: 0 -> 3, each step eased with a spring.
  let pos = 0;
  for (let k = 1; k < FEATURES.length; k++) pos += spring({ frame: f - k * each + 4, fps, config: { damping: 16, mass: 0.9 }, durationInFrames: 24 });
  const intro = spring({ frame: f, fps, config: { damping: 18 } });
  const active = Math.min(FEATURES.length - 1, Math.floor(f / each));
  const local = f - active * each;

  const cw = tall ? 680 : 520;
  const ch = tall ? 820 : 640;
  const R = tall ? 980 : 1050;

  const ring = (
    <div style={{ position: 'relative', width: cw, height: ch, perspective: 2000 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformStyle: 'preserve-3d',
          transform: `translateZ(${-R - 500 * (1 - intro)}px) rotateX(${-6 + 4 * Math.sin(f / 40)}deg) rotateY(${-pos * STEP + 30 * (1 - intro)}deg)`,
        }}
      >
        {FEATURES.map((ft, i) => {
          const d = i - pos;
          const focus = 1 - Math.min(1, Math.abs(d));
          // Cards that have had their turn fade out as they swing past the copy.
          const vis = interpolate(d, [-0.9, -0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const glowOn = i === active ? interpolate(local, [18, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
          const pulse = 0.6 + 0.4 * Math.sin(f / 5);
          return (
            <div
              key={ft.tag}
              style={{
                position: 'absolute',
                inset: 0,
                transform: `rotateY(${i * STEP}deg) translateZ(${R}px)`,
                borderRadius: 30,
                overflow: 'hidden',
                background: C.card,
                border: `1px solid rgba(255,255,255,${0.08 + 0.12 * focus})`,
                boxShadow: `0 50px 120px rgba(0,0,0,.7), 0 0 ${60 * focus}px ${C.violet}55`,
                filter: `brightness(${0.35 + 0.65 * focus})`,
                opacity: vis,
                backfaceVisibility: 'hidden',
              }}
            >
              <Img src={staticFile(ft.shot)} style={{ width: '100%', display: 'block' }} />
              {/* sheen */}
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(${115 + d * 30}deg, rgba(255,255,255,.10) 0%, transparent 35%)` }} />
              {/* bottom fade so the crop reads as intentional */}
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, background: `linear-gradient(transparent, ${C.card})` }} />
              {/* spotlight on the headline numbers */}
              <div
                style={{
                  position: 'absolute',
                  left: cw * 0.035,
                  width: cw * 0.93,
                  top: cw * 0.155,
                  height: cw * 0.225,
                  borderRadius: 18,
                  border: `3px solid ${C.mint}`,
                  boxShadow: `0 0 ${30 * pulse}px ${C.mint}, inset 0 0 ${20 * pulse}px ${C.mint}55`,
                  opacity: glowOn,
                  transform: `scale(${1.08 - 0.08 * glowOn})`,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  const ft = FEATURES[active];
  const tIn = spring({ frame: local - (active === 0 ? 8 : 10), fps, config: { damping: 15 } });
  const tOut = active < FEATURES.length - 1 ? interpolate(local, [each - 8, each], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) }) : 0;
  const statIn = spring({ frame: local - 22, fps, config: { damping: 14 } });

  const text = (
    <div
      key={active}
      style={{
        transformStyle: 'preserve-3d',
        transform: `perspective(1000px) translate3d(${tall ? 0 : -60 * tOut}px, ${50 * (1 - tIn)}px, 0) rotateX(${-40 * (1 - tIn) + 30 * tOut}deg)`,
        opacity: Math.min(tIn, 1 - tOut),
        textAlign: tall ? 'center' : 'left',
      }}
    >
      <div style={{ display: 'inline-block', fontFamily: F.mono, fontWeight: 700, fontSize: tall ? 26 : 22, letterSpacing: '0.2em', color: C.mint, padding: '8px 16px', border: `1px solid ${C.mint}55`, borderRadius: 999, background: `${C.mint}10` }}>
        {ft.tag}
      </div>
      <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: tall ? 100 : 96, lineHeight: 1.0, letterSpacing: '-0.04em', color: C.text, marginTop: 26 }}>{ft.title}</div>
      <div style={{ fontFamily: F.body, fontSize: tall ? 38 : 34, lineHeight: 1.35, color: C.muted, marginTop: 20, maxWidth: tall ? 900 : 640, marginInline: tall ? 'auto' : undefined }}>{ft.sub}</div>
      <div
        style={{
          display: 'inline-block',
          marginTop: 30,
          fontFamily: F.mono,
          fontWeight: 700,
          fontSize: tall ? 31 : 28,
          color: C.text,
          padding: '14px 22px',
          borderRadius: 14,
          background: 'rgba(16,19,32,.85)',
          borderLeft: `5px solid transparent`,
          borderImage: `${GRAD} 1`,
          transform: `translateX(${tall ? 0 : -30 * (1 - statIn)}px) scale(${0.9 + 0.1 * statIn})`,
          opacity: statIn,
        }}
      >
        {ft.stat}
      </div>
    </div>
  );

  if (tall) {
    return (
      <SceneShell duration={duration}>
        <AbsoluteFill style={{ padding: '180px 70px 0 70px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ height: 540, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', width: '100%' }}>{text}</div>
          <div style={{ marginTop: 20 }}>{ring}</div>
        </AbsoluteFill>
      </SceneShell>
    );
  }
  return (
    <SceneShell duration={duration}>
      <AbsoluteFill style={{ padding: '0 120px', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        <div style={{ width: 720 }}>{text}</div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>{ring}</div>
      </AbsoluteFill>
    </SceneShell>
  );
};
