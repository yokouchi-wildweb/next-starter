import fs from 'fs';
import path from 'path';
import { removeObjectEntry, scanObjectEntries, upsertObjectEntry } from './utils/objectEntry.mjs';

// domain.json のメディア項目（mediaUploader / mediaUploaderMulti）から、ファイル用途を
// src/registry/storagePurposeRegistry.ts の AUTO ブロックへ書き込む。AUTO ブロックの外（CORE の展開・FORK）は触らない。
// 導出の規則: src/features/README.md「ファイルの保存（storage）」

const OBJECT_NAME = 'storagePurposeRegistry';
const START_MARKER = '// --- AUTO-GENERATED-START ---';
const END_MARKER = '// --- AUTO-GENERATED-END ---';
const CONFIG_IMPORT = 'import { STORAGE_CONFIG } from "@/config/app/storage.config";';
const MEDIA_FIELD_TYPES = new Set(['mediaUploader', 'mediaUploaderMulti']);
const READ_OPERATIONS = new Set(['list', 'get', 'search', 'count']);
const PURPOSE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9_]*$/;
const ADMIN_RULE = { roleCategories: ['admin'] };
const VISIBILITIES = new Set(['public', 'private']);
const PRESETS = new Set(['images', 'videos', 'imagesAndVideos', 'all']);
const METADATA_VALUES = new Set(['strip', 'keep']);
// strip の用途で受け付ける画像の型（src/lib/storage/metadata.ts の STRIP_IMAGE_TYPES と同じ。"image/*" はこの集合に読み替えられる）
const STRIP_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

function isImagePattern(contentType) {
  return contentType.toLowerCase().startsWith('image/');
}

// strip で描き直せない画像の型（image/heic・image/svg+xml など）。"image/*" と STRIP_IMAGE_TYPES は描き直せる
function isUnprocessableImagePattern(contentType) {
  const normalized = contentType.toLowerCase();
  return isImagePattern(normalized) && normalized !== 'image/*' && !STRIP_IMAGE_TYPES.has(normalized);
}

function registryPath(rootDir) {
  return path.join(rootDir, 'src', 'registry', 'storagePurposeRegistry.ts');
}

// ロール ID → カテゴリ（src/features/core/user/roles/*.role.json）
export function loadRoleCategories(rootDir) {
  const dir = path.join(rootDir, 'src', 'features', 'core', 'user', 'roles');
  const categories = new Map();
  if (!fs.existsSync(dir)) return categories;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.role.json')) continue;
    try {
      const json = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      if (json.id) categories.set(json.id, json.category ?? 'user');
    } catch {
      // 読めないロール定義は role:generate 側で検出される
    }
  }
  return categories;
}

function isValidRule(rule) {
  if (rule === 'public' || rule === 'authenticated' || rule === 'none') return true;
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return false;
  const okList = (v) => v === undefined || (Array.isArray(v) && v.every((x) => typeof x === 'string'));
  return okList(rule.roles) && okList(rule.roleCategories) && (rule.roles !== undefined || rule.roleCategories !== undefined);
}

// 汎用 API と同じ解決順: operations[op] → read / write → 既定（管理者のみ）
export function resolveOperationRule(apiAccess, operation) {
  if (!apiAccess) return ADMIN_RULE;
  const opRule = apiAccess.operations?.[operation];
  if (isValidRule(opRule)) return opRule;
  const groupRule = READ_OPERATIONS.has(operation) ? apiAccess.read : apiAccess.write;
  if (isValidRule(groupRule)) return groupRule;
  return ADMIN_RULE;
}

// アップロードの許可者 = 複数の規則の和。アップロードは常にログインが要るので public は authenticated にする。
// none は数えない。全部 none なら管理者のみ（fail-closed）
export function unionUploadRules(rules) {
  const effective = rules.filter((rule) => rule && rule !== 'none');
  if (effective.length === 0) return ADMIN_RULE;
  if (effective.some((rule) => rule === 'public' || rule === 'authenticated')) return 'authenticated';
  const roles = new Set();
  const roleCategories = new Set();
  for (const rule of effective) {
    (rule.roles ?? []).forEach((r) => roles.add(r));
    (rule.roleCategories ?? []).forEach((c) => roleCategories.add(c));
  }
  const result = {};
  if (roles.size > 0) result.roles = [...roles];
  if (roleCategories.size > 0) result.roleCategories = [...roleCategories];
  return result;
}

// 一般利用者（admin 以外のカテゴリ）が通る規則か。カテゴリの分からないロールは一般利用者として扱う（安全側）
export function allowsGeneralUser(rule, roleCategories) {
  if (rule === 'public' || rule === 'authenticated') return true;
  if (!rule || typeof rule !== 'object') return false;
  if ((rule.roleCategories ?? []).some((category) => category !== 'admin')) return true;
  return (rule.roles ?? []).some((role) => (roleCategories.get(role) ?? 'user') !== 'admin');
}

