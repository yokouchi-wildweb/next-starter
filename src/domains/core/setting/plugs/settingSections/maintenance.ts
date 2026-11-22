// src/domains/core/setting/sections/maintenance.ts

import { Construction } from "lucide-react";

import type { SettingSectionDefinition } from "@/domains/core/setting/types/definition";

export const section: SettingSectionDefinition = {
  key: "maintenance",
  label: "メンテナンス",
  order: 20,
  icon: Construction,
};
