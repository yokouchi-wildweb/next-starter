// src/features/setting/services/client/adminSetupClient.ts

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type { AdminSetupInput } from "../types";

export type AdminSetupResult = { success: true };

export const adminSetupClient = {
  async initialize(data: AdminSetupInput): Promise<AdminSetupResult> {
    try {
      const response = await axios.post<AdminSetupResult>("/api/setting/setup", { data });
      return response.data;
    } catch (error) {
      throw normalizeHttpError(error, "初回セットアップに失敗しました");
    }
  },
};
