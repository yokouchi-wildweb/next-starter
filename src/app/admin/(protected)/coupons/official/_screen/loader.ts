// src/app/admin/(protected)/coupons/official/_screen/loader.ts
// /admin/coupons/official の loader。範囲 admin/(protected) の createLoader に管理画面の共通部品の組(一覧)を渡す 1 行。
// access = coupon の serviceRegistry の search(汎用 API と同じ解き方)。上流所有。差し替えは同じルートの _components/ で(src/lib/screens/README.md)

import "server-only";

import type { Coupon } from "@/features/core/coupon/entities/model";
import { createLoader } from "@/app/admin/(protected)/guard";
import { adminListParts } from "@/wiring/adminScreenParts";

export const loadAdminCouponOfficialListScreen = createLoader(adminListParts<Coupon>("coupon", { where: { field: "type", op: "eq", value: "official" } }));
