# Overlays/ImageViewer

## Overview

- 画像のズーム表示。入口は `@/components/Overlays/ImageViewer`(`ImageViewerProvider` / `ZoomableImage` / `useImageViewer`)

## Usage

```tsx
import { ImageViewerProvider, ZoomableImage, useImageViewer } from "@/components/Overlays/ImageViewer";

function Example() {
  const { openImage } = useImageViewer();

  return (
    <ImageViewerProvider>
      <ZoomableImage src="/image.jpg" alt="サンプル" />
      <button onClick={() => openImage("/another.jpg", "別の画像")}>
        別の画像を開く
      </button>
    </ImageViewerProvider>
  );
}
```

## API

- 説明文(caption): `openImage(src, alt, { caption })` か `<ZoomableImage viewerOptions={{ caption }} />` で、拡大した画像の下に中央寄せで描く(印 `image-viewer-caption`、既定の文字は `text-sm text-background`)
- `caption` は `ReactNode` で、押すとコピーするボタン等の見た目と動きは呼び手が作る。渡すと画像の既定の最大の高さが `calc(90dvh - 4rem)` に詰まる(`maxHeight` を渡せばそれ)
- 他の options: `width` / `height` / `maxWidth` / `maxHeight` / `showSkeleton` / `aspectRatio`(型 `ImageViewerOptions`)

## Internals

`openImage(src)` と `ZoomableImage` の `src` には `storage://` の ref をそのまま渡してよい（`toStorageDisplaySrc` で表示用 URL に直す。ref 以外の値はそのまま）。
