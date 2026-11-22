// src/lib/pathPattern/index.mjs
// 住所のパターン照合(純粋関数)。門番の判定(src/featureGate/evaluate.ts)・ルート地図(src/lib/screens/routeMap.mjs)・pnpm test src/featureGate scripts/structure/proxies が共有する。詳細: ./README.md
//
// 書き方:
// - "/demo"   = セグメント境界の前方一致("/demo" と "/demo/**"。"/demo-login" は含まない)。末尾スラッシュは同義
// - "=/mypage" = そのパスちょうど。fork が同じ URL の下に足したページ("/mypage/<fork のページ>")を巻き込まない
// - "*"       = 区切り 1 つの空でない何でも("/wallet/*/purchase"。前方一致とも = とも組み合わせられる)。区切りの一部の *("/a*b")と ** は書けない(D41 (5))

/**
 * パターンが完全一致の書き方か
 * @param {string} pattern
 * @returns {boolean}
 */
export const isExactPattern = (pattern) => pattern.startsWith("=");

/** @param {string} pattern */
const normalize = (pattern) => {
  const body = isExactPattern(pattern) ? pattern.slice(1) : pattern;
  return body.length > 1 && body.endsWith("/") ? body.slice(0, -1) : body;
};

/** @param {string} pattern */
const segmentsOf = (pattern) => normalize(pattern).split("/").filter(Boolean);

/** パスの区切り(空の区切りは捨てる。"/" は区切り 0) */
const pathSegments = (/** @type {string} */ pathname) => pathname.split("/").filter(Boolean);

/**
 * パターンの書き方の誤り(無ければ null)。門番の規則の pathPatterns は生成で止める
 * @param {string} pattern
 * @returns {string | null}
 */
export function patternProblem(pattern) {
  const body = isExactPattern(pattern) ? pattern.slice(1) : pattern;
  if (!body.startsWith("/")) return `${pattern}: パターンは / で始める(完全一致は =/…)`;
  if (/\/\/./.test(body)) return `${pattern}: 空の区切り(//)は書けない`;
  for (const seg of segmentsOf(pattern)) {
    if (seg === "**") return `${pattern}: ** は書けない(前方一致は区切りの境界で効くので末尾の ** は要らない)`;
    if (seg.includes("*") && seg !== "*") return `${pattern}: 区切りの一部の * は書けない(* は区切り 1 つまるごと)`;
  }
  return null;
}

/**
 * パターンの細かさ(大きいほど細かい、D41 (5)): 区切りの数 → * の少なさ → = の有無。
 * 門番は当たった閉じた住所のうち一番細かい物を答えにする(src/featureGate/evaluate.ts)
 * @param {string} pattern
 * @returns {number}
 */
export function patternSpecificity(pattern) {
  const segments = segmentsOf(pattern);
  const stars = segments.filter((seg) => seg === "*").length;
  return segments.length * 1000 - stars * 2 + (isExactPattern(pattern) ? 1 : 0);
}

/**
 * リクエストのパスがパターンに一致するか
 * @param {string} pathname
 * @param {string} pattern
 * @returns {boolean}
 */
export function matchesPath(pathname, pattern) {
  const want = segmentsOf(pattern);
  const have = pathSegments(pathname);
  // "/" は根そのものだけ(前方一致で全部を覆う書き方にしない)
  if (want.length === 0) return have.length === 0;
  if (have.length < want.length) return false;
  if (isExactPattern(pattern) && have.length !== want.length) return false;
  return want.every((seg, i) => seg === "*" || have[i] === seg);
}

/**
 * パターンがルート(src/app の URL のセグメント。動的セグメント "[x]" を含みうる)を覆うか。
 * 動的セグメントはどの値にも一致しうるとみなし、* はどのセグメント(動的も)にも一致する。完全一致のパターンは長さも同じときだけ覆う。
 * @param {string} pattern
 * @param {readonly string[]} routeSegments
 * @returns {boolean}
 */
export function patternCoversRoute(pattern, routeSegments) {
  const patternSegments = segmentsOf(pattern);
  if (routeSegments.length < patternSegments.length) return false;
  if (isExactPattern(pattern) && routeSegments.length !== patternSegments.length) return false;
  return patternSegments.every((seg, i) => seg === "*" || routeSegments[i] === seg || /^\[.+\]$/.test(routeSegments[i]));
}
