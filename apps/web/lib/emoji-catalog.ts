"use client";

type EmojiDatasetItem = {
  hexcode: string;
  label: string;
  tags?: string[];
  group?: number;
  order?: number;
};

export type EmojiCatalogItem = {
  emoji: string;
  name: string;
  keywords: string[];
  group: number;
  order: number;
};

export type EmojiCatalogSection = {
  id: number;
  label: string;
  items: EmojiCatalogItem[];
};

export type EmojiCatalog = {
  sections: EmojiCatalogSection[];
};

const GROUP_LABELS: Record<number, string> = {
  0: "Carinhas e emoções",
  1: "Pessoas e corpo",
  2: "Componentes",
  3: "Animais e natureza",
  4: "Comidas e bebidas",
  5: "Viagens e lugares",
  6: "Atividades",
  7: "Objetos",
  8: "Símbolos",
  9: "Bandeiras",
};

let emojiCatalogCache: EmojiCatalog | null = null;
let emojiCatalogPromise: Promise<EmojiCatalog> | null = null;

function emojiFromHexcode(hexcode: string) {
  return hexcode
    .split("-")
    .map((part) => String.fromCodePoint(Number.parseInt(part, 16)))
    .join("");
}

function buildEmojiCatalog(dataset: EmojiDatasetItem[]): EmojiCatalog {
  const grouped = new Map<number, EmojiCatalogItem[]>();

  for (const item of dataset) {
    if (typeof item.group !== "number" || typeof item.order !== "number" || !item.hexcode || !item.label) {
      continue;
    }

    const nextItem: EmojiCatalogItem = {
      emoji: emojiFromHexcode(item.hexcode),
      name: item.label,
      keywords: item.tags ?? [],
      group: item.group,
      order: item.order,
    };

    const currentGroup = grouped.get(item.group) ?? [];
    currentGroup.push(nextItem);
    grouped.set(item.group, currentGroup);
  }

  const sections = Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([groupId, items]) => ({
      id: groupId,
      label: GROUP_LABELS[groupId] ?? `Grupo ${groupId}`,
      items: items.sort((a, b) => a.order - b.order),
    }));

  return { sections };
}

export async function loadEmojiCatalog(): Promise<EmojiCatalog> {
  if (emojiCatalogCache) return emojiCatalogCache;
  if (emojiCatalogPromise) return emojiCatalogPromise;

  emojiCatalogPromise = import("emojibase-data/pt/compact.json")
    .then((emojiDatasetModule) => {
      const dataset = (emojiDatasetModule.default ?? []) as EmojiDatasetItem[];
      const catalog = buildEmojiCatalog(dataset);
      emojiCatalogCache = catalog;
      return catalog;
    })
    .finally(() => {
      emojiCatalogPromise = null;
    });

  return emojiCatalogPromise;
}

export function preloadEmojiCatalog() {
  void loadEmojiCatalog();
}
