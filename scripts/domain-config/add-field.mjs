#!/usr/bin/env node
// dc:add <Domain>: 既存 domain.json の fields 末尾に対話でフィールドを足す（本体は cli/addField.mjs）
import { getCliArgs } from "./cli/args.mjs";
import { runAddField } from "./cli/addField.mjs";
import { runCli } from "./cli/run.mjs";
import { createWorkspace } from "./domain/workspace.mjs";

runCli(() => runAddField(createWorkspace(), getCliArgs()[0]));
