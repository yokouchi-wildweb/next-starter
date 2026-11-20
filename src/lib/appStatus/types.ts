// src/lib/appStatus/types.ts — アプリの状態(/api/health の応答)とフックの options の型。説明: README.md

/** /api/health の応答(src/app/api/health/route.ts が satisfies で合わせる) */
export type AppStatusResponse = {
  /** ビルドごとに変わる ID(デプロイの検知に使う) */
  buildId: string;
  maintenance: {
    /** メンテナンスモードが有効か(raw の状態) */
    active: boolean;
    /** この viewer がバイパスできるか(true なら active でも止めない) */
    bypassed: boolean;
  };
};

export type UseAppStatusOptions = {
  /** 確かめる間隔(ミリ秒)。既定 = 設定の intervalMs */
  intervalMs?: number;
  /** 有効か。既定 true */
  enabled?: boolean;
  /** メンテナンスで止められた時。渡さなければ設定の maintenancePath へ移る(window.location.assign) */
  onMaintenance?: () => void;
  /** 新しいデプロイを見つけた時。渡さなければ読み直す(window.location.reload) */
  onNewDeploy?: () => void;
};

/** 1 回の確かめで起きたこと */
export type AppStatusEvent = "maintenance" | "newDeploy" | "none";
