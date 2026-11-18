// src/components/Media/PreviewImage/index.tsx

import type { ComponentProps } from "react";

export type PreviewImageProps = Omit<ComponentProps<"img">, "src" | "alt"> & {
  /** blob: / data: / 署名つき URL など、選んだ直後や手元にある画像の URL */
  src: string;
  alt: string;
};

/**
 * 選んだ直後の画像の下見(blob: の URL・署名つき URL)。素の img を描き、見た目は className / style で付ける。
 * 置き場の決まった公開の画像(実寸不明 = fill、ロゴ等 = intrinsic)は AppImage を使う。
 * 既定は decoding="async"、loading は付けない(eager。下見は表示中ずっと見えている。onLoad を待つ所で lazy にすると止まる)。
 */
export function PreviewImage({ src, alt, decoding = "async", ...props }: PreviewImageProps) {
  // next/image は blob: を最適化できず、実寸の分からない下見に width / height か fill の箱を要るので素の img を使う(ここ 1 か所)
  // eslint-disable-next-line @next/next/no-img-element
  return <img data-slot="preview-image" src={src} alt={alt} decoding={decoding} {...props} />;
}
