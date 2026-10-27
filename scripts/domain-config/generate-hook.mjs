#!/usr/bin/env node
// dc:generate:hook: フックを個別に選んで生成する（本体は cli/pick/hooks.mjs）
import { runPickHooks } from "./cli/pick/hooks.mjs";
import { runCli } from "./cli/run.mjs";

runCli(runPickHooks);
