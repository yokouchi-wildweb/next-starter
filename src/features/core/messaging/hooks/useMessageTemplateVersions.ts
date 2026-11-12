"use client";

// src/features/core/messaging/hooks/useMessageTemplateVersions.ts
//
// 管理: テンプレートの公開した版の一覧(新しい順、SWR)。版は中身ごと返るので 1 版の表示もこの一覧から引く

import useSWR from "swr";

import { listMessageTemplateVersions, type AdminTemplateVersion } from "../services/client/templateClient";

import { messageTemplateVersionsKey } from "./templateKeys";

export function useMessageTemplateVersions(id: string | null | undefined) {
  const { data, error, isLoading } = useSWR<AdminTemplateVersion[]>(id ? messageTemplateVersionsKey(id) : null, () =>
    listMessageTemplateVersions(id!),
  );
  return { versions: data ?? [], error, isLoading };
}
