// src/lib/storage/client/storageClient.ts
//
// アプリのルート（アップロード権の発行・commit・取り消し・削除・用途の方針）の HTTP クライアント。axios + normalizeHttpError。
// GCS への直接転送は drivers/ が行う。

"use client";

import axios, { type AxiosInstance } from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type { CommitUploadResponse, IssueUploadResponse, PurposePolicyResponse } from "./transferTypes";

export type IssueUploadInput = {
  purpose: string;
  contentType: string;
  size: number;
  scopeId?: string | null;
};

export function createStorageClient(http: AxiosInstance = axios) {
  return {
    async issue(input: IssueUploadInput): Promise<IssueUploadResponse> {
      try {
        const { data } = await http.post<IssueUploadResponse>("/api/me/storage/uploads", input);
        return data;
      } catch (error) {
        throw normalizeHttpError(error, "アップロードの準備に失敗しました");
      }
    },

    async commit(objectId: string): Promise<CommitUploadResponse> {
      try {
        const { data } = await http.post<CommitUploadResponse>(`/api/me/storage/uploads/${objectId}/commit`);
        return data;
      } catch (error) {
        throw normalizeHttpError(error, "アップロードの確定に失敗しました");
      }
    },

    /** 本人の未採用ファイルを取り消す（再送しても安全） */
    async discard(objectId: string): Promise<void> {
      try {
        await http.delete(`/api/me/storage/uploads/${objectId}`);
      } catch (error) {
        throw normalizeHttpError(error, "アップロードの取り消しに失敗しました");
      }
    },

    /** 用途の方針（metadata: strip / keep）。未登録の用途は 404 */
    async policy(purpose: string): Promise<PurposePolicyResponse> {
      try {
        const { data } = await http.get<PurposePolicyResponse>(`/api/storage/purposes/${encodeURIComponent(purpose)}`);
        return data;
      } catch (error) {
        throw normalizeHttpError(error, "アップロード用途の確認に失敗しました");
      }
    },

    /** 用途の delete 規則で、未紐付けのファイルを削除する */
    async remove(objectId: string): Promise<void> {
      try {
        await http.delete(`/api/storage/objects/${objectId}`);
      } catch (error) {
        throw normalizeHttpError(error, "ファイルの削除に失敗しました");
      }
    },
  };
}

export type StorageClient = ReturnType<typeof createStorageClient>;

export const storageClient: StorageClient = createStorageClient();
