// src/lib/errors/index.ts
// 名前を 1 つずつ書いて出す(`export *` だけの入口は tsx の ESM 読み込み(.mts のテスト)で名前を拾えないため)

export { BackendNotConfiguredError, isBackendNotConfiguredError } from "./backendNotConfiguredError";
export type { BackendNotConfiguredErrorOptions } from "./backendNotConfiguredError";
export { DomainError, isDomainError, toDomainErrorBody } from "./domainError";
export type { DomainErrorOptions } from "./domainError";
export {
  HttpError,
  MAINTENANCE_CODE,
  createHttpError,
  err,
  getErrorCode,
  getErrorDetails,
  isHttpError,
  isMaintenanceError,
  normalizeHttpError,
  resolveErrorMessage,
} from "./httpError";
export type { HttpErrorParams, NormalizeHttpErrorOptions } from "./httpError";
