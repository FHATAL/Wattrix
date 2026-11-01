import { useVideoConfig } from 'remotion';

export type Layout = { W: number; H: number; tall: boolean };

export function useLayout(): Layout {
  const { width, height } = useVideoConfig();
  return { W: width, H: height, tall: height > width };
}
