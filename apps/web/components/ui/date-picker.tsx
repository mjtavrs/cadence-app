"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function DatePicker(props: {
  value?: Date;
  onSelect?(date: Date | undefined): void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const date = props.value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={props.id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-empty={!date}
          disabled={props.disabled}
          className={cn(
            "data-[empty=true]:text-muted-foreground w-full min-w-0 justify-between text-left font-normal sm:w-[212px]",
            props.triggerClassName,
          )}
        >
          {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : (props.placeholder ?? "Selecione uma data")}
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,340px)] p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            props.onSelect?.(d);
            setOpen(false);
          }}
          defaultMonth={date}
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  );
}
