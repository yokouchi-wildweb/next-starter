// src/features/setting/services/server/settingService.ts
import type { Setting, SettingValues } from "@/features/core/setting/entities";
import type { User } from "@/features/core/user/entities";
import { createAdmin } from "@/features/core/user/services/server/creation/console";
import { checkAdminUserExists } from "@/features/core/user/services/server/finders/checkAdminUserExists";
import { isDatabaseConfigured } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";

import { settingConfig } from "../../config";
import { fields } from "../../extensions/fields";
import { isMaintenanceWindowActive } from "../../utils/maintenanceWindow";
import type { AdminSetupInput } from "../types";
import { codeValueKeys, codeValues, isCodeKey } from "./codeValues";
import { base } from "./drizzleBase";
import { readSettingValues } from "./read";
import { createReadMemo } from "./readMemo";
import { saveSettingValues } from "./save";

type Stored = { row: Awaited<ReturnType<typeof base.get>> | null; stored: Record<string, unknown> | null };

/** 期限つきのメモの中身: DB の 1 行の読み(期限 = config の readMemoMs) */
const storedMemo = createReadMemo<Stored>(async () => {
  const row = await base.get("global");
  return { row: row ?? null, stored: (row?.extended as Record<string, unknown> | null | undefined) ?? null };
}, () => settingConfig.readMemoMs);

/** 保存値(行が無い・DB 未構成なら null)。DB 未構成で止めない: maintenanceProxy / (user) 配下の表示のため。接続できない場合は例外のまま(障害を隠さない) */
async function readStored(): Promise<Stored> {
  if (!isDatabaseConfigured()) return { row: null, stored: null };
  return storedMemo.get();
}

/** 保存の後: このインスタンスの読みのメモとリクエストのメモを捨てる */
function invalidateReads(): void {
  storedMemo.clear();
  base.invalidateRequestMemo();
}

async function getGlobalSetting(): Promise<Setting> {
  const keys = Object.keys(fields).filter((key) => !isCodeKey(key));
  const { row, stored } = keys.length > 0 ? await readStored() : { row: null, stored: null };
  return {
    id: "global",
    createdAt: row?.createdAt ?? null,
    updatedAt: row?.updatedAt ?? null,
    ...readSettingValues(stored, fields, keys),
    ...codeValues,
  } as Setting;
}

/**
 * 必要なキーだけを読む(proxy・health・maintenance loader。ほかのキーの検証を走らせない)。
 * コードで持つキーはコードの値。頼んだキーが全部コードで持つキーなら DB を読まない
 */
async function readSettingKeys<K extends keyof SettingValues>(keys: readonly K[]): Promise<Pick<SettingValues, K>> {
  const rest = keys.filter((key) => !isCodeKey(key as string)) as readonly string[];
  const stored = rest.length > 0 ? (await readStored()).stored : null;
  const values = rest.length > 0 ? readSettingValues(stored, fields, rest) : {};
  const codePart = Object.fromEntries(keys.filter((key) => isCodeKey(key as string)).map((key) => [key, codeValues[key as string]]));
  return { ...values, ...codePart } as Pick<SettingValues, K>;
}

/** 設定の保存。送ったキーだけを検証して重ねる(./save.ts。コードで持つキーは 409) */
async function updateFields(partial: Partial<SettingValues>): Promise<Setting> {
  await saveSettingValues(partial as Record<string, unknown>);
  invalidateReads();
  return getGlobalSetting();
}

async function getAdminListPerPage(): Promise<number> {
  const { adminListPerPage } = await readSettingKeys(["adminListPerPage"]);
  return adminListPerPage;
}

/** 現在メンテナンス期間内かどうか判定(キー maintenance。コードで持てば DB を読まない) */
async function isMaintenanceActive(): Promise<boolean> {
  const { maintenance } = await readSettingKeys(["maintenance"]);
  return isMaintenanceWindowActive(maintenance, Date.now());
}

export async function initializeAdminSetup(data: AdminSetupInput): Promise<User> {
  // 初回セットアップ専用: 管理者が既に存在する場合は未認証経路からの管理者追加を拒否する
  // NOTE: 存在チェックと作成は同一トランザクションではないため、初回セットアップ完了前の
  // 一瞬だけ同時リクエストで管理者が複数作られうる競合窓が理論上残る（TOCTOU）。
  // 初回セットアップ時点では実運用が始まっていないため、このリスクは受容する方針
  // （advisory lock 等での厳密化は意図的に見送り）。管理者が1人でも存在すれば以降は完全に閉じる。
  if (await checkAdminUserExists()) {
    throw new DomainError("セットアップは完了済みです", { status: 409 });
  }

  // role はクライアント入力を無視して admin 固定（セットアップUIにロール選択は存在しない）
  const user = await createAdmin({ ...data, role: "admin" });
  // 行を作るだけ。既定値は書かない
  if (!(await base.get("global"))) await base.create({ id: "global" });
  invalidateReads();

  return user;
}

const closed = (name: string) => async (): Promise<never> => {
  throw new DomainError(`setting の ${name} はできません`, { status: 405 });
};

export const settingService = {
  ...base,
  get: async (_id: string) => getGlobalSetting(),
  // 値の書き手は保存処理だけ(行を作るのは initializeAdminSetup の base.create)
  update: (_id: string, data: Partial<SettingValues>) => updateFields(data),
  create: closed("create"),
  upsert: closed("upsert"),
  remove: closed("remove"),
  getGlobalSetting,
  readSettingKeys,
  updateFields,
  getAdminListPerPage,
  isMaintenanceActive,
  initializeAdminSetup,
  /** コードで持つキーの名前(config の codeValues) */
  codeValueKeys,
};
