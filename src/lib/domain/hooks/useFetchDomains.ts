// src/lib/domain/hooks/useFetchDomains.ts

"use client";

import useSWR from "swr";

import { domainClient } from "../service/client/domainClient";
import type { DomainInfoWithCount } from "../types";

const DOMAINS_KEY = "admin/domains";

/**
 * ドメイン一覧を取得するフック
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
