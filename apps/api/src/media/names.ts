export const MAX_FOLDER_NAME_LENGTH = 80;

export function normalizeSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeFolderName(value: string) {
  return normalizeSpaces(value).toLocaleLowerCase("pt-BR");
}

export function normalizeFileName(value: string) {
  return normalizeSpaces(value).toLocaleLowerCase("pt-BR");
}

export function splitPathSegments(path: string) {
  return path
    .split(/[\\/]+/)
    .map((segment) => normalizeSpaces(segment))
    .filter(Boolean);
}

