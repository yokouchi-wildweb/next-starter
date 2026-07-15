# Media/AppImage

`next/image` の共通ラッパーです。画像表示の約束事(fill の親要素規約・`sizes` 指定・エラーフォールバック・未登録ホストのクラッシュガード)を1箇所にカプセル化します。

**生の `<img>` と `next/image` の直接使用は禁止**で、画像表示は原則このコンポーネントを使います(CLAUDE.md「wrappers」参照)。

## なぜラッパーが必要か

素の `next/image` には有名な落とし穴があります:

- `fill` を使うとき親に `position: relative` がないと**高さ0で潰れる/画像が消える**
- `sizes` を忘れると全幅相当の srcset が選ばれ、**最適化しても転送量が減らない**
- `next.config.ts` の `remotePatterns` に未登録のホストを渡すと、**IMAGE_OPTIMIZATION を ON にした瞬間に実行時エラーで落ちる**(OFF の間は発症しない時限式)

AppImage はこれらをコンポーネント内部で解決するため、呼び出し側が個別に覚える必要がありません。

## 使い方

### fill モード(デフォルト) — 実寸不明のコンテンツ画像

ユーザーアップロード画像(Firebase Storage の URL 等)はこちら。**呼び出し側は縦横比の箱を `className` で渡すだけ**です。コンポーネント自身が positioned な箱を描画するので、親要素側の準備は不要です。

```tsx
import { AppImage } from "@/components/Media/AppImage";

// カードグリッドの画像
<AppImage src={item.imageUrl} alt={item.name} sizes="card" className="aspect-[1.618/1] rounded-lg" />

// 全幅ヒーロー(LCP なら priority を付与)
<AppImage src={visual.url} alt="" sizes="hero" priority className="aspect-video" />

// 収め方を contain に(既定は cover)
<AppImage src={logo.url} alt="" sizes="thumb" objectFit="contain" className="size-24" />
```

`sizes` は**必須**です(型エラーで指定忘れを防いでいます)。プリセットか生の sizes 文字列を渡します。

| プリセット | 値 | 想定用途 |
|---|---|---|
| `thumb` | `(max-width: 768px) 33vw, 160px` | 一覧サムネイル・アバター |
| `card` | `(max-width: 768px) 50vw, 400px` | カードグリッド |
| `hero` | `100vw` | ファーストビュー大型ビジュアル |
| `full` | `100vw` | 全幅画像 |

プリセット値は保守的なデフォルトです。実際のレイアウトに合わせて生文字列で上書きするか、フォーク側で `sizes.ts` を調整してください。

### intrinsic モード — 実寸既知の静的アセット

ロゴ・アイコンなどサイズが分かっているアセットは実寸を渡します(fill の箱は作られず、素の `next/image` 相当)。

```tsx
<AppImage mode="intrinsic" src={logoPath("brand.png")} alt="ブランド名" width={120} height={40} />
```

### フォールバック

```tsx
<AppImage src={user.avatarUrl} alt="" sizes="thumb" fallbackSrc={imgPath("avatar-placeholder.png")} className="size-10 rounded-full" />
```

- `src` が空(`undefined` / `null` / `""`)のとき、および読み込みエラー時に `fallbackSrc` へ切り替わります
- `fallbackSrc` も無い場合、fill モードは箱だけ描画(レイアウト維持)、intrinsic モードは何も描画しません

## クラッシュガード(unoptimized の自動判定)

`src` を見て「ローカルパス(`/...`)または自バケットの Firebase Storage URL」以外(外部ホスト・`data:`・`blob:` 等)には、自動で per-image の `unoptimized` を付与します。これにより `IMAGE_OPTIMIZATION=enabled` にした後も、`remotePatterns` 未登録の画像は**最適化なしで表示される**だけで、エラーにはなりません。

独自 CDN 等を `next.config.ts` の `remotePatterns` に追加したフォークは、`unoptimized={false}` を明示すれば自動判定を上書きして最適化を通せます。

## IMAGE_OPTIMIZATION との関係

- **フラグ OFF のままでも移行してよい**: lazy-loading と layout-shift 防止は最適化フラグと無関係に効きます。先にタグを AppImage へ移行し、後から env を切り替える運用を想定しています
- フラグを ON(`IMAGE_OPTIMIZATION=enabled`)にすると、AppImage 経由の画像がリサイズ・WebP 変換・srcset 配信に切り替わります(設定は `next.config.ts` と `.env.example` を参照)

## raw `<img>` からの移行レシピ

```tsx
// Before: aspect 比の箱 + raw img
<div className="relative aspect-[1.618/1] overflow-hidden rounded-lg">
  <img src={machine.imageUrl} alt={machine.name} className="absolute inset-0 h-full w-full object-cover" />
</div>

// After: 箱ごと AppImage に置き換え
<AppImage src={machine.imageUrl} alt={machine.name} sizes="card" className="aspect-[1.618/1] rounded-lg" />
```

ポイント: 既存の「箱 div + 絶対配置 img」の2要素は AppImage 1つに畳めます。箱に付いていた `aspect-*`・角丸・背景色は `className` へ、`object-*` の調整は `objectFit` / `imageClassName` へ移します。
