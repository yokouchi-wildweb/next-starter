// src/lib/storage/client/usePurposeMetadata.ts
//
// 用途の方針（metadata: strip / keep）を React で読む。サーバーから得るまで・取得に失敗したときは undefined。
// 写真選択の accept は、undefined の間は狭めない（keep の用途を狭めない側に倒す。strip の用途で HEIC が選ばれても
// uploadToStorage が送る前に方針を確かめて JPEG に変える）。
//
//   const metadata = usePurposeMetadata(purpose);
//   <input type="file" accept={pickerAcceptFor(accept, metadata ?? "keep")} />

"use client";

import { useEffect, useState } from "react";

import type { StorageMetadataPolicy } from "../policy/types";
import { purposeMetadataLoader, type PurposeMetadataLoader } from "./purposePolicy";

export function usePurposeMetadata(
  purpose: string | null | undefined,
  loader: PurposeMetadataLoader = purposeMetadataLoader,
): StorageMetadataPolicy | undefined {
  const [loaded, setLoaded] = useState<{ purpose: string; metadata: StorageMetadataPolicy } | null>(null);

  useEffect(() => {
    if (!purpose || loader.peek(purpose)) return;
    let active = true;
    loader.load(purpose).then(
      (metadata) => {
        if (active) setLoaded({ purpose, metadata });
      },
      () => {
        // 取得に失敗したら accept を狭めないまま（送る前に uploadToStorage が改めて確かめる）
      },
    );
    return () => {
      active = false;
    };
  }, [purpose, loader]);

  if (!purpose) return undefined;
  return loader.peek(purpose) ?? (loaded?.purpose === purpose ? loaded.metadata : undefined);
}
