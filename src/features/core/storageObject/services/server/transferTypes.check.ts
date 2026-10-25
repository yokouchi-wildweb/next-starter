// src/features/core/storageObject/services/server/transferTypes.check.ts
//
// lib/storage/client の wire 型（IssueUploadResponse / CommitUploadResponse / PurposePolicyResponse）と、ルートが返す
// storageObjectService の IssueResult / CommitResult / PurposePolicyResult が一致することをコンパイル時に保証する（L1.15）。
// lib は features を import できないため、型を 2 か所に持ち、ここ（features 側）で双方向の代入を検査する。
// どちらかの型を変えて食い違うと `pnpm typecheck` が落ちる。実行時のコードは無い。

import type {
  CommitUploadResponse,
  IssueUploadResponse,
  PurposePolicyResponse,
} from "@/lib/storage/client/transferTypes";

import type { CommitResult, IssueResult, PurposePolicyResult } from "./storageObjectService";

/**
 * A と B が同じ型のときだけ true。互いの代入（双方向）では見逃す「片方だけにある省略可能なキー」や
 * readonly の違いも false にするため、TypeScript の型の同一判定を使う。
 */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

export const issueResponseMatches: Equals<IssueResult, IssueUploadResponse> = true;
export const commitResponseMatches: Equals<CommitResult, CommitUploadResponse> = true;
export const purposePolicyResponseMatches: Equals<PurposePolicyResult, PurposePolicyResponse> = true;
