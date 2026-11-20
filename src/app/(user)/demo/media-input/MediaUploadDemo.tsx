"use client";

import { useState } from "react";

import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Link } from "@/components/Navigation/Link";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { MediaUploader, type SelectedMediaMetadata } from "@/lib/mediaInputSuite";

export const MediaUploadDemo = () => {
  const [metadata, setMetadata] = useState<SelectedMediaMetadata>({ image: null, video: null });
  const [url, setUrl] = useState<string | null>(null);

  return (
    <Stack gap="lg" padding={{ base: "lg", sm: "2xl" }} className="flex flex-col gap-4">
      <MediaUploader
        onMetadataChange={(info) => setMetadata(info)}
        onUrlChange={(url) => {
          setUrl(url);
        }}
        purpose="demo.media"
        helperText="アップロード先: uploads/demo"
      />
      <Stack gap="xs" className="text-sm">
        <Span tone="muted">状態: {url ? "アップロード済み" : "未選択"}</Span>
        {url ? (
          <Para tone="muted" size="sm">
            アップロード完了: {" "}
            <Link className="text-primary underline" href={url} target="_blank" rel="noreferrer">
              {url}
            </Link>
          </Para>
        ) : null}
        <MetadataDisplay metadata={metadata} />
      </Stack>
    </Stack>
  );
};

const MetadataDisplay = ({ metadata }: { metadata: SelectedMediaMetadata }) => {
  if (metadata.image) {
    const image = metadata.image;
    return (
      <Block className="text-sm text-muted-foreground">
        <Para tone="muted" size="sm">
          画像メタデータ
        </Para>
        <ul className="list-disc pl-5">
          <li>
            解像度: {image.width} × {image.height}
          </li>
          <li>MIME: {image.mimeType ?? "不明"}</li>
        </ul>
      </Block>
    );
  }
  if (metadata.video) {
    const video = metadata.video;
    return (
      <Block className="text-sm text-muted-foreground">
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
      </Block>
    );
  }
  return (
    <Para tone="muted" size="sm">
      メタ情報はまだありません。
    </Para>
  );
};
