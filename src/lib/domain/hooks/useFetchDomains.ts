// src/lib/domain/hooks/useFetchDomains.ts

"use client";

import useSWR from "swr";

import { domainClient, type DomainInfo } from "../client/domainClient";

const DOMAINS_KEY = "admin/domains";

/**
 * ドメイン一覧を取得するフック
 */
export function useFetchDomains() {
  const { data, error, isLoading, mutate } = useSWR<DomainInfo[]>(
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
