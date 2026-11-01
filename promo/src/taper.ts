// Same generic DC taper the calculator uses (assets/js/data.js -> dcCurve).
const dcCurve: Array<[number, number]> = [
  [0, 0.55], [5, 0.85], [10, 1.0], [35, 1.0], [45, 0.94],
  [55, 0.84], [65, 0.7], [75, 0.54], [85, 0.36], [92, 0.24], [100, 0.12],
];

export function dcFactor(soc: number): number {
  if (soc <= dcCurve[0][0]) return dcCurve[0][1];
  for (let i = 1; i < dcCurve.length; i++) {
    if (soc <= dcCurve[i][0]) {
      const [x0, y0] = dcCurve[i - 1];
      const [x1, y1] = dcCurve[i];
      return y0 + ((y1 - y0) * (soc - x0)) / (x1 - x0);
    }
  }
  return dcCurve[dcCurve.length - 1][1];
}

// Cumulative session time (arbitrary units) from `from` to soc, walked in 0.5% steps
// like the real engine. Used only for the shape of the on-screen timer.
export function cumulativeTime(from: number, soc: number): number {
  let t = 0;
  for (let s = from; s < soc; s += 0.5) t += 0.5 / dcFactor(s);
  return t;
}
