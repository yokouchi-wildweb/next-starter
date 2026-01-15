// src/lib/domain/client/domainClient.ts

"use client";

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

// エンドポイント
const ENDPOINTS = {
  domains: "/api/admin/domains",
  truncate: "/api/admin/domains/truncate",
} as const;

// 型定義
export type DomainInfo = {
  key: string;
  label: string;
  tableName: string;
  isCore: boolean;
  recordCount: number;
};

export type FetchDomainsResponse = {
  domains: DomainInfo[];
};

export type TruncatePayload = {
  domains: string[];
  password: string;
};

export type TruncateResult = {
  domain: string;
  success: boolean;
  truncatedTables?: string[];
  error?: string;
};

export type TruncateResponse = {
  message: string;
  results: TruncateResult[];
};

/**
 * ドメイン一覧を取得する
 */
export async function fetchDomains(): Promise<DomainInfo[]> {
  try {
    const response = await axios.get<FetchDomainsResponse>(ENDPOINTS.domains);
    return response.data.domains;
  } catch (error) {
    throw normalizeHttpError(error, "ドメイン一覧の取得に失敗しました");
  }
}

/**
 * 指定されたドメインを削除する
 */
export async function truncateDomains(
  payload: TruncatePayload
): Promise<TruncateResponse> {
  try {
    const response = await axios.post<TruncateResponse>(
      ENDPOINTS.truncate,
      payload
    );
    return response.data;
  } catch (error) {
    throw normalizeHttpError(error, "ドメインの削除に失敗しました");
  }
}

// まとめてエクスポート
export const domainClient = {
  fetchDomains,
  truncateDomains,
};
