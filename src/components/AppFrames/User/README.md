# User AppFrames

ユーザーアプリ側の枠は **`src/app/(user)/_layout/` へ移動した**(説明・設定ファイル・ページ単位の出し入れ: [src/app/(user)/_layout/README.md](../../../app/(user)/_layout/README.md))。このフォルダに部品は残っていない。

- 旧パスの shim と旧来の雛形(HeaderCustom / FooterCustom)は旧入口撤去の区切り(notice old-entry-removal)、表示制御の context は次の区切り(notice old-entry-removal-contexts)で削除した
- ページ単位で枠の部位を隠す部品 `controls/`(ヘッダー・ヘッダーのナビ・フッター・ボトムナビを隠す 4 つの Hide* 部品と部位一覧 frameParts.ts)は、ルートの宣言 `frame.ts` への切り替えで削除した。置き換え方:
  - フッターをスマホで隠す Hide* (`sp`)などを描いていたページ → そのページ(または layout)の隣の `frame.ts` に `hide: { footer: { sp: true } }`(上流のページなら `frame.override.ts`)
  - 書式: [src/app/_layout/frame/README.md](../../../app/_layout/frame/README.md)
