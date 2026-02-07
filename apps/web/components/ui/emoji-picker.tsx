"use client";

import { useState } from "react";
import { SmileIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";

type EmojiItem = { emoji: string; name: string };
type EmojiCategory = { heading: string; items: EmojiItem[] };

const EMOJIS: EmojiCategory[] = [
  {
    heading: "Carinhas",
    items: [
      { emoji: "😀", name: "sorriso" },
      { emoji: "😁", name: "feliz" },
      { emoji: "😂", name: "rindo" },
      { emoji: "🤣", name: "rindo alto" },
      { emoji: "😊", name: "sorrindo" },
      { emoji: "😍", name: "apaixonado" },
      { emoji: "😎", name: "cool" },
      { emoji: "😮", name: "surpreso" },
      { emoji: "😢", name: "triste" },
      { emoji: "😡", name: "raiva" },
    ],
  },
  {
    heading: "Gestos",
    items: [
      { emoji: "👍", name: "joinha" },
      { emoji: "👎", name: "não" },
      { emoji: "👏", name: "aplausos" },
      { emoji: "🙏", name: "obrigado" },
      { emoji: "💪", name: "força" },
      { emoji: "🤝", name: "parceria" },
      { emoji: "✌️", name: "paz" },
      { emoji: "🤩", name: "incrível" },
    ],
  },
  {
    heading: "Objetos",
    items: [
      { emoji: "📌", name: "pin" },
      { emoji: "📣", name: "anúncio" },
      { emoji: "🗓️", name: "calendário" },
      { emoji: "📷", name: "foto" },
      { emoji: "🎉", name: "celebração" },
      { emoji: "🚀", name: "lançamento" },
      { emoji: "🔥", name: "fogo" },
      { emoji: "✨", name: "brilho" },
    ],
  },
  {
    heading: "Corações",
    items: [
      { emoji: "❤️", name: "coração" },
      { emoji: "🧡", name: "coração laranja" },
      { emoji: "💛", name: "coração amarelo" },
      { emoji: "💚", name: "coração verde" },
      { emoji: "💙", name: "coração azul" },
      { emoji: "💜", name: "coração roxo" },
    ],
  },
];

export function EmojiPicker(props: { onSelect(emoji: string): void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Inserir emoji">
          <SmileIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-0">
        <Command>
          <CommandInput placeholder="Buscar emoji..." />
          <CommandList>
            <CommandEmpty>Nenhum emoji encontrado.</CommandEmpty>
            <ScrollArea className="h-[280px]">
              {EMOJIS.map((cat) => (
                <CommandGroup key={cat.heading} heading={cat.heading}>
                  {cat.items.map((item) => (
                    <CommandItem
                      key={item.emoji}
                      value={`${item.emoji} ${item.name} ${cat.heading}`}
                      onSelect={() => {
                        props.onSelect(item.emoji);
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <span className="text-lg">{item.emoji}</span>
                      <span className="text-muted-foreground text-xs">{item.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

