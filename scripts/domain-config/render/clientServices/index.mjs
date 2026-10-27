// generateFiles.clientServices: services/client/<domain>Client.ts

import path from "node:path";
import { file } from "../output.mjs";
import { replaceDomainTokens } from "../tokens.mjs";

/**
 * @param {import("../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @returns {import("../output.mjs").Output[]}
 */
export function renderClientServices(ctx, workspace) {
  const content = replaceDomainTokens(workspace.readTemplate("services", "client", "__domain__Client.ts"), ctx);
  return [file(path.join(ctx.dir, "services", "client", `${ctx.camel}Client.ts`), content, { label: "クライアントサービスを生成しました" })];
}
