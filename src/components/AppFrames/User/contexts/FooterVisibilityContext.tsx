"use client";

import { createVisibilityContext, type DeviceVisibility } from "./createVisibilityContext";

/** @deprecated 枠の部品も Hide* も読まない・書かない(ページ単位で隠すのは Hide* の印の CSS、基本の表示は config/ui の値)。旧入口撤去の区切りで削除する */
export type FooterVisibility = DeviceVisibility;

const { Provider, useVisibility } = createVisibilityContext<FooterVisibility>("Footer", {
  sp: true,
  pc: true,
});

/** @deprecated 枠の部品も Hide* も読まない・書かない(ページ単位で隠すのは Hide* の印の CSS、基本の表示は config/ui の値)。旧入口撤去の区切りで削除する */
export const FooterVisibilityProvider = Provider;

/** @deprecated 枠の部品も Hide* も読まない・書かない(ページ単位で隠すのは Hide* の印の CSS、基本の表示は config/ui の値)。旧入口撤去の区切りで削除する */
export const useFooterVisibility = useVisibility;
