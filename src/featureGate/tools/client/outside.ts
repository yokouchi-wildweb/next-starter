// src/featureGate/tools/client/outside.ts
// client の道具が共有する「範囲の外・Provider の外」の扱い(道具ではない。束に載せない)。
// dev(NODE_ENV !== "production")は throw して書き間違いに気づかせ、本番は閉とみなす(D5)

/** dev なら throw。本番なら戻る(呼び手が閉の答えを返す) */
export function outside(message: string): void {
  if (process.env.NODE_ENV !== "production") throw new Error(`featureGate(client): ${message}`);
}

export const NO_PROVIDER = "GateProvider の外で useGate を呼んだ(src/wiring/AppProviders.tsx の中で呼ぶ)";

export const outOfArea = (pathname: string, area: string) =>
  `住所 "${pathname}" は今の枠(${area})の範囲の外(/api の下は範囲の外、/admin の下は admin の枠だけ)`;
