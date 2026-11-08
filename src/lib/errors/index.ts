// src/lib/errors/index.ts
// 名前を 1 つずつ書いて出す(`export *` だけの入口は tsx の ESM 読み込み(.mts のテスト)で名前を拾えないため)

export { DomainError, isDomainError, toDomainErrorBody } from "./domainError";
export type { DomainErrorOptions } from "./domainError";
export {
  HttpError,
  createHttpError,
  err,
  getErrorCode,
  getErrorDetails,
  isHttpError,
  normalizeHttpError,
  resolveErrorMessage,
} from "./httpError";
export type { HttpErrorParams, NormalizeHttpErrorOptions } from "./httpError";
