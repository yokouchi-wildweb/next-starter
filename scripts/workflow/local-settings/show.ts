// scripts/workflow/local-settings/show.ts
//
// pnpm workflow local-settings show [--json]
// 今ここで効いている設定ファイル(managed・local・project・user)と、それぞれが決めていること(モード・印・allow / deny の数・
// PreToolUse のフック・MCP の有効化)を短く出す。何も書かない。
// 規則と使い方: scripts/workflow/local-settings/README.md

import { formatLayers, LocalSettingsError, resolvePaths, runAction, showLayers } from "./lib";

runAction((args) => {
  const extra = args.filter((a) => a !== "--json");
  if (extra.length) throw new LocalSettingsError(`知らない引数 ${extra.join(" ")}(--json だけ)`);
  const layers = showLayers(resolvePaths());
  console.log(args.includes("--json") ? JSON.stringify(layers, null, 2) : formatLayers(layers));
});
