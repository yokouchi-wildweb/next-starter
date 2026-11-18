"use client";

import { useState } from "react";

import { BooleanCheckboxInput } from "@/components/Form/Input/Manual";
import { Stack } from "@/components/Layout/Stack";
import { Link } from "@/components/Navigation";
import { Para, Span } from "@/components/TextBlocks";
import { MediaUploaderMulti } from "@/lib/mediaInputSuite";

export const MediaUploadMultiDemo = () => {
  const [urls, setUrls] = useState<string[]>([]);
  const [reorderable, setReorderable] = useState(true);

  return (
    <Stack gap="lg" padding={{ base: "lg", sm: "2xl" }} className="flex flex-col gap-4">
      <BooleanCheckboxInput value={reorderable} onChange={(checked) => setReorderable(Boolean(checked))} label={<Span>並び替えを有効にする</Span>} />

      <MediaUploaderMulti
        purpose="demo.media"
        accept="image/*,video/*"
        helperText="アップロード先: uploads/demo-multi（画像/動画 OK、最大 5 件）"
        reorderable={reorderable}
        validationRule={{
          maxItems: 5,
          maxSizeBytes: 50 * 1024 * 1024,
        }}
        onUrlsChange={(next) => setUrls(next)}
      />

      <Stack gap="xs" className="text-sm">
        <Span tone="muted">確定済み URL: {urls.length} 件</Span>
        {urls.length > 0 ? (
          <ul className="list-disc pl-5">
            {urls.map((url) => (
              <li key={url}>
                <Link className="text-primary underline" href={url} target="_blank" rel="noreferrer">
                  {url}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Para tone="muted" size="sm">
            まだアップロードされていません。
          </Para>
        )}
      </Stack>
    </Stack>
  );
};
