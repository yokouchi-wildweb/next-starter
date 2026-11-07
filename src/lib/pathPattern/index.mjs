// src/lib/pathPattern/index.mjs
// 住所のパターン照合(純粋関数)。門番の判定(src/featureGate/evaluate.ts)・ルート地図(src/lib/screens/routeMap.mjs)・pnpm test src/featureGate scripts/structure/proxies が共有する。詳細: ./README.md
//
// 書き方:
// - "/demo"   = セグメント境界の前方一致("/demo" と "/demo/**"。"/demo-login" は含まない)。末尾スラッシュは同義
// - "=/mypage" = そのパスちょうど。fork が同じ URL の下に足したページ("/mypage/<fork のページ>")を巻き込まない

/** パターンが完全一致の書き方か */
export const isExactPattern = (pattern) => pattern.startsWith("=");

const normalize = (pattern) => {
  const body = isExactPattern(pattern) ? pattern.slice(1) : pattern;
  return body.length > 1 && body.endsWith("/") ? body.slice(0, -1) : body;
};

/** リクエストのパスがパターンに一致するか */
export function matchesPath(pathname, pattern) {
  const path = normalize(pattern);
  if (isExactPattern(pattern)) return pathname === path;
  return pathname === path || pathname.startsWith(path + "/");
}

/**
 * パターンがルート(src/app の URL のセグメント。動的セグメント "[x]" を含みうる)を覆うか。
 * 動的セグメントはどの値にも一致しうるとみなす。完全一致のパターンは長さも同じときだけ覆う。
 */
export function patternCoversRoute(pattern, routeSegments) {
  const patternSegments = normalize(pattern).split("/").filter(Boolean);
  if (routeSegments.length < patternSegments.length) return false;
  if (isExactPattern(pattern) && routeSegments.length !== patternSegments.length) return false;
  return patternSegments.every((seg, i) => routeSegments[i] === seg || /^\[.+\]$/.test(routeSegments[i]));
}
