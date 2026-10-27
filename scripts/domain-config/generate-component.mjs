#!/usr/bin/env node
// dc:generate:component: コンポーネントを個別に選んで生成する（本体は cli/pick/components.mjs）
import { runPickComponents } from "./cli/pick/components.mjs";
import { runCli } from "./cli/run.mjs";

runCli(runPickComponents);
