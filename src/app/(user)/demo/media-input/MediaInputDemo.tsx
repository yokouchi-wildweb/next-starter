"use client";

import { useState } from "react";

import { Block } from "@/components/Layout/Block";
import { Para, Span } from "@/components/TextBlocks";
import { MediaInput, type SelectedMediaMetadata } from "@/lib/mediaInputSuite";

export const MediaInputDemo = () => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<SelectedMediaMetadata>({ image: null, video: null });

  return (
    <Block space="md" padding="xl" className="flex flex-col gap-4">
      <MediaInput
        onFileChange={(file) => setFileName(file?.name ?? null)}
        onMetadataChange={(info) => setMetadata(info)}
        accept="image/*,video/*"
        helperText="クリックまたはファイルをドラッグ＆ドロップしてください"
      />
      <div className="flex flex-col gap-2 text-sm">
        <Span tone="muted">選択中: {fileName ?? "未選択"}</Span>
        <MetadataDisplay metadata={metadata} />
      </div>
    </Block>
  );
};

const MetadataDisplay = ({ metadata }: { metadata: SelectedMediaMetadata }) => {
  if (metadata.image) {
    const image = metadata.image;
    return (
      <div className="text-sm text-muted-foreground">
        <Para tone="muted" size="sm">
          画像メタデータ
        </Para>
        <ul className="list-disc pl-5">
          <li>
            解像度: {image.width} × {image.height}
          </li>
          <li>向き: {orientationLabel(image.orientation)}</li>
          <li>MIME: {image.mimeType ?? "不明"}</li>
        </ul>
      </div>
    );
  }
  if (metadata.video) {
    const video = metadata.video;
    return (
      <div className="text-sm text-muted-foreground">
        <Para tone="muted" size="sm">
          動画メタデータ
        </Para>
        <ul className="list-disc pl-5">
          <li>
            解像度: {video.width} × {video.height}
          </li>
          <li>再生時間: {video.durationFormatted}</li>
          <li>MIME: {video.mimeType ?? "不明"}</li>
        </ul>
      </div>
    );
  }
  return (
    <Para tone="muted" size="sm">
      メタ情報はまだありません。
    </Para>
  );
};

const orientationLabel = (orientation: "landscape" | "portrait" | "square") => {
  switch (orientation) {
    case "landscape":
      return "横向き";
    case "portrait":
      return "縦向き";
    default:
      return "正方形";
  }
};
