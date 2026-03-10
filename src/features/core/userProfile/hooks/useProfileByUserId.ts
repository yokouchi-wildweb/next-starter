"use client";

import { useDomain } from "@/lib/crud/hooks";
import { profileClient } from "../services/client/profileClient";

/**
 * userIdでプロフィールを取得するフック
 * @param role - ロールID（例: "contributor"）
 * @param userId - ユーザーID
 */
export const useProfileByUserId = (role: string, userId?: string | null) =>
  useDomain<Record<string, unknown> | undefined>(
    userId ? `profile:${role}:user:${userId}` : null,
    () => profileClient.getByUserId(role, userId!),
  );
