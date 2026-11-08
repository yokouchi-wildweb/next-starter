// src/lib/httpDefaults/install.ts — 既定の axios インスタンスへの request interceptor(設定の議会 D62)
//
// axios.defaults は書き換えない: axios.create は作った時の defaults を写すので、読み込みの順しだいで
// lib/storage の transferHttp(GCS への直接の転送)などにまで上限が漏れる。interceptor は渡したインスタンスにだけ付く。
// リトライはしない(POST・PUT・DELETE の二重の実行を避ける)。時間切れの書き込みはサーバー側で終わっていることがある。

import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";

import "./types";

/**
 * 呼び出しの設定に既定のタイムアウトを付ける(純関数、渡した設定を書き換えて返す)。
 * 付けるのは timeoutMs があり、呼び出しの timeout が無い(0 か未指定)で、defaultTimeout: false でないときだけ
 */
export function applyDefaultTimeout<C extends { timeout?: number; defaultTimeout?: false }>(request: C, timeoutMs: number | null): C {
  if (timeoutMs === null || request.defaultTimeout === false || request.timeout) return request;
  request.timeout = timeoutMs;
  return request;
}

const REGISTRY_KEY = "__nextStarterHttpDefaultsInterceptor";
type Registry = typeof globalThis & { [REGISTRY_KEY]?: { instance: AxiosInstance; id: number } };

/**
 * instance(既定は呼び手が渡す axios)に interceptor を 1 つだけ付ける。開発の再読み込みで二重にならないよう、前の登録を外して付け直す。
 * timeoutMs が null なら何も付けない(前の登録は外す)。戻り値 = 付けた interceptor の id か null
 */
export function installHttpDefaults(instance: AxiosInstance, timeoutMs: number | null): number | null {
  const registry = globalThis as Registry;
  const previous = registry[REGISTRY_KEY];
  if (previous) {
    previous.instance.interceptors.request.eject(previous.id);
    delete registry[REGISTRY_KEY];
  }
  if (timeoutMs === null) return null;
  const id = instance.interceptors.request.use((request: InternalAxiosRequestConfig) => applyDefaultTimeout(request, timeoutMs));
  registry[REGISTRY_KEY] = { instance, id };
  return id;
}
