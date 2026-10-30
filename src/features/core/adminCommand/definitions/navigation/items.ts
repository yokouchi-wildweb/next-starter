// src/features/core/adminCommand/definitions/navigation/items.ts

import { navigationItems as groups } from "../../extensions/navigationItems";

/** ナビゲーション先の一覧。足すときは navigationItems/<名前>[.<fork の名前>].ts */
export const navigationItems = groups.flat();
