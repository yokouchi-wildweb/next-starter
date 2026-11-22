// src/domains/core/setting/services/server/codeValues.ts
// コードで持つキー(config の codeValues)を読み込み時に 1 回検証した値(合わなければここで止まる)。
// 読み手: settingService(読みに重ねる・DB を読まない判定)・save.ts(保存を断る)・settingActor(設定画面の欄を読み取り専用にする)

import { settingConfig } from "../../config";
import { fields } from "../../extensions/fields";
import { resolveCodeValues } from "../../utils/codeValues";

export const codeValues = resolveCodeValues(settingConfig.codeValues as Record<string, unknown>, fields);

/** コードで持つキーか */
export const isCodeKey = (key: string): boolean => Object.hasOwn(codeValues, key);

/** コードで持つキーの名前 */
export const codeValueKeys: readonly string[] = Object.freeze(Object.keys(codeValues));
