"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { profileClient } from "../services/client/profileClient";

/**
 * プロフィールIDで更新するフック
 * @param role - ロールID（例: "contributor"）
 */
export const useProfileUpdate = (role: string) =>
  useUpdateDomain<Record<string, unknown>, Record<string, unknown>>(
    `profile:${role}/update`,
    (id, data) => profileClient.update(role, id, data),
    `profile:${role}/search`,
  );
