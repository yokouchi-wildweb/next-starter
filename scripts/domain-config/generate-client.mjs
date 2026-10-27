#!/usr/bin/env node
// generate:client <Domain>: クライアントサービス（services/client/<domain>Client.ts）だけを生成する
import { getCliArgs } from "./cli/args.mjs";
import { runCli } from "./cli/run.mjs";
import { createDomainContext } from "./domain/context.mjs";
import { createWorkspace } from "./domain/workspace.mjs";
import { applyOutputs } from "./pipeline/apply.mjs";
import { renderClientServices } from "./render/clientServices/index.mjs";

runCli(() => {
  const domain = getCliArgs()[0];
  if (!domain) {
    throw new Error("使い方: node scripts/domain-config/generate-client.mjs <domain>");
  }
  const workspace = createWorkspace();
  applyOutputs(renderClientServices(createDomainContext(workspace, domain), workspace));
});
