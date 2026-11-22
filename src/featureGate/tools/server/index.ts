// src/featureGate/tools/server/index.ts
// server(と proxy)側の道具の束。1 道具 1 ファイル、ここに 1 行ずつ足す(gate の名前空間 = この束)

import { assert } from "./assert";
import { domainOpen } from "./domainOpen";
import { enabled } from "./enabled";
import { filter } from "./filter";
import { path } from "./path";
import { plugs } from "./plugs";

export const serverTools = {
  enabled,
  assert,
  path,
  filter,
  domainOpen,
  plugs,
};
