"use client";

import { useDomain } from "@/lib/crud/hooks";
import { profileClient } from "../services/client/profileClient";

/**
 * プロフィールIDで単体取得するフック
 * @param role - ロールID（例: "contributor"）
 * @param id - プロフィールID
 */
export const useProfile = (role: string, id?: string | null) =>
  useDomain<Record<string, unknown> | undefined>(
    id ? `profile:${role}:${id}` : null,
    () => profileClient.get(role, id!),
  );
