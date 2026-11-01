import React from 'react';
import { Composition } from 'remotion';
import timeline from './timeline.json';
import { Ad } from './Ad';

export const Root: React.FC = () => (
  <>
    <Composition id="WattrixWide" component={Ad} durationInFrames={timeline.total} fps={timeline.fps} width={1920} height={1080} />
    <Composition id="WattrixTall" component={Ad} durationInFrames={timeline.total} fps={timeline.fps} width={1080} height={1920} />
  </>
);
