// src/features/setting/entities/model.ts

import type { z } from "zod";

import type { BaseEntity } from "@/lib/crud";

import type { fields } from "../extensions/fields";

/** 全キーの値(キーの定義 ../fields/ から導く) */
export type SettingValues = {
  [K in keyof typeof fields]: z.infer<(typeof fields)[K]["schema"]>;
};

export type Setting = BaseEntity & SettingValues;
