"use client";

import { useCallback, useId, useMemo, useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/Form/Button/Button";
import { Input } from "@/components/Form/Manual/Input";
import { Block } from "@/components/Layout/Block";
import { Para, Span } from "@/components/TextBlocks";
import { MediaPreview, detectMediaType } from "@/lib/mediaInputSuite";
import { useImageMetadata, useVideoMetadata } from "@/lib/mediaInputSuite/hooks";
import type { MediaOrientation } from "@/lib/mediaInputSuite";

export const MediaPreviewDemo = () => {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [manualUrl, setManualUrl] = useState<string>("");

  const resolvedUrl = manualUrl.trim().length > 0 ? manualUrl.trim() : null;
  const source = useMemo(
    () => ({
      file: resolvedUrl ? null : file,
      src: resolvedUrl,
      mimeType: file?.type ?? null,
    }),
    [file, resolvedUrl],
  );
  const mediaType = detectMediaType({
    file: source.file ?? undefined,
    src: source.src,
    mimeType: source.mimeType,
  });

  const {
    metadata: imageMetadata,
    handleImageLoad,
    resetMetadata: resetImageMetadata,
  } = useImageMetadata({ source });
  const {
    metadata: videoMetadata,
    handleVideoMetadata,
    resetMetadata: resetVideoMetadata,
  } = useVideoMetadata({ source });

  const handleOpenFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setManualUrl("");
  }, []);

  const handleUrlChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setManualUrl(event.target.value);
    if (event.target.value.length > 0) {
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, []);

  const handleClear = useCallback(() => {
    setFile(null);
    setManualUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    resetImageMetadata();
    resetVideoMetadata();
  }, [resetImageMetadata, resetVideoMetadata]);

  const previewAvailable = Boolean(file || resolvedUrl);

  return (
    <Block space="md" padding="xl" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleOpenFileDialog}>ファイルを選択</Button>
        <Button variant="ghost" size="sm" onClick={handleClear}>
          クリア
        </Button>
        {file ? (
          <Span size="sm">選択中: {file.name}</Span>
        ) : resolvedUrl ? (
          <Span size="sm">URL 指定: {resolvedUrl}</Span>
        ) : (
          <Span size="sm" tone="muted">
            ファイルまたは URL を指定してください
          </Span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Para tone="muted" size="sm">
          直接 URL を入力するとリモートファイルのプレビューを確認できます。
        </Para>
        <Input
          value={manualUrl}
          onChange={handleUrlChange}
          placeholder="https://example.com/sample.jpg"
        />
      </div>

      <div className="rounded-lg border border-dashed border-border bg-muted/50 p-4">
        {previewAvailable ? (
          <MediaPreview
            file={source.file ?? undefined}
            src={source.src}
            className="flex h-64 w-full items-center justify-center overflow-hidden rounded bg-background"
            imageProps={{ onLoad: handleImageLoad }}
            videoProps={{ onLoadedMetadata: handleVideoMetadata }}
          />
        ) : (
          <Para tone="muted" size="sm">
            プレビュー可能なメディアが選択されていません。
          </Para>
        )}
      </div>

      <Para tone="muted" size="sm">
        判定結果: <Span tone="default">{mediaType}</Span>
      </Para>

      <div className="grid gap-4 md:grid-cols-2">
        <Block appearance="surface" padding="lg" space="xs" className="h-full shadow-none">
          <Span weight="semiBold">画像メタ情報</Span>
          {imageMetadata ? (
            <MetadataList
              items={[
                { label: "解像度", value: `${imageMetadata.width} × ${imageMetadata.height}` },
                { label: "アスペクト比", value: imageMetadata.aspectRatio.toFixed(2) },
                { label: "向き", value: orientationLabel(imageMetadata.orientation) },
                { label: "MIME", value: imageMetadata.mimeType ?? "不明" },
                { label: "サイズ", value: formatBytes(imageMetadata.sizeBytes) },
              ]}
            />
          ) : (
            <Para tone="muted" size="sm">
              画像メタ情報は未取得です。
            </Para>
          )}
        </Block>
        <Block appearance="surface" padding="lg" space="xs" className="h-full shadow-none">
          <Span weight="semiBold">動画メタ情報</Span>
          {videoMetadata ? (
            <MetadataList
              items={[
                { label: "解像度", value: `${videoMetadata.width} × ${videoMetadata.height}` },
                { label: "アスペクト比", value: videoMetadata.aspectRatio.toFixed(2) },
                { label: "向き", value: orientationLabel(videoMetadata.orientation) },
                { label: "再生時間", value: `${videoMetadata.durationFormatted} (${videoMetadata.durationSec.toFixed(2)}s)` },
                { label: "MIME", value: videoMetadata.mimeType ?? "不明" },
                { label: "サイズ", value: formatBytes(videoMetadata.sizeBytes) },
              ]}
            />
          ) : (
            <Para tone="muted" size="sm">
              動画メタ情報は未取得です。
            </Para>
          )}
        </Block>
      </div>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        className="sr-only"
        onChange={handleFileChange}
      />
    </Block>
  );
};

type MetadataItem = {
  label: string;
  value: string;
};

const MetadataList = ({ items }: { items: MetadataItem[] }) => {
  return (
    <dl className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-2">
          <dt>{item.label}</dt>
          <dd className="text-right text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
};

const orientationLabel = (orientation: MediaOrientation) => {
  switch (orientation) {
    case "landscape":
      return "横向き";
    case "portrait":
      return "縦向き";
    default:
      return "正方形";
  }
};

const formatBytes = (size?: number | null) => {
  if (typeof size !== "number" || Number.isNaN(size)) return "不明";
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
};
