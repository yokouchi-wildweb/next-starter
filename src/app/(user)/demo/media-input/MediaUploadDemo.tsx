"use client";

import { useState } from "react";

import { Block } from "@/components/Layout/Block";
import { Para, Span } from "@/components/TextBlocks";
import { MediaUploader, type SelectedMediaMetadata } from "@/lib/mediaInputSuite";

export const MediaUploadDemo = () => {
  const [metadata, setMetadata] = useState<SelectedMediaMetadata>({ image: null, video: null });
  const [url, setUrl] = useState<string | null>(null);

  return (
    <Block space="md" padding="xl" className="flex flex-col gap-4">
      <MediaUploader
        onMetadataChange={(info) => setMetadata(info)}
        onUrlChange={(url) => {
          setUrl(url);
        }}
        uploadPath="uploads/demo"
        helperText="アップロード先: uploads/demo"
      />
      <div className="flex flex-col gap-2 text-sm">
        <Span tone="muted">状態: {url ? "アップロード済み" : "未選択"}</Span>
        {url ? (
          <Para tone="muted" size="sm">
            アップロード完了: {" "}
            <a className="text-primary underline" href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
          </Para>
        ) : null}
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
          <li>MIME: {video.mimeType ?? "不明"}
          </li>
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
