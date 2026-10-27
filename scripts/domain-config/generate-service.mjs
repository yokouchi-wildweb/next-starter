#!/usr/bin/env node
// dc:generate:service: クライアント / サーバー / ベースサービスを個別に選んで生成する（本体は cli/pick/services.mjs）
import { runPickServices } from "./cli/pick/services.mjs";
import { runCli } from "./cli/run.mjs";

runCli(runPickServices);
