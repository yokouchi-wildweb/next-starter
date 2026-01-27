// src/components/Overlays/ImageViewer/Provider.tsx

"use client";

import { useState, useCallback, useMemo, type ReactNode, type CSSProperties } from "react";
import { XIcon } from "lucide-react";
import { DialogPrimitives, DialogClose, DialogContent, DialogTitle } from "@/components/Overlays/DialogPrimitives";
import { BaseSkeleton } from "@/components/Skeleton/BaseSkeleton";
import { ImageViewerContext, type ImageViewerContextValue, type ImageViewerOptions } from "./context";

type ImageViewerProviderProps = {
  children: ReactNode;
};

const DEFAULT_MAX_WIDTH = "90vw";
const DEFAULT_MAX_HEIGHT = "90vh";
const DEFAULT_ASPECT_RATIO = 16 / 9;
const DEFAULT_SKELETON_WIDTH = "min(90vw, 600px)";

export function ImageViewerProvider({ children }: ImageViewerProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>("");
  const [imageAlt, setImageAlt] = useState<string>("");
  const [options, setOptions] = useState<ImageViewerOptions>({});
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  const openImage = useCallback((src: string, alt?: string, opts?: ImageViewerOptions) => {
    setImageSrc(src);
    setImageAlt(alt ?? "");
    setOptions(opts ?? {});
    setIsImageLoaded(false);
    setIsOpen(true);
  }, []);

  const handleImageLoad = useCallback(() => {
    setIsImageLoaded(true);
  }, []);

  const contextValue = useMemo<ImageViewerContextValue>(
    () => ({ openImage }),
    [openImage],
  );

  // width指定時はアスペクト比を維持（height: auto）
  const imageStyle = useMemo<CSSProperties>(() => {
    const style: CSSProperties = {
      maxWidth: options.maxWidth ?? DEFAULT_MAX_WIDTH,
      maxHeight: options.maxHeight ?? DEFAULT_MAX_HEIGHT,
    };
    if (options.width) {
      style.width = options.width;
      style.height = options.height ?? "auto";
    } else if (options.height) {
      style.height = options.height;
    }
    return style;
  }, [options]);

  // DialogContentのmax-widthはimageのmax-widthに合わせる
  const dialogMaxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;

  // スケルトンのスタイル
  const skeletonStyle = useMemo<CSSProperties>(() => {
    const aspectRatio = options.aspectRatio ?? DEFAULT_ASPECT_RATIO;
    return {
      width: options.width ?? DEFAULT_SKELETON_WIDTH,
      aspectRatio,
      maxWidth: options.maxWidth ?? DEFAULT_MAX_WIDTH,
      maxHeight: options.maxHeight ?? DEFAULT_MAX_HEIGHT,
    };
  }, [options]);

  const showSkeleton = options.showSkeleton && !isImageLoaded;

  return (
    <ImageViewerContext.Provider value={contextValue}>
      {children}
      <DialogPrimitives open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          data-component="image-viewer"
          className="bg-transparent border-none shadow-none p-0"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "fit-content",
            maxWidth: dialogMaxWidth,
            maxHeight: DEFAULT_MAX_HEIGHT,
          }}
          overlayLayer="super"
          layer="super"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">
            {imageAlt || "画像プレビュー"}
          </DialogTitle>
          {imageSrc && (
            <div data-slot="image-viewer-content" className="relative inline-block mx-auto">
              {showSkeleton ? (
                <BaseSkeleton
                  data-slot="image-viewer-skeleton"
                  className="rounded-lg"
                  style={skeletonStyle}
                />
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                data-slot="image-viewer-image"
                src={imageSrc}
                alt={imageAlt}
                className="block object-contain"
                style={{
                  ...imageStyle,
                  display: showSkeleton ? "none" : "block",
                }}
                onLoad={handleImageLoad}
              />
              <DialogClose className="absolute top-0 right-0 translate-x-[calc(50%-6px)] sm:translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white hover:bg-black/90 transition-colors cursor-pointer">
                <XIcon className="size-6" />
                <span className="sr-only">閉じる</span>
              </DialogClose>
            </div>
          )}
        </DialogContent>
      </DialogPrimitives>
    </ImageViewerContext.Provider>
  );
}
