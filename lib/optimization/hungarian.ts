/**
 * Minimum-cost bipartite matching (Jonker-Volgenant flavored Hungarian
 * algorithm, O(n^3)) over a rectangular cost matrix. Rows are padded with
 * dummy zero-cost columns (or vice versa) so rows/cols need not be equal —
 * unmatched real rows/cols simply pair with a dummy and are filtered out by
 * the caller. This is the deterministic core of the Fay optimization
 * engine: no ML, no LLM, fully reproducible for a given input matrix.
 */
export function solveAssignment(costMatrix: number[][]): number[] {
  const nRows = costMatrix.length;
  if (nRows === 0) return [];
  const nCols = costMatrix[0].length;
  const n = Math.max(nRows, nCols);

  const BIG = 1_000_000;
  const a: number[][] = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= n; j++) {
      if (i <= nRows && j <= nCols) {
        a[i][j] = costMatrix[i - 1][j - 1];
      } else {
        a[i][j] = BIG;
      }
    }
  }

  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity);
    const used = new Array(n + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = -1;
      for (let j = 1; j <= n; j++) {
        if (!used[j]) {
          const cur = a[i0][j] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const rowToCol = new Array(nRows).fill(-1);
  for (let j = 1; j <= n; j++) {
    const i = p[j];
    if (i >= 1 && i <= nRows && j <= nCols) {
      rowToCol[i - 1] = j - 1;
    }
  }
  return rowToCol;
}
