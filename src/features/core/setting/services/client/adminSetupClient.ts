// src/features/setting/services/client/adminSetupClient.ts

import axios from "axios";

import type { User } from "@/features/core/user/entities";
import { normalizeHttpError } from "@/lib/errors";

import type { AdminSetupInput } from "../types";

export const adminSetupClient = {
  async initialize(data: AdminSetupInput): Promise<User> {
    try {
      const response = await axios.post<User>("/api/setting/setup", { data });
      return response.data;
    } catch (error) {
      throw normalizeHttpError(error, "初回セットアップに失敗しました");
    }
  },
};
