// src/features/setting/services/client/settingClient.ts

import axios from "axios";

import type { Setting, SettingValues } from "@/features/core/setting/entities";
import type { SettingUpdateFields } from "@/features/core/setting/entities/form";
import { normalizeHttpError } from "@/lib/errors";

const ADMIN_URL = "/api/setting/admin";

export const settingClient = {
  /** 管理者向けの読み(ロールに許されたキーだけ) */
  getById: async (_id: string): Promise<Setting> => {
    try {
      const { data } = await axios.get<Setting>(ADMIN_URL);
      return data;
    } catch (error) {
      throw normalizeHttpError(error);
    }
  },
  update: async (_id: string, data: SettingUpdateFields): Promise<Setting> => {
    try {
      const { data: updated } = await axios.patch<Setting>(ADMIN_URL, { data });
      return updated;
    } catch (error) {
      throw normalizeHttpError(error);
    }
  },
  /** 公開の設定(public: true のキーだけ) */
  getPublic: async (): Promise<Partial<SettingValues>> => {
    try {
      const { data } = await axios.get<Partial<SettingValues>>("/api/setting/public");
      return data;
    } catch (error) {
      throw normalizeHttpError(error);
    }
  },
};
