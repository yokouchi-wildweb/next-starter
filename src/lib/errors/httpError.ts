// src/lib/errors/httpError.ts

import axios from "axios";

export type HttpErrorParams = {
  message: string;
  status?: number;
  responseData?: unknown;
  cause?: unknown;
};

export class HttpError extends Error {
  status?: number;
  responseData?: unknown;
  cause?: unknown;

  constructor({ message, status, responseData, cause }: HttpErrorParams) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.responseData = responseData;
    this.cause = cause;
  }
}

export function createHttpError({
  message,
  status,
  responseData,
  cause,
}: HttpErrorParams): HttpError {
  const normalizedMessage = message.trim().length > 0 ? message : DEFAULT_FALLBACK_MESSAGE;

  return new HttpError({
    message: normalizedMessage,
    status,
    responseData,
    cause,
  });
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

function extractAxiosMessage(data: unknown): string | undefined {
  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object" && data !== null) {
    if ("message" in data) {
      const value = (data as { message?: unknown }).message;
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }
  }

  return undefined;
}

const DEFAULT_FALLBACK_MESSAGE = "リクエストに失敗しました";

export function normalizeHttpError(
  error: unknown,
  fallbackMessage: string = DEFAULT_FALLBACK_MESSAGE,
): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const responseData = error.response?.data;
    const messageFromResponse = extractAxiosMessage(responseData);
    const message = messageFromResponse ?? error.message ?? fallbackMessage;

    return new HttpError({
      message,
      status,
      responseData,
      cause: error,
    });
  }

  if (error instanceof Error) {
    return new HttpError({
      message: error.message || fallbackMessage,
      cause: error,
    });
  }

  return new HttpError({
    message: fallbackMessage,
    cause: error,
  });
}

/**
 * UI 向けに `HttpError` から表示文言を取得します。
 * 想定外に生の Error が届いた場合でもフォールバック文言を返します。
 */
export function resolveErrorMessage(error: unknown, fallbackMessage: string): string {
  const normalized = normalizeHttpError(error, fallbackMessage);
  return normalized.message || fallbackMessage;
}

/**
 * `resolveErrorMessage` の短縮エイリアス。
 */
export function err(error: unknown, fallbackMessage: string): string {
  return resolveErrorMessage(error, fallbackMessage);
}
