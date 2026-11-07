import type { Answers, ServiceSnapshot } from "@townpass/checklist-shared";
export interface Saved {
  revisionNo: number;
  answers: Answers;
  checkedKeys: string[];
  itemKeys: string[];
}
export function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(`townpass-checklist:${key}`);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeStored(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(`townpass-checklist:${key}`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function readSaved(service: ServiceSnapshot, mode: string): Saved {
  const empty: Saved = {
    revisionNo: service.revisionNo,
    answers: {},
    checkedKeys: [],
    itemKeys: service.items.map((i) => i.key),
  };
  const saved = readStored<Partial<Saved> | null>(
    `${service.slug}:${mode}`,
    null,
  );
  if (
    !saved ||
    typeof saved.revisionNo !== "number" ||
    !saved.answers ||
    typeof saved.answers !== "object" ||
    Array.isArray(saved.answers) ||
    !Array.isArray(saved.checkedKeys) ||
    !Array.isArray(saved.itemKeys)
  )
    return empty;
  return {
    revisionNo: saved.revisionNo,
    answers: saved.answers,
    checkedKeys: saved.checkedKeys.filter(
      (key): key is string =>
        typeof key === "string" && service.items.some((i) => i.key === key),
    ),
    itemKeys: saved.itemKeys.filter(
      (key): key is string => typeof key === "string",
    ),
  };
}
