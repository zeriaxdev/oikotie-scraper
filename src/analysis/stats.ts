// Pure statistics helpers. No dependencies, no I/O.

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Quantile of an already-sorted array, linear interpolation. */
export function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! * (hi - pos) + sorted[hi]! * (pos - lo);
}

export function quantile(xs: number[], q: number): number {
  return quantileSorted([...xs].sort((a, b) => a - b), q);
}

export function median(xs: number[]): number {
  return quantile(xs, 0.5);
}

/**
 * Median absolute deviation, scaled by 1.4826 so it estimates the
 * standard deviation under normality. Robust to outliers.
 */
export function madSigma(xs: number[], center = median(xs)): number {
  const deviations = xs.map((x) => Math.abs(x - center));
  return 1.4826 * median(deviations);
}

/** Fraction of values strictly below x (0..1). */
export function percentileRank(xs: number[], x: number): number {
  if (xs.length === 0) return NaN;
  let below = 0;
  let equal = 0;
  for (const v of xs) {
    if (v < x) below++;
    else if (v === x) equal++;
  }
  // midrank for ties
  return (below + equal / 2) / xs.length;
}

/**
 * Solve A·x = b via Gaussian elimination with partial pivoting.
 * A is modified in place. Throws on a singular system.
 */
export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const x = [...b];

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row]![col]!) > Math.abs(A[pivot]![col]!)) pivot = row;
    }
    if (Math.abs(A[pivot]![col]!) < 1e-12) {
      throw new Error("Singular system in OLS solve");
    }
    if (pivot !== col) {
      [A[col], A[pivot]] = [A[pivot]!, A[col]!];
      [x[col], x[pivot]] = [x[pivot]!, x[col]!];
    }
    for (let row = col + 1; row < n; row++) {
      const factor = A[row]![col]! / A[col]![col]!;
      if (factor === 0) continue;
      for (let k = col; k < n; k++) {
        A[row]![k]! -= factor * A[col]![k]!;
      }
      x[row]! -= factor * x[col]!;
    }
  }

  for (let row = n - 1; row >= 0; row--) {
    let sum = x[row]!;
    for (let k = row + 1; k < n; k++) {
      sum -= A[row]![k]! * x[k]!;
    }
    x[row] = sum / A[row]![row]!;
  }

  return x;
}

export type OlsResult = {
  beta: number[];
  residuals: number[];
  r2: number;
  /** Residual standard deviation. */
  sigma: number;
};

/**
 * Ordinary least squares via normal equations with a tiny ridge term
 * for numerical stability when dummies are sparse.
 */
export function olsFit(X: number[][], y: number[], ridge = 1e-6): OlsResult {
  const n = X.length;
  const p = X[0]!.length;

  const XtX: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const Xty = new Array<number>(p).fill(0);

  for (let i = 0; i < n; i++) {
    const row = X[i]!;
    const yi = y[i]!;
    for (let j = 0; j < p; j++) {
      const xij = row[j]!;
      Xty[j]! += xij * yi;
      for (let k = j; k < p; k++) {
        XtX[j]![k]! += xij * row[k]!;
      }
    }
  }
  for (let j = 0; j < p; j++) {
    for (let k = 0; k < j; k++) XtX[j]![k] = XtX[k]![j]!;
    XtX[j]![j]! += ridge;
  }

  const beta = solveLinearSystem(XtX, Xty);

  const yMean = mean(y);
  let ssRes = 0;
  let ssTot = 0;
  const residuals = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let pred = 0;
    const row = X[i]!;
    for (let j = 0; j < p; j++) pred += beta[j]! * row[j]!;
    const r = y[i]! - pred;
    residuals[i] = r;
    ssRes += r * r;
    ssTot += (y[i]! - yMean) ** 2;
  }

  return {
    beta,
    residuals,
    r2: ssTot > 0 ? 1 - ssRes / ssTot : 0,
    sigma: Math.sqrt(ssRes / Math.max(1, n - p)),
  };
}

const SPARK_CHARS = "▁▂▃▄▅▆▇█";

/** Histogram sparkline between the 1st and 99th percentile. */
export function sparkline(values: number[], bins = 24): string {
  if (values.length === 0) return "";
  const sorted = [...values].sort((a, b) => a - b);
  const lo = quantileSorted(sorted, 0.01);
  const hi = quantileSorted(sorted, 0.99);
  if (hi <= lo) return SPARK_CHARS[0]!.repeat(bins);

  const counts = new Array<number>(bins).fill(0);
  for (const v of sorted) {
    if (v < lo || v > hi) continue;
    const idx = Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo)) * bins));
    counts[idx]!++;
  }
  const max = Math.max(...counts);
  return counts
    .map((cnt) => SPARK_CHARS[cnt === 0 ? 0 : Math.min(7, 1 + Math.floor((cnt / max) * 6.999))])
    .join("");
}
