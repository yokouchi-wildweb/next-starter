// generateFiles.clientServices: services/client/<domain>Client.ts

import path from "node:path";
import { file } from "../output.mjs";

/**
 * @param {import("../../domain/context.mjs").DomainContext} ctx
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @returns {import("../output.mjs").Output[]}
 */
export function renderClientServices(ctx, workspace) {
  const { camel, pascal } = ctx;
  const template = workspace.readTemplate("services", "client", "__domain__Client.ts");
  const content = template.replace(/__domain__/g, camel).replace(/__Domain__/g, pascal);
  return [file(path.join(ctx.dir, "services", "client", `${camel}Client.ts`), content, { label: "クライアントサービスを生成しました" })];
}
