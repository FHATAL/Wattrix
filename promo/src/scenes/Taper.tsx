import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, F, GRAD } from '../theme';
import { useLayout } from '../layout';
import { SceneShell } from '../components/SceneShell';
import { cumulativeTime, dcFactor } from '../taper';

const VW = 1000;
const VH = 560;
const X = (soc: number) => 70 + soc * 9.0;
const Y = (factor: number) => 480 - factor * 400;
const FROM = 10;
const TO = 80;
const PEAK = 150;
const REAL_MIN = 26; // calculator output for 75 kWh, 10->80%, 150 kW DC, 20 C
const NAIVE_MIN = Math.round(((75 * (TO - FROM)) / 100 / PEAK) * 60); // 21

const curvePts: Array<[number, number]> = [];
for (let s = 0; s <= 100; s += 1) curvePts.push([X(s), Y(dcFactor(s))]);
const linePath = 'M ' + curvePts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ');
const areaPath = `${linePath} L ${X(100)} ${Y(0)} L ${X(0)} ${Y(0)} Z`;
const TOTAL_T = cumulativeTime(FROM, TO);

export const Taper: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { tall } = useLayout();

  const p = interpolate(f, [16, 96], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const soc = FROM + (TO - FROM) * p;
  const kw = Math.round(PEAK * dcFactor(soc));
  const mins = Math.round((REAL_MIN * cumulativeTime(FROM, soc)) / TOTAL_T);
  const chartIn = spring({ frame: f - 2, fps, config: { damping: 18 } });
  const verdict = spring({ frame: f - 102, fps, config: { damping: 12 } });
  const head = spring({ frame: f - 6, fps, config: { damping: 16 } });

  const rotY = (tall ? -14 : -24) + 14 * p;
  const rotX = 20 - 6 * p;
  const chartW = tall ? 980 : 1000;

  const layers = 12;
  const markerX = X(soc);
  const markerY = Y(dcFactor(soc));

  const Readout = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: tall ? 250 : 210 }}>
      <div style={{ fontFamily: F.mono, fontSize: tall ? 24 : 20, letterSpacing: '0.18em', color: C.dim, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: tall ? 60 : 54, color: accent ?? C.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );

  const headline = (
    <div style={{ transform: `translateY(${40 * (1 - head)}px)`, opacity: head }}>
      <div style={{ fontFamily: F.mono, fontSize: tall ? 26 : 22, letterSpacing: '0.22em', color: C.mint, marginBottom: 18 }}>THE TAPER CURVE</div>
      <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: tall ? 92 : 84, lineHeight: 1.02, letterSpacing: '-0.035em', color: C.text }}>
        Wattrix models
        <br />
        <span style={{ backgroundImage: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>the slowdown.</span>
      </div>
      <div style={{ fontFamily: F.body, fontSize: tall ? 36 : 32, lineHeight: 1.35, color: C.muted, marginTop: 22, maxWidth: tall ? 900 : 640 }}>
        Every session walked in 0.5% steps, at the power your car really takes.
      </div>
    </div>
  );

  const readouts = (
    <div style={{ display: 'flex', gap: tall ? 30 : 36, justifyContent: tall ? 'center' : 'flex-start', opacity: chartIn }}>
      <Readout label="Battery" value={`${Math.round(soc)}%`} />
      <Readout label="Power" value={`${kw} kW`} accent={C.mint} />
      <Readout label="Time" value={`${mins} min`} accent={C.cyan} />
    </div>
  );

  const verdictCard = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 26,
        padding: tall ? '26px 34px' : '22px 30px',
        borderRadius: 22,
        background: 'rgba(16,19,32,.85)',
        border: `1px solid ${C.mint}55`,
        boxShadow: `0 20px 60px rgba(0,0,0,.5), 0 0 40px ${C.mint}22`,
        transform: `perspective(900px) translateZ(${-300 * (1 - verdict)}px) rotateX(${50 * (1 - verdict)}deg)`,
        opacity: Math.min(1, verdict * 1.5),
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontFamily: F.mono, fontSize: tall ? 20 : 18, letterSpacing: '0.16em', color: C.danger }}>KWH÷KW SAYS</div>
        <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: tall ? 34 : 30, color: C.muted, textDecoration: 'line-through', textDecorationColor: C.danger, textDecorationThickness: 2 }}>{NAIVE_MIN} min</div>
      </div>
      <div style={{ width: 2, alignSelf: 'stretch', background: C.line }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontFamily: F.mono, fontSize: tall ? 20 : 18, letterSpacing: '0.16em', color: C.mint }}>WATTRIX SAYS</div>
        <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: tall ? 44 : 40, color: C.mint }}>{REAL_MIN} min</div>
      </div>
    </div>
  );

  const chart = (
    <div style={{ perspective: 1600, width: chartW, height: (chartW * VH) / VW }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transform: `translateZ(${-500 * (1 - chartIn)}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          opacity: chartIn,
        }}
      >
        {/* glass panel */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 28,
            background: 'linear-gradient(160deg, rgba(22,26,44,.92), rgba(10,11,18,.92))',
            border: '1px solid rgba(255,255,255,.1)',
            boxShadow: `0 40px 120px rgba(0,0,0,.6), 0 0 80px ${C.violet}22`,
            transform: 'translateZ(-80px)',
          }}
        />
        {/* extrusion layers of the area */}
        {Array.from({ length: layers }, (_, i) => (
          <svg key={i} viewBox={`0 0 ${VW} ${VH}`} style={{ position: 'absolute', inset: 0, transform: `translateZ(${-i * 6}px)` }}>
            <defs>
              <clipPath id={`clip${i}`}>
                <rect x={0} y={0} width={markerX} height={VH} />
              </clipPath>
            </defs>
            <path d={areaPath} fill={i === 0 ? `${C.mint}30` : `rgba(56,251,208,${0.07 * (1 - i / layers)})`} clipPath={`url(#clip${i})`} />
          </svg>
        ))}
        {/* axes, ghost curve, live curve */}
        <svg viewBox={`0 0 ${VW} ${VH}`} style={{ position: 'absolute', inset: 0, transform: 'translateZ(2px)', overflow: 'visible' }}>
          <defs>
            <linearGradient id="lg" x1="0" x2="1">
              <stop offset="0" stopColor={C.violet} />
              <stop offset="1" stopColor={C.mint} />
            </linearGradient>
            <clipPath id="liveclip">
              <rect x={0} y={0} width={markerX} height={VH} />
            </clipPath>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <line key={g} x1={X(0)} x2={X(100)} y1={Y(g)} y2={Y(g)} stroke="rgba(255,255,255,.07)" strokeWidth={2} />
          ))}
          {/* charge window */}
          <rect x={X(FROM)} y={Y(1.05)} width={X(TO) - X(FROM)} height={Y(0) - Y(1.05)} fill="rgba(117,89,255,.06)" />
          <path d={linePath} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={3} strokeDasharray="8 10" />
          <path d={linePath} fill="none" stroke="url(#lg)" strokeWidth={7} strokeLinejoin="round" clipPath="url(#liveclip)" style={{ filter: `drop-shadow(0 0 10px ${C.mint})` }} />
          {/* naive flat line (kWh / kW assumption) */}
          <line x1={X(FROM)} x2={X(TO)} y1={Y(1)} y2={Y(1)} stroke={C.danger} strokeWidth={3} strokeDasharray="4 10" opacity={0.7 * Math.min(1, p * 3)} />
          <text x={X(TO) + 16} y={Y(1) + 8} fill={C.danger} fontFamily="JetBrains Mono" fontSize={22} opacity={0.85 * Math.min(1, p * 3)}>
            kWh÷kW
          </text>
          {/* scan line + marker */}
          <line x1={markerX} x2={markerX} y1={Y(1.05)} y2={Y(0)} stroke={C.mint} strokeWidth={2} opacity={0.5} />
          <circle cx={markerX} cy={markerY} r={13} fill={C.bg} stroke={C.mint} strokeWidth={5} />
          <circle cx={markerX} cy={markerY} r={30} fill={C.mint} opacity={0.15} />
          {[0, 20, 40, 60, 80, 100].map((s) => (
            <text key={s} x={X(s)} y={Y(0) + 40} fill={C.dim} fontFamily="JetBrains Mono" fontSize={22} textAnchor="middle">
              {s}%
            </text>
          ))}
          <text x={X(0)} y={Y(1) - 18} fill={C.dim} fontFamily="JetBrains Mono" fontSize={22}>
            150 kW
          </text>
        </svg>
        {/* floating marker label, in front */}
        <div
          style={{
            position: 'absolute',
            left: `${(markerX / VW) * 100}%`,
            top: `${(markerY / VH) * 100}%`,
            transform: 'translate(-50%, -150%) translateZ(60px)',
            fontFamily: F.mono,
            fontWeight: 700,
            fontSize: 30,
            color: C.bg,
            background: C.mint,
            padding: '6px 14px',
            borderRadius: 10,
            boxShadow: `0 0 30px ${C.mint}88`,
            whiteSpace: 'nowrap',
          }}
        >
          {kw} kW
        </div>
      </div>
    </div>
  );

  if (tall) {
    return (
      <SceneShell duration={duration}>
        <AbsoluteFill style={{ padding: '200px 50px 300px 50px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 60 }}>
          <div style={{ alignSelf: 'stretch' }}>{headline}</div>
          <div style={{ marginTop: 10 }}>{chart}</div>
          {readouts}
          {verdictCard}
        </AbsoluteFill>
      </SceneShell>
    );
  }
  return (
    <SceneShell duration={duration}>
      <AbsoluteFill style={{ padding: '0 110px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 40 }}>
        <div style={{ width: 700, display: 'flex', flexDirection: 'column', gap: 44 }}>
          {headline}
          {readouts}
          {verdictCard}
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>{chart}</div>
      </AbsoluteFill>
    </SceneShell>
  );
};
