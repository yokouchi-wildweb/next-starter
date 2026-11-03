import type { WhereExpr } from "@/lib/crud/types";

/** Firestore の where が扱う演算子（凍結。README「Firestore 版との差異」と同じ） */
const SUPPORTED_OPS = ["eq", "ne", "lt", "lte", "gt", "gte", "like"] as const;

export const applyWhere = (
  q: FirebaseFirestore.Query,
  expr?: WhereExpr,
): FirebaseFirestore.Query => {
  if (!expr) return q;
  if ("field" in expr) {
    const value = expr.value;
    switch (expr.op) {
      case "eq":
        return q.where(expr.field, "==", value);
      case "ne":
        return q.where(expr.field, "!=", value);
      case "lt":
        return q.where(expr.field, "<", value);
      case "lte":
        return q.where(expr.field, "<=", value);
      case "gt":
        return q.where(expr.field, ">", value);
      case "gte":
        return q.where(expr.field, ">=", value);
      case "like":
        return q
          .where(expr.field, ">=", value)
          .where(expr.field, "<=", String(value) + "\uf8ff");
      default:
        // 未対応の演算子を黙って捨てると条件が外れ、頼んだより多い行が返る。アダプタは凍結（演算子は足さない）なので例外にする
        throw new Error(
          `Firestore search does not support where operator "${expr.op}" (field: ${expr.field}). Supported: ${SUPPORTED_OPS.join(", ")}`,
        );
    }
  } else if ("and" in expr) {
    return expr.and.reduce((acc, e) => applyWhere(acc, e), q);
  } else if ("or" in expr) {
    throw new Error("Firestore search does not support OR queries");
  }
  return q;
};