function serializeRule(rule) {
  if (typeof rule === 'string') return JSON.stringify(rule);
  const parts = [];
  if (rule.roles) parts.push(`roles: ${JSON.stringify(rule.roles).replace(/,/g, ', ')}`);
  if (rule.roleCategories) parts.push(`roleCategories: ${JSON.stringify(rule.roleCategories).replace(/,/g, ', ')}`);
  return `{ ${parts.join(', ')} }`;
}

function serializeStringArray(values) {
  return `[${values.map((v) => JSON.stringify(v)).join(', ')}]`;
}

/**
 * domain.json からファイル用途のエントリを組み立てる（ファイルには触れない）。
 * @returns {{ entries: { id: string, value: string }[], warnings: string[], errors: string[] }}
 */
export function buildStoragePurposeEntries({ camel, config, roleCategories = new Map() }) {
  const entries = [];
  const warnings = [];
  const errors = [];
  const apiAccess = config.apiAccess ?? null;

  for (const field of config.fields ?? []) {
    if (!MEDIA_FIELD_TYPES.has(field.fieldType)) continue;
    const id = `${camel}.${field.name}`;
    if (!PURPOSE_ID_PATTERN.test(id)) {
      errors.push(`${id}: 用途 ID が <domain>.<field> の形式（${PURPOSE_ID_PATTERN}）に合いません`);
      continue;
    }

    const contentTypes = String(field.accept ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (contentTypes.length === 0) {
      errors.push(`${id}: accept が空です（受け付ける型を書いてください）`);
      continue;
    }

    let maxBytes;
    const declaredMax = field.validationRule?.maxSizeBytes;
    if (Number.isInteger(declaredMax) && declaredMax > 0) {
      maxBytes = String(declaredMax);
    } else {
      const preset = PRESETS.has(field.mediaTypePreset) ? field.mediaTypePreset : 'all';
      maxBytes = `STORAGE_CONFIG.defaultMaxBytesByPreset.${preset}`;
      warnings.push(
        `${id}: validationRule.maxSizeBytes が無いため、既定の上限 ${maxBytes}（src/config/app/storage.config.ts）を使います`,
      );
    }

    const storage = field.storage ?? {};
    if (storage.visibility !== undefined && !VISIBILITIES.has(storage.visibility)) {
      errors.push(`${id}: storage.visibility は "public" か "private" にしてください`);
      continue;
    }
    if (storage.upload !== undefined && (!isValidRule(storage.upload) || storage.upload === 'public')) {
      errors.push(`${id}: storage.upload は "authenticated" / "none" / { roles, roleCategories } のいずれかにしてください`);
      continue;
    }

    if (storage.metadata !== undefined && !METADATA_VALUES.has(storage.metadata)) {
      errors.push(`${id}: storage.metadata は "strip" か "keep" にしてください`);
      continue;
    }
    // 画像を含む項目の省略 = strip（登録表には明示値で書き出す）。画像の無い項目には書き出さない
    const hasImage = contentTypes.some(isImagePattern);
    const metadata = hasImage ? (storage.metadata ?? 'strip') : undefined;
    if (!hasImage && storage.metadata === 'strip') {
      errors.push(`${id}: 画像の型が accept に無い項目に storage.metadata: "strip" は書けません（strip は画像にだけ効きます）`);
      continue;
    }
    const unprocessable = metadata === 'strip' ? contentTypes.filter(isUnprocessableImagePattern) : [];
    if (unprocessable.length > 0) {
      errors.push(
        `${id}: storage.metadata が strip（省略時を含む）の項目の accept に、サーバーで描き直せない画像の型 ${unprocessable.join(', ')} があります` +
          `（受け付けられるのは ${[...STRIP_IMAGE_TYPES].join(' / ')}。原本のまま受けるなら storage.metadata: "keep"）`,
      );
      continue;
    }

    const uploadAllow =
      storage.upload ?? unionUploadRules([resolveOperationRule(apiAccess, 'create'), resolveOperationRule(apiAccess, 'update')]);
    const getRule = resolveOperationRule(apiAccess, 'get');

    let visibility = storage.visibility;
    if (!visibility) {
      if (allowsGeneralUser(uploadAllow, roleCategories)) {
        errors.push(
          `${id}: 一般利用者がアップロードできる項目です。domain.json の storage.visibility（"public" / "private"）を明示してください`,
        );
        continue;
      }
      visibility = getRule === 'public' ? 'public' : 'private';
    }

    const parts = [
      `visibility: ${JSON.stringify(visibility)}`,
      `maxBytes: ${maxBytes}`,
      `contentTypes: ${serializeStringArray(contentTypes)}`,
      ...(metadata ? [`metadata: ${JSON.stringify(metadata)}`] : []),
      `upload: { allow: ${serializeRule(uploadAllow)} }`,
    ];
    if (visibility === 'private') parts.push(`read: { allow: ${serializeRule(getRule)} }`);
    entries.push({ id, value: `{ ${parts.join(', ')} }` });
  }

  return { entries, warnings, errors };
}

function isInsideAutoBlock(text, index) {
  const start = text.indexOf(START_MARKER);
  const end = text.indexOf(END_MARKER);
  return start !== -1 && end !== -1 && index > start && index < end;
}

// 本文で STORAGE_CONFIG を使っているかに import を合わせる
export function syncStorageConfigImport(text) {
  const withoutImport = text.split('\n').filter((line) => line.trim() !== CONFIG_IMPORT).join('\n');
  const used = /\bSTORAGE_CONFIG\./.test(withoutImport);
  const hasImport = text.split('\n').some((line) => line.trim() === CONFIG_IMPORT);
  if (used === hasImport) return text;
  if (!used) return withoutImport;
  const lines = text.split('\n');
  let lastImport = -1;
  lines.forEach((line, i) => {
    if (line.startsWith('import ')) lastImport = i;
  });
  lines.splice(lastImport + 1, 0, CONFIG_IMPORT);
  return lines.join('\n');
}

/**
 * 登録表の文字列に、1 ドメイン分の用途を反映する（AUTO ブロックの upsert と、消えた項目の削除）。
 * @returns {{ text: string, skipped: string[] }} skipped = AUTO 外に同じ ID があり上書きしなかった ID
 */
export function applyStoragePurposeEntries(text, { camel, entries }) {
  let next = text;
  const skipped = [];
  const ids = new Set(entries.map((e) => e.id));

  for (;;) {
    const stale = scanObjectEntries(next, OBJECT_NAME).entries.find(
      (entry) => entry.key.startsWith(`${camel}.`) && !ids.has(entry.key) && isInsideAutoBlock(next, entry.start),
    );
    if (!stale) break;
    next = removeObjectEntry(next, { objectName: OBJECT_NAME, key: stale.key }).text;
  }

  for (const { id, value } of entries) {
    const existing = scanObjectEntries(next, OBJECT_NAME).entries.find((e) => e.key === id);
    if (existing && !isInsideAutoBlock(next, existing.start)) {
      skipped.push(id);
      continue;
    }
    next = upsertObjectEntry(next, { objectName: OBJECT_NAME, key: id, keyLiteral: JSON.stringify(id), value });
  }

  return { text: syncStorageConfigImport(next), skipped };
}

/** 登録表から 1 ドメイン分の AUTO エントリを消す（dc:delete）。AUTO 外のエントリは残す */
export function removeStoragePurposeEntries(text, { camel }) {
  let next = text;
  for (;;) {
    const target = scanObjectEntries(next, OBJECT_NAME).entries.find(
      (entry) => entry.key.startsWith(`${camel}.`) && isInsideAutoBlock(next, entry.start),
    );
    if (!target) break;
    next = removeObjectEntry(next, { objectName: OBJECT_NAME, key: target.key }).text;
  }
  return syncStorageConfigImport(next);
}

export default function updateStoragePurposeRegistry({ rootDir, camel }) {
  const filePath = registryPath(rootDir);
  if (!fs.existsSync(filePath)) return;
  const configPath = path.join(rootDir, 'src', 'features', camel, 'domain.json');
  if (!fs.existsSync(configPath)) return;
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const { entries, warnings, errors } = buildStoragePurposeEntries({
    camel,
    config,
    roleCategories: loadRoleCategories(rootDir),
  });
  warnings.forEach((w) => console.warn(`[storagePurposeRegistry] ${w}`));
  if (errors.length > 0) {
    throw new Error(`[storagePurposeRegistry] ファイル用途を生成できません:\n${errors.map((e) => ` - ${e}`).join('\n')}`);
  }

  const before = fs.readFileSync(filePath, 'utf8');
  const { text, skipped } = applyStoragePurposeEntries(before, { camel, entries });
  skipped.forEach((id) =>
    console.warn(`[storagePurposeRegistry] ${id}: AUTO ブロックの外に同じ ID があるため上書きしません（手書きの定義を使います）`),
  );
  if (text !== before) fs.writeFileSync(filePath, text);
}

export function removeStoragePurposesForDomain({ rootDir, camel }) {
  const filePath = registryPath(rootDir);
  if (!fs.existsSync(filePath)) return false;
  const before = fs.readFileSync(filePath, 'utf8');
  const after = removeStoragePurposeEntries(before, { camel });
  if (after === before) return false;
  fs.writeFileSync(filePath, after);
  return true;
}
