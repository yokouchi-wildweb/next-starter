"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { profileClient } from "../services/client/profileClient";

/**
 * プロフィールIDで削除するフック
 * @param role - ロールID（例: "contributor"）
 */
export const useProfileDelete = (role: string) =>
  useDeleteDomain(
    `profile:${role}/delete`,
    (id) => profileClient.remove(role, id).then(() => {}),
    `profile:${role}/search`,
  );
