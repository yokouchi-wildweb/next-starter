// src/lib/request/isPageNavigation.ts
// リクエストがページの遷移(HTML の文書の要求)か。proxy の項目(流入の計測・招待リンクの cookie)が共に使う判定。
// 値は持たず、引数は形だけの型(NextRequest を渡せる。next/server を読まない)

/** 渡すリクエストの形(NextRequest はこの形を満たす) */
export type NavigationRequest = {
  nextUrl: { pathname: string };
  headers: { get(name: string): string | null };
};

/** アセット配信など、ページの遷移でないパスの拡張子(.js / .png / .ico 等) */
const FILE_EXTENSION_PATTERN = /\.[^/]+$/;

/** ページの遷移(HTML の文書の要求)だけ true。/api・/_next・拡張子つきは false、sec-fetch-dest があればそれ、無ければ Accept で見る */
export function isPageNavigation(request: NavigationRequest): boolean {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) return false;
  if (FILE_EXTENSION_PATTERN.test(pathname)) return false;

  // sec-fetch-dest が送られてくる環境ではそれを信頼し、無い環境(古いブラウザ等)は Accept ヘッダーで代替判定する
  const secFetchDest = request.headers.get("sec-fetch-dest");
  if (secFetchDest) return secFetchDest === "document";

  return request.headers.get("accept")?.includes("text/html") ?? false;
}
