// メンテナンスで止められた応答をクライアントが見分けられること(normalizeHttpError・err・isMaintenanceError)。
// - 503 + code "maintenance" は status・サーバーの文言・code を保ち、isMaintenanceError が true
// - 同じ 503 でも route_user_unavailable(利用者を確かめられない障害)は false(status では分けない)
// 実行: pnpm test src/lib/errors/httpError.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { MAINTENANCE_CODE, createHttpError, err, getErrorCode, isMaintenanceError, normalizeHttpError } from "./httpError";

function axiosError(status: number, data: unknown): AxiosError {
  const config = { url: "/api/x", headers: {} } as unknown as InternalAxiosRequestConfig;
  const response = { data, status, statusText: "", headers: {}, config };
  return new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, null, response);
}

const maintenanceMessage = "メンテナンス中のため、この操作は現在できません。";

test("メンテナンスの 503: status・サーバーの文言・code を保ち、isMaintenanceError が true", () => {
  const raw = axiosError(503, { message: maintenanceMessage, code: MAINTENANCE_CODE });
  const normalized = normalizeHttpError(raw, "保存に失敗しました");
  assert.equal(normalized.status, 503);
  assert.equal(normalized.message, maintenanceMessage);
  assert.equal(getErrorCode(normalized), MAINTENANCE_CODE);
  assert.equal(isMaintenanceError(normalized), true);
  assert.equal(err(raw, "保存に失敗しました"), maintenanceMessage);
});

test("同じ 503 でも route_user_unavailable はメンテナンスではない", () => {
  const normalized = normalizeHttpError(axiosError(503, { message: "確かめられません", code: "route_user_unavailable" }));
  assert.equal(normalized.status, 503);
  assert.equal(isMaintenanceError(normalized), false);
});

test("code の無いエラー・HttpError でない値はメンテナンスではない", () => {
  assert.equal(isMaintenanceError(normalizeHttpError(axiosError(500, { message: "x" }))), false);
  assert.equal(isMaintenanceError(createHttpError({ message: "x" })), false);
  assert.equal(isMaintenanceError(new Error("maintenance")), false);
  assert.equal(isMaintenanceError(null), false);
});
