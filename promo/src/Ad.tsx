import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import timeline from './timeline.json';
import { loadFonts } from './fonts';
import { Backdrop } from './components/Backdrop';
import { Hook } from './scenes/Hook';
import { Taper } from './scenes/Taper';
import { Features } from './scenes/Features';
import { Proof } from './scenes/Proof';
import { Cta } from './scenes/Cta';

loadFonts();

const S = timeline.scenes;
const CUTS = [S.taper.from, S.features.from, S.proof.from, S.cta.from];

/** Brief light bloom on each scene change, sells the camera punch-through. */
const CutFlash: React.FC = () => {
  const f = useCurrentFrame();
  const o = Math.max(0, ...CUTS.map((c) => interpolate(f, [c - 3, c, c + 8], [0, 0.22, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));
  return <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 50%, rgba(160,140,255,1), rgba(56,251,208,.3) 60%, transparent)', opacity: o, mixBlendMode: 'screen' }} />;
};

export const Ad: React.FC = () => {
  const f = useCurrentFrame();
  // Speed up the floor during transitions for a sense of travel.
  const boost = Math.max(...CUTS.map((c) => interpolate(f, [c - 10, c, c + 14], [1, 4, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));
  return (
    <AbsoluteFill style={{ backgroundColor: '#050507' }}>
      <Backdrop speed={boost} />
      <Sequence from={S.hook.from} durationInFrames={S.hook.duration}>
        <Hook duration={S.hook.duration} />
      </Sequence>
      <Sequence from={S.taper.from} durationInFrames={S.taper.duration}>
        <Taper duration={S.taper.duration} />
      </Sequence>
      <Sequence from={S.features.from} durationInFrames={S.features.duration}>
        <Features duration={S.features.duration} each={timeline.featureEach} />
      </Sequence>
      <Sequence from={S.proof.from} durationInFrames={S.proof.duration}>
        <Proof duration={S.proof.duration} />
      </Sequence>
      <Sequence from={S.cta.from} durationInFrames={S.cta.duration}>
        <Cta duration={S.cta.duration} />
      </Sequence>
      <CutFlash />
      <Audio src={staticFile('audio/sfx.wav')} />
    </AbsoluteFill>
  );
};
