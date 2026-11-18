# AppFrames/User

## Overview

- このフォルダに部品は無い。ユーザーアプリ側の枠は `src/app/(user)/_layout/` にある(説明・設定ファイル・ページ単位の出し入れ: [src/app/(user)/_layout/README.md](../../../app/(user)/_layout/README.md))
- 旧パスの shim、旧来の雛形(HeaderCustom / FooterCustom)、表示制御の context は無い
- ページ単位で枠の部位を隠す旧部品 `controls/`(ヘッダー・ヘッダーのナビ・フッター・ボトムナビを隠す 4 つの Hide* 部品と部位一覧 frameParts.ts)も無い。代わりはルートの枠の宣言(`frame.ts` / `frame.override.ts`)

## Usage

- 旧 Hide* 部品(例: フッターをスマホで隠す `sp`)を描いていたページ → そのページ(または layout)の隣の枠の宣言に `page: { hide: { footer: { sp: true } } }`
- layout の下全部に効かせるなら `layout:`
- 自分のルートは `frame.ts`。上流のページの隣は `frame.override.ts`(export const override)で、上流の `frame.ts` の上に重なる

## Related

- 枠の宣言の書式: [src/app/_layout/frame/README.md](../../../app/_layout/frame/README.md)
