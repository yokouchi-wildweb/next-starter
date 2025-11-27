"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { ImagePreview, type ImagePreviewProps } from "./ImagePreview";
import { VideoPreview, type VideoPreviewProps } from "./VideoPreview";
import { UnsupportedPreview, type UnsupportedPreviewProps } from "./UnsupportedPreview";
import { detectMediaType } from "../types";

export type MediaPreviewProps = {
  file?: File | null;
  src?: string | null;
  mimeType?: string | null;
  className?: string;
  style?: CSSProperties;
  imageProps?: Omit<ImagePreviewProps, "src">;
  videoProps?: Omit<VideoPreviewProps, "src">;
  unsupportedProps?: UnsupportedPreviewProps;
};

export const MediaPreview = ({
  file,
  src,
  mimeType,
  className,
  style,
  imageProps,
  videoProps,
  unsupportedProps,
}: MediaPreviewProps) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const objectUrlFileRef = useRef<File | null>(null);

  useEffect(() => {
    if (!file) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = null;
      setObjectUrl(null);
      objectUrlFileRef.current = null;
      return;
    }

    if (objectUrlFileRef.current === file && objectUrlRef.current) {
      setObjectUrl(objectUrlRef.current);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    objectUrlRef.current = nextUrl;
    objectUrlFileRef.current = file;
    setObjectUrl(nextUrl);

    return () => {
      if (objectUrlRef.current === nextUrl) {
        URL.revokeObjectURL(nextUrl);
        objectUrlRef.current = null;
        objectUrlFileRef.current = null;
        setObjectUrl(null);
      }
    };
  }, [file]);

  const resolvedSrc = useMemo(() => src ?? objectUrl, [src, objectUrl]);
  const mediaType = detectMediaType({ file, src: resolvedSrc, mimeType });

  if (!resolvedSrc) {
    return <UnsupportedPreview className={className} style={style} {...unsupportedProps} />;
  }

  if (mediaType === "image") {
    return (
      <div className={cn("flex h-full w-full items-center justify-center", className)} style={style}>
        <ImagePreview src={resolvedSrc} className="h-full w-full" {...imageProps} />
      </div>
    );
  }

  if (mediaType === "video") {
    return (
      <div className={cn("flex h-full w-full items-center justify-center", className)} style={style}>
        <VideoPreview src={resolvedSrc} className="h-full w-full" {...videoProps} />
      </div>
    );
  }

  return (
    <div className={cn("flex h-full w-full items-center justify-center", className)} style={style}>
      <UnsupportedPreview {...unsupportedProps} />
    </div>
  );
};
