// src/lib/httpDefaults/types.ts — 呼び出しの設定に既定のタイムアウトを外す印を足す(axios の型の拡張、設定の議会 D62)

declare module "axios" {
  interface AxiosRequestConfig {
    /**
     * false = この呼び出しには既定のタイムアウト(src/lib/httpDefaults)を付けない。
     * 件数やファイルの数だけ時間がかかる操作(CRUD の bulk*・replaceByQuery・duplicate など)が意図して「上限なし」にするときに書く
     */
    defaultTimeout?: false;
  }
}

export {};
