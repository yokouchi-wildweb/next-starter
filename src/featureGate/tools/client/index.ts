// src/featureGate/tools/client/index.ts
// client 側の道具の束。1 道具 1 ファイル、ここに 1 行ずつ足す。どれも server が渡した値(ClientGateState、Provider の外は null)を第 1 引数に取り、
// useGate がそれを結んで返す。名前は server の束(tools/server)と揃える(checks/gateTools.test.ts の束の名前の一致)

import { enabled } from "./enabled";
import { filter } from "./filter";
import { path } from "./path";

export const clientTools = {
  enabled,
  path,
  filter,
};
