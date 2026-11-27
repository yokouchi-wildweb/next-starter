// src/lib/url/reloadTo.ts
// ページを読み直して自サイトの道へ移る(location の置き換え、履歴は残さない)。
// 利用者が替わる所(ログアウト・ログインの成功・登録の完了)はこれで移る(D139): SWR・隠れた画面・全体の store・上書きを
// 1 回で捨て、前の人の値を残さない。client の遷移(router)では残る。行き先は自サイトの道だけ(それ以外は "/")。
// 未保存の編集がある画面からの読み直しはブラウザの確認(beforeunload、src/lib/unsavedGuard)が出る。

import { sanitizeRedirectPath } from "./sanitizeRedirectPath";

/** ページを読み直して path へ移る。win は試しの差し替え用 */
export function reloadTo(path: string, win: Pick<Window, "location"> = window): void {
  win.location.replace(sanitizeRedirectPath(path));
}
