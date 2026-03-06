"use client";

import { useEffect, useMemo, useState } from "react";
import { SmileIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { loadEmojiCatalog, preloadEmojiCatalog, type EmojiCatalog, type EmojiCatalogSection } from "@/lib/emoji-catalog";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function EmojiPicker(props: { onSelect(emoji: string): void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<EmojiCatalog | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setLoading(true);
      try {
        preloadEmojiCatalog();
        const next = await loadEmojiCatalog();
        if (!cancelled) {
          setCatalog(next);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSections = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    const sections = catalog?.sections ?? [];
    if (!normalizedQuery) return sections;

    return sections
      .map<EmojiCatalogSection>((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const haystack = normalize([item.name, ...item.keywords].join(" "));
          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [catalog, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Inserir emoji">
          <SmileIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-medium">Emojis</div>
        </div>
        <div className="px-4 pt-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar emoji..." />
        </div>
        <ScrollArea className="h-[320px] px-4 py-3">
          {loading && !catalog ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="size-5" />
            </div>
          ) : filteredSections.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center text-sm">Nenhum emoji encontrado.</div>
          ) : (
            <div className="space-y-4">
              {filteredSections.map((section) => (
                <section key={section.id} className="space-y-2">
                  <div className="text-muted-foreground px-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                    {section.label}
                  </div>
                  <div className="grid grid-cols-8 gap-2">
                    {section.items.map((item) => (
                      <button
                        key={`${item.order}-${item.name}`}
                        type="button"
                        className="hover:bg-accent focus-visible:ring-ring/50 flex h-10 items-center justify-center rounded-md border border-transparent text-xl transition-colors focus-visible:outline-none focus-visible:ring-[3px]"
                        title={item.name}
                        aria-label={item.name}
                        onClick={() => {
                          props.onSelect(item.emoji);
                          setOpen(false);
                        }}
                      >
                        {item.emoji}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
