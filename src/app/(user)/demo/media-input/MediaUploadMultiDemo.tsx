"use client";

import { useState } from "react";

import { Stack } from "@/components/Layout/Stack";
import { Para, Span } from "@/components/TextBlocks";
import { MediaUploaderMulti } from "@/lib/mediaInputSuite";

export const MediaUploadMultiDemo = () => {
  const [urls, setUrls] = useState<string[]>([]);
  const [reorderable, setReorderable] = useState(true);

  return (
    <Stack space={6} padding="xl" className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={reorderable}
          onChange={(event) => setReorderable(event.target.checked)}
        />
        <Span>並び替えを有効にする</Span>
      </label>

      <MediaUploaderMulti
        uploadPath="uploads/demo-multi"
        accept="image/*,video/*"
        helperText="アップロード先: uploads/demo-multi（画像/動画 OK、最大 5 件）"
        reorderable={reorderable}
        validationRule={{
          maxItems: 5,
          maxSizeBytes: 50 * 1024 * 1024,
        }}
        onUrlsChange={(next) => setUrls(next)}
      />

      <div className="flex flex-col gap-2 text-sm">
        <Span tone="muted">確定済み URL: {urls.length} 件</Span>
        {urls.length > 0 ? (
          <ul className="list-disc pl-5">
            {urls.map((url) => (
              <li key={url}>
                <a className="text-primary underline" href={url} target="_blank" rel="noreferrer">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <Para tone="muted" size="sm">
            まだアップロードされていません。
          </Para>
        )}
      </div>
    </Stack>
  );
};
