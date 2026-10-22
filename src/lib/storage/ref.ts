// src/lib/storage/ref.ts
//
// 業務行に保存するファイル参照 `storage://<pub|priv>/<purposeId>/<ledgerId>.<ext>` の組み立て・解析と、
// 表示用 URL への解決（client-safe の純関数）。
// 公開 URL を組み立てるのはこのファイルの resolveStorageSrc だけ。ほかの場所でバケットのホストを書かない。

/** ref に現れる保存先。legacy（旧バケット）はサーバー内部だけの位置で、ref には出さない */
export const STORAGE_STORES = ["pub", "priv"] as const;
export type StorageStoreId = (typeof STORAGE_STORES)[number];

export const STORAGE_REF_SCHEME = "storage://";

/**
 * 用途 ID の形式: `<domain>.<field>`。
 * domain は英字始まりの英数字、field は英字始まりの英数字と `_`（例: user.avatar / purchaseRequest.bankProof / coupon.image_url）。
 * ref とオブジェクトのパスに入るため、使い始めた後は改名できない。
 */
export const STORAGE_PURPOSE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9_]*$/;

/** 台帳 ID（uuid の小文字表記） */
const LEDGER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 拡張子（ドットなし。contentTypes の対応表と "bin"） */
const EXTENSION_PATTERN = /^[a-z0-9]{1,10}$/;

export type StorageRef = {
  store: StorageStoreId;
  purposeId: string;
  ledgerId: string;
  ext: string;
};

export function isValidStoragePurposeId(value: string): boolean {
  return STORAGE_PURPOSE_ID_PATTERN.test(value);
}

function isStoreId(value: string): value is StorageStoreId {
  return (STORAGE_STORES as readonly string[]).includes(value);
}

/** 部品から ref 文字列を作る。部品の形式が不正なら throw（サーバーが発行時に使う） */
export function formatStorageRef(parts: StorageRef): string {
  const { store, purposeId, ledgerId, ext } = parts;
  if (!isStoreId(store)) throw new Error(`不正な store です: ${store}`);
  if (!isValidStoragePurposeId(purposeId)) throw new Error(`不正な用途 ID です: ${purposeId}`);
  if (!LEDGER_ID_PATTERN.test(ledgerId)) throw new Error(`不正な台帳 ID です: ${ledgerId}`);
  if (!EXTENSION_PATTERN.test(ext)) throw new Error(`不正な拡張子です: ${ext}`);
  return `${STORAGE_REF_SCHEME}${store}/${purposeId}/${ledgerId}.${ext}`;
}

/** ref 文字列を部品に分ける。形式に合わなければ null（未知の store も null） */
export function parseStorageRef(value: string | null | undefined): StorageRef | null {
  if (typeof value !== "string" || !value.startsWith(STORAGE_REF_SCHEME)) return null;
  const segments = value.slice(STORAGE_REF_SCHEME.length).split("/");
  if (segments.length !== 3) return null;
  const [store, purposeId, fileName] = segments;
  if (!isStoreId(store) || !isValidStoragePurposeId(purposeId)) return null;
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return null;
  const ledgerId = fileName.slice(0, dot);
  const ext = fileName.slice(dot + 1);
  if (!LEDGER_ID_PATTERN.test(ledgerId) || !EXTENSION_PATTERN.test(ext)) return null;
  return { store, purposeId, ledgerId, ext };
}

export function isStorageRef(value: unknown): value is string {
  return typeof value === "string" && parseStorageRef(value) !== null;
}

/**
 * 保存先の中でのオブジェクトキー `<purposeId>/<ledgerId>.<ext>`。
 * 実際のパスは store の prefix を前に付けたもの（server/stores.ts）。
 */
export function objectKeyOf(ref: string | StorageRef): string {
  const parsed = typeof ref === "string" ? parseStorageRef(ref) : ref;
  if (!parsed) throw new Error(`storage ref として解析できません: ${String(ref)}`);
  return `${parsed.purposeId}/${parsed.ledgerId}.${parsed.ext}`;
}

/** 非公開ファイルの固定 URL（都度認可して署名 URL へ 302 するルート） */
export function privateObjectPath(ledgerId: string): string {
  return `/api/storage/objects/${ledgerId}`;
}

export type ResolveStorageSrcOptions = {
  /**
   * 公開ファイルの base URL（STORAGE_PUBLIC_PREFIX を含めた、オブジェクトキーの直前まで）。
   * 省略時は NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL。テストや差し替え用。
   */
  publicBaseUrl?: string | null;
};

function readPublicBaseUrl(options?: ResolveStorageSrcOptions): string | null {
  const raw =
    options && "publicBaseUrl" in options
      ? options.publicBaseUrl
      : process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL;
  const trimmed = (raw ?? "").trim();
  return trimmed.length > 0 ? trimmed.replace(/\/+$/, "") : null;
}

/**
 * 保存値を表示用の URL に解決する。例外は投げない。
 * - null / 空 → null
 * - storage://pub/... → 公開 base + オブジェクトキー（base が未設定なら null）
 * - storage://priv/... → /api/storage/objects/<ledgerId>
 * - http(s) の URL と "/" で始まる値 → そのまま（凍結した旧 URL・静的ファイル）
 * - 解析できない storage:// とそれ以外の値 → null（未知の store を既定バケットに読み替えない）
 */
export function resolveStorageSrc(
  value: string | null | undefined,
  options?: ResolveStorageSrcOptions,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  if (trimmed.startsWith(STORAGE_REF_SCHEME)) {
    const ref = parseStorageRef(trimmed);
    if (!ref) return null;
    if (ref.store === "priv") return privateObjectPath(ref.ledgerId);
    const base = readPublicBaseUrl(options);
    return base ? `${base}/${objectKeyOf(ref)}` : null;
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) return trimmed;
  return null;
}

/**
 * 公開ファイルを配信するホスト（next/image の許可・CORS 診断の判定に使う）。
 * base URL が未設定・不正なら空配列。
 */
export function publicStorageHosts(options?: ResolveStorageSrcOptions): string[] {
  const base = readPublicBaseUrl(options);
  if (!base) return [];
  try {
    return [new URL(base).host];
  } catch {
    return [];
  }
}
