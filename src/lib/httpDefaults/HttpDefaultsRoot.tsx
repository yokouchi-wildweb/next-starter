"use client";

// src/lib/httpDefaults/HttpDefaultsRoot.tsx — client の既定の axios に既定のタイムアウトを付ける部品(root の Provider の入れ子に 1 つ)
// 登録はこのモジュールの読み込み時に 1 回(子の effect や通信より先に効かせるため、描画の中ではしない)。server と route では読まれない

import axios from "axios";

import { httpDefaultsConfig } from "./config";
import { installHttpDefaults } from "./install";

installHttpDefaults(axios, httpDefaultsConfig.timeoutMs);

/** 何も描かない(読み込ませるための部品) */
export function HttpDefaultsRoot(): null {
  return null;
}
