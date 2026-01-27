// src/components/Overlays/ImageViewer/ZoomableImage.tsx

"use client";

import { type ComponentPropsWithoutRef, type MouseEvent } from "react";
import { useImageViewer, type ImageViewerOptions } from "./context";

type ZoomableImageProps = ComponentPropsWithoutRef<"img"> & {
  src: string;
  /** 拡大表示時のサイズオプション */
  viewerOptions?: ImageViewerOptions;
};

export function ZoomableImage({
  src,
  alt = "",
  style,
  onClick,
  viewerOptions,
  ...rest
}: ZoomableImageProps) {
  const { openImage } = useImageViewer();

  const handleClick = (e: MouseEvent<HTMLImageElement>) => {
    e.stopPropagation();
    openImage(src, alt, viewerOptions);
    onClick?.(e);
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      data-component="zoomable-image"
      src={src}
      alt={alt}
      style={{ ...style, cursor: "zoom-in" }}
      onClick={handleClick}
      {...rest}
    />
  );
}
