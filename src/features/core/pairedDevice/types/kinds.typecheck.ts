// src/features/core/pairedDevice/types/kinds.typecheck.ts
// 型の契約の検査（pnpm typecheck が読む。どこからも import せず、実行もしない）
// - 項目の kind の文字列と scopeSchema から、kind 名の union と kind ごとの scope が導かれる（生成一覧と同じ形の写像）

import { z } from "zod";

import { definePairedDeviceKind, type PairedDeviceKindNamesOf, type PairedDeviceScopeIn } from "./kind";

const terminal = definePairedDeviceKind({ kind: "table_terminal", scopeSchema: z.object({ tableId: z.string() }) });
const kiosk = definePairedDeviceKind({ kind: "kiosk", scopeSchema: z.object({ storeId: z.string() }) });
const list = [terminal, kiosk] as const;
type Kinds = { readonly [I in (typeof list)[number] as I["kind"]]: I };

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

export const namesAreLiterals: Equals<PairedDeviceKindNamesOf<Kinds>, "table_terminal" | "kiosk"> = true;
export const scopeOfTerminal: Equals<PairedDeviceScopeIn<Kinds, "table_terminal">, { tableId: string }> = true;
export const scopeOfKiosk: Equals<PairedDeviceScopeIn<Kinds, "kiosk">, { storeId: string }> = true;
// @ts-expect-error 一覧に無い kind は引けない
export type UnknownKind = PairedDeviceScopeIn<Kinds, "nope">;
