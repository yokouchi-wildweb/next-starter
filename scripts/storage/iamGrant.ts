// scripts/storage/iamGrant.ts
//
// storage:setup が権限不足（HTTP 403）で止まったときに表示する案内を作る。
// サービスアカウントは自分に役割を付けられないため、付与は人の資格情報（プロジェクトのオーナー）で行う。
// ここではコマンドを実行せず、値を埋めた gcloud の 1 行と GCP コンソールの URL を組み立てるだけ。
// Firebase の初期化に依存しない純粋関数にしてあるのは、テストから読み込めるようにするため。

import { normalizeJsonString } from "@/utils/json";

export const STORAGE_ADMIN_ROLE = "roles/storage.admin";

export type IamGrantTarget = {
  projectId: string | null;
  clientEmail: string | null;
};

type Env = Record<string, string | undefined>;

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * 付与先のプロジェクトとサービスアカウントを env から取る。
 * プロジェクトは firebase-admin と同じ順（NEXT_PUBLIC_FIREBASE_PROJECT_ID → キーの project_id）で決める。
 * バケットはこのプロジェクトに作られるので、付与先もこれに合わせる。取れない値は null。
 */
export function resolveIamGrantTarget(env: Env): IamGrantTarget {
  let key: Record<string, unknown> = {};
  const raw = nonEmpty(env.MY_SERVICE_ACCOUNT_KEY);
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(normalizeJsonString(raw));
      if (parsed && typeof parsed === "object") key = parsed as Record<string, unknown>;
    } catch {
      // 解析できないキーは値なしとして扱う（案内はプレースホルダで出す）
    }
  }
  return {
    projectId: nonEmpty(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) ?? nonEmpty(key.project_id),
    clientEmail: nonEmpty(key.client_email),
  };
}

export function iamGrantCommand(target: IamGrantTarget): string {
  const project = target.projectId ?? "<project-id>";
  const member = target.clientEmail ?? "<サービスアカウントのメール>";
  return `gcloud projects add-iam-policy-binding ${project} --member=serviceAccount:${member} --role=${STORAGE_ADMIN_ROLE}`;
}

export function iamConsoleUrl(target: IamGrantTarget): string {
  return target.projectId
    ? `https://console.cloud.google.com/iam-admin/iam?project=${encodeURIComponent(target.projectId)}`
    : "https://console.cloud.google.com/iam-admin/iam";
}

/** HTTP 403 のときに表示する案内（複数行） */
export function formatIamGrantGuide(target: IamGrantTarget): string {
  const lines = [
    `権限が足りないため止めました（HTTP 403）。サービスアカウントに「Storage 管理者」（${STORAGE_ADMIN_ROLE}）を付けてください。`,
    "サービスアカウントは自分に役割を付けられません。プロジェクトのオーナーの資格（gcloud のログイン）で次の 1 行を実行してください（gcloud が無ければ Cloud Shell でも実行できます）:",
    "",
    `  ${iamGrantCommand(target)}`,
    "",
    `GCP コンソールで付ける場合: ${iamConsoleUrl(target)}`,
  ];
  if (!target.projectId || !target.clientEmail) {
    lines.push("（MY_SERVICE_ACCOUNT_KEY から読み取れなかった値は <> のまま表示しています）");
  }
  lines.push("付けた後、--dry-run からやり直してください（反映に 1〜2 分かかることがあります）。");
  return lines.join("\n");
}
