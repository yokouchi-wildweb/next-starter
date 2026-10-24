"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { ImagePreview, type ImagePreviewProps } from "./ImagePreview";
import { VideoPreview, type VideoPreviewProps } from "./VideoPreview";
import { UnsupportedPreview, type UnsupportedPreviewProps } from "./UnsupportedPreview";
import { detectMediaType } from "../types";
import { isStorageRef, resolveStorageSrc } from "@/lib/storage/ref";

export type MediaPreviewProps = {
  file?: File | null;
  /** 表示する URL。storage ref（storage://…）も受け付け、種類は ref の拡張子で判定して resolveStorageSrc で表示する */
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
      // object URL(ブラウザの外部リソース)の作成・解放に合わせて表示用 URL を切り替える
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const rawSrc = src ?? objectUrl;
  // 非公開の ref は拡張子の無い固定 URL（/api/storage/objects/<id>）になるため、種類は ref のまま判定する
  const resolvedSrc = useMemo(() => (isStorageRef(rawSrc) ? resolveStorageSrc(rawSrc) : rawSrc), [rawSrc]);
  const mediaType = detectMediaType({ file, src: rawSrc, mimeType });

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
