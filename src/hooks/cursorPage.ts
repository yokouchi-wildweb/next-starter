// src/hooks/cursorPage.ts
//
// 続きの位置(カーソル)で取る一覧の 1 回分の応答。useInfiniteScrollQuery のカーソルのモード(cursorFetcher)が受け取る形。
// - items: この回の行(並びはサーバーの順)
// - nextCursor: 続きを取るときに渡す値。null = 終端(続きは無い)
// 増え続ける一覧(お知らせ・ログ・履歴)は総数を数えず、この形で返す(数えると行が増えるほど重くなり、
// 読み込みの間に行が足されると offset の位置がずれて重複・取りこぼしが起きる)。

export type CursorPage<TItem> = {
  items: TItem[];
  nextCursor: string | null;
};
