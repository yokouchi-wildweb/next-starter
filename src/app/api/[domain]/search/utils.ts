import type { SearchParams } from "@/lib/crud";

// バリデーション失敗を表す API 層専用のエラー
class BadRequestError extends Error {}

// クエリパラメータから正の整数を解析するヘルパー
export function parsePositiveInteger(value: string | null, label: string) {
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError(`${label} は正の整数で指定してください`);
  }
  return parsed;
}

// orderBy クエリを配列形式に正規化するヘルパー
export function parseOrderBy(values: string[]): SearchParams["orderBy"] {
  if (values.length === 0) return undefined;
  if (values.length === 1) {
    const single = values[0]?.trim();
    if (!single) return undefined;
    if (single.startsWith("[")) {
      try {
        const parsed = JSON.parse(single);
        if (!Array.isArray(parsed)) {
          throw new BadRequestError("orderBy は [[field,\"ASC\"]] の配列形式で指定してください");
        }
        return parsed as SearchParams["orderBy"];
      } catch (error) {
        if (error instanceof BadRequestError) throw error;
        throw new BadRequestError("orderBy は JSON 形式か \"field:direction\" 形式で指定してください");
      }
    }
  }

  const entries: NonNullable<SearchParams["orderBy"]> = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    let field: string | undefined;
    let direction: string | undefined;
    const candidates = [":", ","] as const;

    for (const separator of candidates) {
      const parts = trimmed.split(separator);
      if (parts.length === 2) {
        [field, direction] = parts.map((part) => part.trim());
        break;
      }
    }

    if (!field || !direction) {
      throw new BadRequestError("orderBy は \"field:direction\" 形式で指定してください");
    }

    const normalizedDirection = direction.toUpperCase();
    if (normalizedDirection !== "ASC" && normalizedDirection !== "DESC") {
      throw new BadRequestError("orderBy の direction は ASC もしくは DESC を指定してください");
    }

    entries.push([field, normalizedDirection]);
  }

  return entries.length ? entries : undefined;
}

// searchFields クエリを配列へ整形するヘルパー
function parseStringList(values: string[]): string[] | undefined {
  if (values.length === 0) return undefined;
  const fields = values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return fields.length ? fields : undefined;
}

export function parseSearchFields(values: string[]): string[] | undefined {
  return parseStringList(values);
}

export function parseSearchPriorityFields(values: string[]): string[] | undefined {
  return parseStringList(values);
}

// searchRank の 1 フィールドあたりの weight 上限（クライアント指定の暴走抑止。サービス側は正数なら受理）
const SEARCH_RANK_MAX_WEIGHT = 100;
const SEARCH_RANK_MAX_FIELDS = 20;

/**
 * searchRank クエリを解析する（fail-closed）。
 * 受理形: "true" / "false" / "1" / "0" または JSON `{ "fields": [ "name", { "field": "email", "weight": 2 } ] }`
 * - 未知キー・不正な型・weight が 0 < w <= 100 以外・フィールド数超過は 400
 * - フィールド名は文字列のみ（生 SQL は一切通さない。実在カラムとの照合はサービス側で行う）
 */
export function parseSearchRank(value: string | null): SearchParams["searchRank"] {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const lowered = trimmed.toLowerCase();
  if (lowered === "true" || lowered === "1") return true;
  if (lowered === "false" || lowered === "0") return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new BadRequestError("searchRank は true / false もしくは { fields: [...] } の JSON で指定してください");
  }
  if (typeof parsed === "boolean") return parsed;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new BadRequestError("searchRank は true / false もしくは { fields: [...] } の JSON で指定してください");
  }

  const spec = parsed as Record<string, unknown>;
  for (const key of Object.keys(spec)) {
    if (key !== "fields") {
      throw new BadRequestError(`searchRank に未知のキー "${key}" が含まれています`);
    }
  }
  if (spec.fields === undefined) return true;
  if (!Array.isArray(spec.fields)) {
    throw new BadRequestError("searchRank.fields は配列で指定してください");
  }
  if (spec.fields.length > SEARCH_RANK_MAX_FIELDS) {
    throw new BadRequestError(`searchRank.fields は最大 ${SEARCH_RANK_MAX_FIELDS} 件までです`);
  }

  const fields = spec.fields.map((entry): string | { field: string; weight?: number } => {
    if (typeof entry === "string") {
      if (!entry.trim()) throw new BadRequestError("searchRank.fields に空のフィールド名が含まれています");
      return entry.trim();
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new BadRequestError("searchRank.fields の要素は文字列か { field, weight? } で指定してください");
    }
    const item = entry as Record<string, unknown>;
    for (const key of Object.keys(item)) {
      if (key !== "field" && key !== "weight") {
        throw new BadRequestError(`searchRank.fields に未知のキー "${key}" が含まれています`);
      }
    }
    if (typeof item.field !== "string" || !item.field.trim()) {
      throw new BadRequestError("searchRank.fields[].field は空でない文字列で指定してください");
    }
    if (item.weight !== undefined) {
      if (
        typeof item.weight !== "number" ||
        !Number.isFinite(item.weight) ||
        item.weight <= 0 ||
        item.weight > SEARCH_RANK_MAX_WEIGHT
      ) {
        throw new BadRequestError(`searchRank.fields[].weight は 0 より大きく ${SEARCH_RANK_MAX_WEIGHT} 以下の数値で指定してください`);
      }
      return { field: item.field.trim(), weight: item.weight };
    }
    return { field: item.field.trim() };
  });

  return { fields };
}

export function parseBooleanFlag(value: string | null, label: string): boolean | undefined {
  if (value == null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "") return undefined;
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw new BadRequestError(`${label} は true / false もしくは 1 / 0 で指定してください`);
}

/**
 * withRelations 用パーサー。boolean | number を返す。
 * "true"/"1" → true, "false"/"0" → false, 正整数 → number
 */
export function parseWithRelations(value: string | null): boolean | number | undefined {
  if (value == null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "") return undefined;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  const num = Number(normalized);
  if (Number.isInteger(num) && num > 0) return num;
  throw new BadRequestError("withRelations は true / false もしくは正の整数で指定してください");
}

// where クエリを JSON として読み込むヘルパー
export function parseWhere(value: string | null): SearchParams["where"] {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as SearchParams["where"];
  } catch {
    throw new BadRequestError("where は有効な JSON 文字列で指定してください");
  }
}

// relationWhere クエリを JSON として読み込むヘルパー
export function parseRelationWhere(value: string | null): SearchParams["relationWhere"] {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as SearchParams["relationWhere"];
  } catch {
    throw new BadRequestError("relationWhere は有効な JSON 文字列で指定してください");
  }
}

export { BadRequestError };
