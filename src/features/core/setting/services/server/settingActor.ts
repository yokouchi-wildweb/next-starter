// src/features/core/setting/services/server/settingActor.ts
// 管理者向けの読み書き(ロールごとに許されたキーだけ)と公開の読み。主体は呼び手(route の ctx.user・loader)が渡す。
// セクションの定義(アイコン)を読むので settingService とは分ける(settingService は proxy から読まれる)。

import { DomainError } from "@/lib/errors";

import type { Setting, SettingValues } from "../../entities";
import { fields } from "../../extensions/fields";
import { sections } from "../../extensions/sections";
import { publicSettingKeys, settingKeysFor } from "./access";
import { settingService } from "./settingService";

type Actor = { role: string };

/** そのロールに許されたキーだけを返す */
export async function getSettingForActor(actor: Actor): Promise<Partial<Setting>> {
  const allowed = new Set(settingKeysFor(actor.role, fields, sections));
  const setting = (await settingService.getGlobalSetting()) as unknown as Record<string, unknown>;
  const { id, createdAt, updatedAt } = setting;
  const values = Object.fromEntries(Object.keys(fields).filter((key) => allowed.has(key)).map((key) => [key, setting[key]]));
  return { id, createdAt, updatedAt, ...values } as Partial<Setting>;
}

/** 許されないキーが 1 つでもあれば 403(一部だけ保存しない) */
export async function saveSettingAsActor(actor: Actor, input: Record<string, unknown>): Promise<Partial<Setting>> {
  const allowed = new Set(settingKeysFor(actor.role, fields, sections));
  const denied = Object.keys(input).filter((key) => key in fields && !allowed.has(key));
  if (denied.length > 0) throw new DomainError("この設定を変更する権限がありません", { status: 403 });
  await settingService.updateFields(input as Partial<SettingValues>);
  return getSettingForActor(actor);
}

/** public: true のキーの値だけ */
export async function getPublicSetting(): Promise<Partial<SettingValues>> {
  return settingService.readSettingKeys(publicSettingKeys(fields) as (keyof SettingValues)[]);
}
