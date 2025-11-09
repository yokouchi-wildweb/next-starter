// src/features/gacha/machines/animationMachine/utils.ts


export function stateValueToString(state: { value: any }): string {
  const toString = (value: any): string => {
    if (typeof value === "string") return value;
    if (typeof value === "object" && value) {
      return Object.entries(value)
        .map(([k, v]) => `${k}.${toString(v)}`)
        .join(" > ");
    }
    return "";
  };

  return toString(state.value);
}