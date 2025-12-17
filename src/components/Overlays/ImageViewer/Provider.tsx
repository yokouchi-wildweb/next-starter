// src/components/Overlays/ImageViewer/Provider.tsx

"use client";

import { useState, useCallback, useMemo, type ReactNode } from "react";
import { XIcon } from "lucide-react";
import { DialogPrimitives, DialogClose, DialogContent, DialogTitle } from "@/components/Overlays/DialogPrimitives";
import { ImageViewerContext, type ImageViewerContextValue } from "./context";

type ImageViewerProviderProps = {
  children: ReactNode;
};

export function ImageViewerProvider({ children }: ImageViewerProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>("");
  const [imageAlt, setImageAlt] = useState<string>("");

  const openImage = useCallback((src: string, alt?: string) => {
    setImageSrc(src);
    setImageAlt(alt ?? "");
    setIsOpen(true);
  }, []);

  const contextValue = useMemo<ImageViewerContextValue>(
    () => ({ openImage }),
    [openImage],
  );

  return (
    <ImageViewerContext.Provider value={contextValue}>
      {children}
      <DialogPrimitives open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="bg-transparent border-none shadow-none p-0 max-w-[90vw] max-h-[90vh]"
          overlayLayer="super"
          layer="super"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">
            {imageAlt || "画像プレビュー"}
          </DialogTitle>
          {imageSrc && (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt={imageAlt}
                className="block max-w-full max-h-[90vh] object-contain"
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
