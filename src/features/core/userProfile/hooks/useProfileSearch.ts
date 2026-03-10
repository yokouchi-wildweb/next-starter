"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { profileClient } from "../services/client/profileClient";
import type { SearchParams, WithOptions } from "@/lib/crud/types";

type ProfileSearchParams = SearchParams & WithOptions;

/**
 * プロフィール検索フック
 * @param role - ロールID（例: "contributor"）
 * @param params - 検索パラメータ
 */
export const useProfileSearch = (role: string, params: ProfileSearchParams) =>
  useSearchDomain<Record<string, unknown>, ProfileSearchParams>(
    `profile:${role}/search`,
    (p) => profileClient.search(role, p),
    params,
  );
