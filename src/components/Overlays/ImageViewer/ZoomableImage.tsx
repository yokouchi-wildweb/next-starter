// src/components/Overlays/ImageViewer/ZoomableImage.tsx

"use client";

import { type ComponentPropsWithoutRef, type MouseEvent } from "react";
import { useImageViewer } from "./context";

type ZoomableImageProps = ComponentPropsWithoutRef<"img"> & {
  src: string;
};

export function ZoomableImage({
  src,
  alt = "",
  style,
  onClick,
  ...rest
}: ZoomableImageProps) {
  const { openImage } = useImageViewer();

  const handleClick = (e: MouseEvent<HTMLImageElement>) => {
    e.stopPropagation();
    openImage(src, alt);
    onClick?.(e);
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      style={{ ...style, cursor: "zoom-in" }}
      onClick={handleClick}
      {...rest}
    />
  );
}
