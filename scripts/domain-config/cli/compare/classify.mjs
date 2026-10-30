// dc:compare の分類（純粋。ファイルの読み取りは呼び出し側が渡す）。
// 1 ファイルを「今のファイル ／ base（fork の merge-base）の生成器の出力 ／ 今の生成器の出力」で比べて欄に振り分け、
// ドメインごとに集計して true に上げられる見込みを 1 語で出す。
// base の出力と違うファイルは「手の変更」か「古い生成物（base より前の生成器の出力のまま）」で、中身だけでは区別できない。
// 行を挿しただけの変更のかたまり（消した行の無い hunk）があれば手の変更の見込み（hand）、消した・置き換えただけなら
// 古い生成物の見込み（stale。上流が後で足した・書き換えた行が、古い出力のままのファイルに無い形）として分ける。

/** 行の差分の大きさ: 足した行・消した行・変更のかたまり（hunk）の数・挿しただけの hunk の数（LCS。大きすぎるファイルは行数の差だけ） */
export function diffStats(before, after) {
  const a = before.split("\n");
  const b = after.split("\n");
  if (a.length * b.length > 4_000_000) {
    const added = Math.max(0, b.length - a.length);
    return { added, removed: Math.max(0, a.length - b.length), hunks: 1, insertOnly: added > 0 ? 1 : 0 };
  }
  const dp = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let i = 0;
  let j = 0;
  let added = 0;
  let removed = 0;
  let hunks = 0;
  let insertOnly = 0;
  let hunk = null;
  const close = () => {
    if (hunk && hunk.removed === 0 && hunk.added > 0) insertOnly++;
    hunk = null;
  };
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
      close();
      continue;
    }
    if (!hunk) {
      hunks++;
      hunk = { added: 0, removed: 0 };
    }
    if (j < b.length && (i >= a.length || dp[i][j + 1] >= dp[i + 1][j])) {
      added++;
      hunk.added++;
      j++;
    } else {
      removed++;
      hunk.removed++;
      i++;
    }
  }
  close();
  return { added, removed, hunks, insertOnly };
}

const ENTRY = /(\/page\.tsx|\/_screen\/[^/]+|\/domainEntry\.ts)$/;

/**
 * 1 ファイルの分類
 * @param {{ path: string, current: string | null, base: string | null, now: string | null, baseListed: boolean, nowListed: boolean, nowAction?: string }} f
 *   current = 今のファイル（無ければ null）、base / now = 各生成器の出力（扱わなければ listed = false）
 * @returns {{ kind: "untouched" | "hand" | "stale" | "new" | "keep", upstreamChanges: boolean, entry: boolean, tableRewrite: boolean, stats?: object }}
 */
export function classifyFile(f) {
  const tableRewrite = f.path.endsWith("/entities/drizzle.ts") && f.nowListed && f.now !== null && f.now !== f.current;
  const upstreamChanges = f.nowListed && f.now !== null && f.now !== f.current;
  if (f.current === null) return { kind: "new", upstreamChanges: false, entry: ENTRY.test(f.path), tableRewrite: f.path.endsWith("/entities/drizzle.ts") };
  // write-once（今の生成器が既存を残す）は手の変更があっても上書きされない
  if (f.nowAction === "保持") return { kind: "keep", upstreamChanges: false, entry: false, tableRewrite: false };
  const reference = f.baseListed && f.base !== null ? f.base : f.nowListed ? f.now : null;
  if (reference === null || reference === f.current) return { kind: "untouched", upstreamChanges, entry: false, tableRewrite };
  const stats = diffStats(reference, f.current);
  return { kind: stats.insertOnly > 0 ? "hand" : "stale", upstreamChanges, entry: false, tableRewrite, stats };
}

/**
 * ドメインの集計と見込み
 * @param {{ files: { path: string, result: ReturnType<typeof classifyFile> }[], forkFiles: string[], wrapperFiles: string[], nowError?: string | null, baseError?: string | null }} domain
 */
export function summarizeDomain(domain) {
  const count = (kind) => domain.files.filter((f) => f.result.kind === kind).length;
  const hand = domain.files.filter((f) => f.result.kind === "hand");
  const sum = (key) => hand.reduce((total, f) => total + f.result.stats[key], 0);
  const summary = {
    untouched: count("untouched"),
    upstreamChanges: domain.files.filter((f) => f.result.kind === "untouched" && f.result.upstreamChanges).length,
    hand: { files: hand.length, added: sum("added"), removed: sum("removed"), hunks: sum("hunks") },
    stale: count("stale"),
    keep: count("keep"),
    newFiles: count("new"),
    newEntries: domain.files.filter((f) => f.result.kind === "new" && f.result.entry).map((f) => f.path),
    tableRewrite: domain.files.some((f) => f.result.tableRewrite),
    forkFiles: domain.forkFiles.length,
    wrapperFiles: domain.wrapperFiles.length,
    nowError: domain.nowError ?? null,
    baseError: domain.baseError ?? null,
  };
  summary.verdict = summary.nowError
    ? "直してから"
    : summary.hand.files > 0
      ? "wrappers へ移すか false"
      : summary.newEntries.length > 0 || summary.tableRewrite || summary.stale > 0
        ? "確かめて true"
        : "true にできる";
  return summary;
}

export const VERDICTS = ["true にできる", "確かめて true", "wrappers へ移すか false", "直してから"];
