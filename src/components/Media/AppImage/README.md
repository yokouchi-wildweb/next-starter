# Media/AppImage

## Overview

`next/image` の共通ラッパー(`@/components/Media/AppImage`)。画像表示の約束事(fill の親要素・`sizes` の指定・エラーの代わりの画像・未登録ホストのクラッシュガード)を 1 か所に閉じ込める。生の `<img>` / `next/image` の代わりに使う部品(`.claude/rules/core/components.md` wrappers)。

素の `next/image` の落とし穴を部品の中で解決するので、呼び手は個別に覚えなくてよい:

- `fill` で親に `position: relative` がないと高さ 0 で潰れる / 画像が消える
- `sizes` を忘れると全幅相当の srcset が選ばれ、最適化しても転送量が減らない
- `next.config.ts` の `remotePatterns` に未登録のホストを渡すと、IMAGE_OPTIMIZATION を ON にした瞬間に実行時エラーで落ちる(OFF の間は発症しない)

モード:

- fill(既定): 実寸の分からないコンテンツ画像(ユーザーのアップロード画像など)。部品が positioned な箱を描き、呼び手は縦横比の箱を `className` で渡すだけ
- intrinsic: 実寸の分かる静的アセット(ロゴ・アイコン)。fill の箱は作らず、素の `next/image` 相当

## Usage

### fill モード

```tsx
import { AppImage } from "@/components/Media/AppImage";

// カードグリッドの画像
<AppImage src={item.imageUrl} alt={item.name} sizes="card" className="aspect-[1.618/1] rounded-lg" />

// 全幅ヒーロー(LCP なら priority を付与)
<AppImage src={visual.url} alt="" sizes="hero" priority className="aspect-video" />

// 収め方を contain に(既定は cover)
<AppImage src={logo.url} alt="" sizes="thumb" objectFit="contain" className="size-24" />
```

### intrinsic モード

```tsx
<AppImage mode="intrinsic" src={logoPath(business.logo, "primary")} alt="ブランド名" width={120} height={40} />
```

### 代わりの画像

```tsx
<AppImage src={user.avatarUrl} alt="" sizes="thumb" fallbackSrc={imgPath("avatar-placeholder.png")} className="size-10 rounded-full" />
```

### style と data-* の属性

演出の `opacity` / `transition` や、fork の CSS が狙う印に使う。

```tsx
<AppImage mode="intrinsic" src={logo} alt="ロゴ" width={160} height={40} data-slot="header-brand-logo" priority />
```

### raw `<img>` から移す

```tsx
// Before: aspect 比の箱 + raw img
<div className="relative aspect-[1.618/1] overflow-hidden rounded-lg">
  <img src={machine.imageUrl} alt={machine.name} className="absolute inset-0 h-full w-full object-cover" />
</div>

// After: 箱ごと AppImage に置き換え
<AppImage src={machine.imageUrl} alt={machine.name} sizes="card" className="aspect-[1.618/1] rounded-lg" />
```

- 「箱 div + 絶対配置の img」の 2 要素は AppImage 1 つに畳める
- 箱に付いていた `aspect-*`・角丸・背景色は `className` へ、`object-*` の調整は `objectFit` / `imageClassName` へ
- IMAGE_OPTIMIZATION が OFF のままでも移してよい: lazy-loading と layout-shift の防止は最適化のフラグと無関係に効く(先にタグを移し、後から env を切り替える運用)

## API

### 共通の props

- `src`: 表示する画像(`string | null | undefined`)。`storage://` の ref も受ける(Internals)
- `alt`(必須)
- `fallbackSrc`: `src` が空(`undefined` / `null` / `""`)のときと読み込みエラーのときに切り替える画像
  - `fallbackSrc` も無い: fill は箱だけ描く(レイアウトを保つ)、intrinsic は何も描かない
- `priority`: LCP の画像(ファーストビューの主役)にだけ付ける。lazy-loading を外して先読みする
- `unoptimized`: 最適化の明示。省略 = `src` から自動判定(Internals)
- `style` と `data-*`(`data-slot` 等): 一番外の要素に付く(fill = 箱の div、intrinsic = img)
  - `data-component="AppImage"` は部品の印で、渡しても変わらない
  - 他の属性(onClick 等)は受けない

### fill モード(`mode` 省略 / `"fill"`)

- `sizes`(必須、型で指定忘れを防ぐ): プリセット名か生の sizes 文字列
- `objectFit`: `"cover"`(既定、はみ出しをトリミング)| `"contain"`
- `className`: 箱のクラス(`aspect-[...]`・角丸・背景色)
- `imageClassName`: 画像要素のクラス(object-position の調整など)

| プリセット | 値 | 想定用途 |
|---|---|---|
| `thumb` | `(max-width: 768px) 33vw, 160px` | 一覧サムネイル・アバター |
| `card` | `(max-width: 768px) 50vw, 400px` | カードグリッド |
| `hero` | `100vw` | ファーストビュー大型ビジュアル |
| `full` | `100vw` | 全幅画像 |

- プリセットの値は保守的な既定。実際のレイアウトに合わせて生の文字列で上書きする

### intrinsic モード(`mode="intrinsic"`)

- `width` / `height`(必須): 実寸
- `sizes`(任意): 画像の実寸がそのまま上限になる
- `className`

## Extension

- プリセットの値: 生の sizes 文字列で上書きするか、フォーク側で `sizes.ts` を調整する
- 独自の CDN 等を `next.config.ts` の `remotePatterns` に足したフォークは、`unoptimized={false}` を明示すると自動判定を上書きして最適化を通せる
- 最適化のフラグ `IMAGE_OPTIMIZATION=enabled` で、AppImage の画像がリサイズ・WebP 変換・srcset 配信に変わる(設定は `next.config.ts` と `.env.example`)

## Internals

### 保存値(storage:// の ref)

- `src` / `fallbackSrc` の `storage://` の ref は、`resolveStorageSrc`(`src/lib/storage/README.md`「表示」)で表示用の URL に解決する
  - 公開(`storage://pub/...`)= 公開 base の URL | 非公開(`storage://priv/...`)= 固定 URL `/api/storage/objects/<id>`
  - 解析できない ref・公開 base 未設定の公開 ref は `fallbackSrc` に落ちる
- ref 以外の値(旧 URL・`/` 始まり・`blob:` / `data:`)はそのまま使う
- 判定は純関数 `source.ts` の `resolveAppImageSource`

### クラッシュガード(unoptimized の自動判定)

- 最適化を通すのは: ローカルパス(`/...`)・自バケットの Firebase Storage URL・新しい公開バケット(公開 base の配下)
- それ以外(外部ホスト・`data:`・`blob:` 等)は per-image の `unoptimized` を自動で付ける。`IMAGE_OPTIMIZATION=enabled` の後も、`remotePatterns` 未登録の画像は最適化なしで表示されるだけで落ちない
- 固定 URL(`/api/storage/` 宛て)は `unoptimized={false}` を渡しても必ず最適化を外す(認可済みの画像を最適化キャッシュに載せないため)

## Verification

- 描画: `pnpm test src/components/Media/AppImage`
- ref の解決: `pnpm test src/lib/storage/storageRef.test.ts`

## Related

- 選んだ直後の画像の下見: `../PreviewImage/README.md`
- 保存値と表示: `src/lib/storage/README.md`
