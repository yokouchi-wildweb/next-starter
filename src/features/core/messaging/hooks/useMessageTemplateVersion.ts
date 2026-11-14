"use client";

// src/features/core/messaging/hooks/useMessageTemplateVersion.ts
//
// 管理: テンプレートの公開した版 1 つ(SWR、GET /api/admin/messaging/templates/<id>/versions/<版>)。
// id と版がそろった時だけ取る。画面には置いていない(版の履歴は一覧 useMessageTemplateVersions が中身ごと返す)

import useSWR from "swr";

import { getMessageTemplateVersion, type AdminTemplateVersion } from "../services/client/templateClient";

import { messageTemplateVersionKey } from "./templateKeys";

export function useMessageTemplateVersion(id: string | null | undefined, version: number | null | undefined) {
  const ready = Boolean(id) && typeof version === "number";
  const { data, error, isLoading } = useSWR<AdminTemplateVersion>(ready ? messageTemplateVersionKey(id!, version!) : null, () =>
    getMessageTemplateVersion(id!, version!),
  );
  return { version: data ?? null, error, isLoading };
}
