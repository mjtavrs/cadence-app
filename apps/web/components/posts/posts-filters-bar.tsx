"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { XIcon } from "lucide-react";
import { TbFilterSearch } from "react-icons/tb";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PostStatus } from "@/components/posts/post-card";

const statusLabels: Record<PostStatus, string> = {
  DRAFT: "Rascunho",
  IN_REVIEW: "Em revisão",
  APPROVED: "Aprovado",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
  FAILED: "Falhou",
};

const STATUS_OPTIONS: PostStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
];

export function PostsFiltersBar(props: {
  searchQuery: string;
  onSearchQueryChange(value: string): void;
  statusFilters: PostStatus[];
  onStatusFiltersChange(value: PostStatus[]): void;
  tagFilters: string[];
  onTagFiltersChange(tags: string[]): void;
  dateRange: { from?: Date; to?: Date };
  onDateRangeChange(value: { from?: Date; to?: Date }): void;
  availableTags: string[];
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const hasActiveFilters =
    props.statusFilters.length > 0 ||
    props.tagFilters.length > 0 ||
    props.dateRange.from != null ||
    props.dateRange.to != null;

  function clearAllFilters() {
    props.onStatusFiltersChange([]);
    props.onTagFiltersChange([]);
    props.onDateRangeChange({});
    setPopoverOpen(false);
  }

  function toggleStatus(status: PostStatus) {
    const next = props.statusFilters.includes(status)
      ? props.statusFilters.filter((s) => s !== status)
      : [...props.statusFilters, status];
    props.onStatusFiltersChange(next);
  }

  function toggleTag(tag: string) {
    const next = props.tagFilters.includes(tag)
      ? props.tagFilters.filter((t) => t !== tag)
      : [...props.tagFilters, tag];
    props.onTagFiltersChange(next);
  }

  function removeStatusChip(status: PostStatus) {
    props.onStatusFiltersChange(props.statusFilters.filter((s) => s !== status));
  }

  function removeTagChip(tag: string) {
    props.onTagFiltersChange(props.tagFilters.filter((t) => t !== tag));
  }

  function clearDateRange() {
    props.onDateRangeChange({});
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar por título ou código"
          value={props.searchQuery}
          onChange={(e) => props.onSearchQueryChange(e.target.value)}
          className="min-w-[200px] max-w-[320px] flex-1 sm:max-w-[280px]"
        />

        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <TbFilterSearch className="size-4" />
              Filtros
              {hasActiveFilters ? (
                <span className="bg-primary text-primary-foreground size-5 rounded-full text-xs leading-5">
                  {props.statusFilters.length +
                    props.tagFilters.length +
                    (props.dateRange.from || props.dateRange.to ? 1 : 0)}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto min-w-[280px]" align="start">
            <div className="space-y-4">
              <FieldSet>
                <FieldLegend variant="label">Status</FieldLegend>
                <FieldGroup className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((status) => (
                    <Field key={status} orientation="horizontal">
                      <Checkbox
                        id={`filter-status-${status}`}
                        checked={props.statusFilters.includes(status)}
                        onCheckedChange={() => toggleStatus(status)}
                      />
                      <FieldLabel
                        htmlFor={`filter-status-${status}`}
                        className="cursor-pointer font-normal"
                      >
                        {statusLabels[status]}
                      </FieldLabel>
                    </Field>
                  ))}
                </FieldGroup>
              </FieldSet>

              {props.availableTags.length > 0 ? (
                <FieldSet>
                  <FieldLegend variant="label">Tags</FieldLegend>
                  <FieldGroup className="max-h-40 gap-2 overflow-y-auto">
                    {props.availableTags.map((tag) => (
                      <Field key={tag} orientation="horizontal">
                        <Checkbox
                          id={`filter-tag-${tag}`}
                          checked={props.tagFilters.includes(tag)}
                          onCheckedChange={() => toggleTag(tag)}
                        />
                        <FieldLabel
                          htmlFor={`filter-tag-${tag}`}
                          className="cursor-pointer font-normal"
                        >
                          #{tag}
                        </FieldLabel>
                      </Field>
                    ))}
                  </FieldGroup>
                </FieldSet>
              ) : null}

              <FieldSet>
                <FieldLegend variant="label">Período (agendamento)</FieldLegend>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <DatePicker
                    value={props.dateRange.from}
                    onSelect={(d) => props.onDateRangeChange({ ...props.dateRange, from: d })}
                    placeholder="De"
                    triggerClassName="w-full sm:w-[140px]"
                  />
                  <DatePicker
                    value={props.dateRange.to}
                    onSelect={(d) => props.onDateRangeChange({ ...props.dateRange, to: d })}
                    placeholder="Até"
                    triggerClassName="w-full sm:w-[140px]"
                  />
                </div>
              </FieldSet>

              <FieldSet>
                <FieldLegend variant="label">Rede social</FieldLegend>
                <p className="text-muted-foreground text-sm">Indisponível</p>
              </FieldSet>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  Limpar
                </Button>
                <Button size="sm" onClick={() => setPopoverOpen(false)}>
                  Aplicar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">Filtros:</span>
          {props.statusFilters.map((s) => (
            <Badge
              key={s}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {statusLabels[s]}
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                className="size-4 rounded-full hover:bg-transparent"
                onClick={() => removeStatusChip(s)}
                aria-label={`Remover filtro ${statusLabels[s]}`}
              >
                <XIcon className="size-3" />
              </Button>
            </Badge>
          ))}
          {props.tagFilters.map((t) => (
            <Badge
              key={t}
              variant="secondary"
              className="gap-1 pr-1"
            >
              #{t}
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                className="size-4 rounded-full hover:bg-transparent"
                onClick={() => removeTagChip(t)}
                aria-label={`Remover tag ${t}`}
              >
                <XIcon className="size-3" />
              </Button>
            </Badge>
          ))}
          {(props.dateRange.from != null || props.dateRange.to != null) && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {props.dateRange.from && props.dateRange.to
                ? `${format(props.dateRange.from, "dd/MM/yyyy", { locale: ptBR })} – ${format(props.dateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
                : props.dateRange.from
                  ? `De ${format(props.dateRange.from, "dd/MM/yyyy", { locale: ptBR })}`
                  : props.dateRange.to
                    ? `Até ${format(props.dateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
                    : null}
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                className="size-4 rounded-full hover:bg-transparent"
                onClick={clearDateRange}
                aria-label="Remover filtro de data"
              >
                <XIcon className="size-3" />
              </Button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="text-muted-foreground h-6 text-xs" onClick={clearAllFilters}>
            Limpar todos
          </Button>
        </div>
      ) : null}
    </div>
  );
}
