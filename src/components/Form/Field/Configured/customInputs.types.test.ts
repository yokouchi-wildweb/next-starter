// src/components/Form/Field/Configured/customInputs.types.test.ts
// 型テスト（typecheck で確かめる）: 登録の項目が 0 件でも組み込みの名前が通り、知らない名前は止まる
import type { FieldConfig } from "../types";

type FormInput = FieldConfig["formInput"];

export const builtin: FormInput[] = ["textInput", "custom", "asyncCombobox", "none"];
// @ts-expect-error 組み込みにも登録にも無い名前
export const unknownName: FormInput = "noSuchFormInputAnywhere";
