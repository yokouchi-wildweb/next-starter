// src/features/setting/hooks/usePublicSetting.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";

import type { SettingValues } from "../entities";
import { settingClient } from "../services/client/settingClient";

/** 公開の設定(ログイン不要。public: true のキーだけ) */
export const usePublicSetting = () => useDomain<Partial<SettingValues>>("setting/public", () => settingClient.getPublic());
