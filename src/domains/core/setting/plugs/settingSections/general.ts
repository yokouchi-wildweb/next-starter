// src/domains/core/setting/sections/general.ts

import { Sliders } from "lucide-react";

import type { SettingSectionDefinition } from "@/domains/core/setting/types/definition";

export const section: SettingSectionDefinition = {
  key: "general",
  label: "基本設定",
  order: 10,
  icon: Sliders,
};
