// src/lib/storage/client/appStorageClient.ts
import axios from "axios";
import type { UploadResult } from "../types";
import { normalizeHttpError } from "@/lib/errors";

export const appStorageClient = {
  upload: async (basePath: string, file: File): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("basePath", basePath);
    formData.append("file", file);

    try {
      const response = await axios.post<UploadResult>("/api/storage/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    } catch (error) {
      throw normalizeHttpError(error, "ファイルのアップロードに失敗しました");
    }
  },
  remove: async (pathOrUrl: string): Promise<void> => {
    try {
      await axios.post("/api/storage/delete", { pathOrUrl });
    } catch (error) {
      throw normalizeHttpError(error, "ファイルの削除に失敗しました");
    }
  },
};
