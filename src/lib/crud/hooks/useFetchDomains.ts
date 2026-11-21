// src/lib/crud/hooks/useFetchDomains.ts

"use client";

import useSWR from "swr";

import type { DomainInfoWithCount } from "@/lib/domain";

import { domainClient } from "../client/domainClient";

const DOMAINS_KEY = "admin/domains";

/**
 * ドメイン一覧を取得するフック(管理画面の全件削除の一覧)
 */
export function useFetchDomains() {
  const { data, error, isLoading, mutate } = useSWR<DomainInfoWithCount[]>(
    DOMAINS_KEY,
    () => domainClient.fetchDomains(),
    {
      revalidateOnFocus: false,
    }
  );

  return {
    domains: data ?? [],
    isLoading,
    error: error as Error | undefined,
    refetch: mutate,
  };
}
