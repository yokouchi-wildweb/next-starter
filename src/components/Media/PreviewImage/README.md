# Media/PreviewImage

## Overview

選んだ直後や手元にある画像(blob: の URL・署名つき URL)の下見を描く部品。素の `img` を 1 つ描き、見た目は呼び手の `className` / `style` で付ける。

- 使う所: ファイル選択の直後の下見、アップロード前の確認、元の縦横比のまま `max-h-*` で収める表示
- `Media/AppImage` との違い: AppImage は fill / intrinsic・最適化・エラーの代わりの画像を持つ。PreviewImage は素の `img` 1 つで、どれも持たない

## Usage

```tsx
import { PreviewImage } from "@/components/Media/PreviewImage";

<PreviewImage src={objectUrl} alt="振込明細プレビュー" className="w-full max-h-80 rounded-md bg-muted object-contain" />
```

## API

- `src`(必須)・`alt`(必須)、ほかは `img` の属性をそのまま渡す(`onLoad` / `onError` / `style` / `className` など)
- 既定: `decoding="async"`、`loading` は付けない(eager)。出力に `data-slot="preview-image"`

## Verification

`pnpm test src/components/Media/PreviewImage`

## Related

- 公開の画像・ユーザーの画像の表示: `../AppImage/README.md`
