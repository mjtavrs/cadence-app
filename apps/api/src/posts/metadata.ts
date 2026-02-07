export function normalizeTitle(input: unknown) {
  const raw = typeof input === "string" ? input : "";
  const title = raw.replace(/\s+/g, " ").trim();
  return title;
}

export function normalizeTags(input: unknown) {
  const tags: string[] = [];

  const rawList =
    Array.isArray(input) ? input : typeof input === "string" ? input.split(",") : [];

  for (const value of rawList) {
    if (typeof value !== "string") continue;
    const t = value.trim().toLowerCase();
    if (!t) continue;
    tags.push(t);
  }

  // remove duplicadas preservando ordem
  const seen = new Set<string>();
  return tags.filter((t) => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

export function validateTitle(title: string) {
  if (title.length < 3) return "Título deve ter pelo menos 3 caracteres.";
  if (title.length > 80) return "Título deve ter no máximo 80 caracteres.";
  return null;
}

export function validateTags(tags: string[]) {
  if (tags.length > 10) return "Use no máximo 10 tags.";
  for (const t of tags) {
    if (t.length > 24) return "Cada tag deve ter no máximo 24 caracteres.";
  }
  return null;
}

