// src/features/core/auditLog/hooks/useAuditLogSearchFilters.ts
//
// 監査ログの横断検索の絞り込みの状態(管理画面の検索の欄)。入力中の下書き(draft)と、
// 「適用」で確定した値(applied)を分けて持ち、applied から useAuditLogSearch の where を作る。
// reset は下書きと適用の両方を空にする(全件に戻る)。

"use client";

import { useCallback, useMemo, useState } from "react";

import {
  buildAuditLogSearchWhere,
  EMPTY_AUDIT_LOG_SEARCH_FILTERS,
  type AuditLogSearchFilters,
} from "../utils/searchWhere";

export function useAuditLogSearchFilters(initial: AuditLogSearchFilters = EMPTY_AUDIT_LOG_SEARCH_FILTERS) {
  const [draft, setDraft] = useState<AuditLogSearchFilters>(initial);
  const [applied, setApplied] = useState<AuditLogSearchFilters>(initial);

  const setDraftField = useCallback(<K extends keyof AuditLogSearchFilters>(key: K, value: AuditLogSearchFilters[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);
  const apply = useCallback(() => setApplied(draft), [draft]);
  const reset = useCallback(() => {
    setDraft(EMPTY_AUDIT_LOG_SEARCH_FILTERS);
    setApplied(EMPTY_AUDIT_LOG_SEARCH_FILTERS);
  }, []);
  const where = useMemo(() => buildAuditLogSearchWhere(applied), [applied]);

  return { draft, setDraftField, applied, apply, reset, where };
}
