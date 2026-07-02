// src/features/setting/services/server/settingService.ts
import type { Setting } from "@/features/core/setting/entities";
import type { User } from "@/features/core/user/entities";
import { createAdmin } from "@/features/core/user/services/server/creation/console";
import { getZodDefaults } from "@/lib/zod";

import { settingExtendedSchema } from "../../setting.extended";
import type { SettingExtended } from "../../setting.extended";
import type { AdminSetupInput } from "../types";
import { base, extendedKeys, splitExtendedFields } from "./drizzleBase";

const DEFAULT_ADMIN_LIST_PER_PAGE = 50;

/**
 * DBの行データ（extended jsonb を含む）をフラットな Setting 型に変換する
 */
function flattenSettingRow(
  row: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Setting {
  const { extended, ...baseFields } = row;
  const extendedData = settingExtendedSchema.safeParse({
    ...defaults,
    ...(extended as Record<string, unknown> | null),
  });

  return {
    ...baseFields,
    ...(extendedData.success ? extendedData.data : defaults),
  } as Setting;
}

const createDefaultSettingValues = (): Record<string, unknown> => ({
  // 基本設定項目
  adminListPerPage: DEFAULT_ADMIN_LIST_PER_PAGE,
  // 拡張設定項目（setting.extended.ts から自動取得）
  ...getZodDefaults(settingExtendedSchema),
});

async function getGlobalSetting(): Promise<Setting> {
  const existing = await base.get("global");
  const defaultValues = createDefaultSettingValues();

  if (!existing) {
    return {
      id: "global",
      createdAt: null,
      updatedAt: null,
      ...defaultValues,
    } as Setting;
  }

  const setting = flattenSettingRow(
    existing as unknown as Record<string, unknown>,
    defaultValues,
  );

  return {
    ...setting,
    adminListPerPage: setting.adminListPerPage ?? DEFAULT_ADMIN_LIST_PER_PAGE,
  };
}

/**
 * global 設定を部分更新する（extended jsonb をマージ）
 *
 * setting は singleton（id="global"）。基本カラムは createCrudService の update が
 * 「送られてきた列だけ」を更新するので問題ないが、extended は単一の jsonb カラムのため
 * 送られてきたキーだけで書くと他の拡張フィールドが黙って全消しされる。
 * そこで現在の extended を読み出し、送られてきた拡張フィールドだけを上書きした
 * 完全な集合を書き戻す。
 *
 * マージ方針: 拡張フィールド単位の shallow マージ。配列は連結せず置換される
 * （incoming の配列がそのまま現在値を置き換える）。ネストした object も同様に丸ごと置換。
 * 全フィールドを送る EditSettingSectionForm 経路は「全集合とマージ」＝同結果で無害。
 */
async function updateGlobalSetting(
  data: Parameters<typeof base.update>[1],
  tx?: Parameters<typeof base.update>[2],
): Promise<Setting> {
  const { base: incomingBase, extended: incomingExtended } = splitExtendedFields(
    data as Record<string, unknown>,
  );

  // 拡張フィールドが更新対象に含まれるときのみ現在値とマージする。
  let mergedExtendedFlat: Record<string, unknown> = incomingExtended;
  if (Object.keys(incomingExtended).length > 0) {
    const current = (await getGlobalSetting()) as unknown as Record<string, unknown>;
    const currentExtended: Record<string, unknown> = {};
    for (const key of extendedKeys) {
      if (key in current) currentExtended[key] = current[key];
    }
    mergedExtendedFlat = { ...currentExtended, ...incomingExtended };
  }

  const updated = await base.update(
    "global",
    { ...incomingBase, ...mergedExtendedFlat } as Parameters<typeof base.update>[1],
    tx,
  );

  // get と同じフラット形状で返す（update の戻り値を nested のまま返さない）。
  if (!updated) return getGlobalSetting();
  return flattenSettingRow(
    updated as unknown as Record<string, unknown>,
    createDefaultSettingValues(),
  );
}

/**
 * 拡張フィールドの一部だけを安全に更新する便宜メソッド。
 * 例: settingService.updateFields({ someFlag: true }) — 他フィールドは保持される。
 */
async function updateFields(partial: Partial<Setting>): Promise<Setting> {
  return updateGlobalSetting(partial as Parameters<typeof base.update>[1]);
}

async function getAdminListPerPage(): Promise<number> {
  const setting = await getGlobalSetting();
  return setting.adminListPerPage;
}

/**
 * 現在メンテナンス期間内かどうか判定
 * DB上の maintenanceEnabled / maintenanceStartAt / maintenanceEndAt を参照する
 */
async function isMaintenanceActive(): Promise<boolean> {
  const setting = await getGlobalSetting();
  if (!setting.maintenanceEnabled) return false;

  const now = Date.now();
  const start = setting.maintenanceStartAt ? new Date(setting.maintenanceStartAt).getTime() : null;
  const end = setting.maintenanceEndAt ? new Date(setting.maintenanceEndAt).getTime() : null;

  if (start !== null && now < start) return false;
  if (end !== null && now >= end) return false;

  return true;
}

export async function initializeAdminSetup(data: AdminSetupInput): Promise<User> {
  const user = await createAdmin(data);
  const defaultValues = createDefaultSettingValues();
  const existing = await base.get("global");

  const createData = { id: "global", ...defaultValues } as Parameters<typeof base.create>[0];
  if (!existing) {
    await base.create(createData);
  } else {
    await base.update("global", defaultValues as Parameters<typeof base.update>[1]);
  }

  return user;
}

export const settingService = {
  ...base,
  get: async (_id: string) => getGlobalSetting(),
  // extended jsonb をマージ更新するオーバーライド（全消し footgun を safe-by-default 化）
  update: (_id: string, data: Parameters<typeof base.update>[1], tx?: Parameters<typeof base.update>[2]) =>
    updateGlobalSetting(data, tx),
  getGlobalSetting,
  updateFields,
  getAdminListPerPage,
  isMaintenanceActive,
  DEFAULT_ADMIN_LIST_PER_PAGE,
  initializeAdminSetup,
};
