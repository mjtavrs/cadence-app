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
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  availableStatuses: PostStatus[];
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [draftStatusFilters, setDraftStatusFilters] = useState<PostStatus[]>(props.statusFilters);
  const [draftTagFilters, setDraftTagFilters] = useState<string[]>(props.tagFilters);
  const [draftDateRange, setDraftDateRange] = useState<{ from?: Date; to?: Date }>(props.dateRange);

  const hasActiveFilters =
    props.statusFilters.length > 0 ||
    props.tagFilters.length > 0 ||
    props.dateRange.from != null ||
    props.dateRange.to != null;

  const visibleStatusOptions =
    props.availableStatuses.length > 0
      ? STATUS_OPTIONS.filter((status) => props.availableStatuses.includes(status))
      : STATUS_OPTIONS;

  function applyDraftFilters() {
    props.onStatusFiltersChange(draftStatusFilters);
    props.onTagFiltersChange(draftTagFilters);
    props.onDateRangeChange(draftDateRange);
    setPopoverOpen(false);
  }

  function clearDraftFilters() {
    setDraftStatusFilters([]);
    setDraftTagFilters([]);
    setDraftDateRange({});
  }

  function clearAllFilters() {
    props.onStatusFiltersChange([]);
    props.onTagFiltersChange([]);
    props.onDateRangeChange({});
    setPopoverOpen(false);
  }

  function toggleStatus(status: PostStatus) {
    const next = draftStatusFilters.includes(status)
      ? draftStatusFilters.filter((s) => s !== status)
      : [...draftStatusFilters, status];
    setDraftStatusFilters(next);
  }

  function toggleTag(tag: string) {
    const next = draftTagFilters.includes(tag)
      ? draftTagFilters.filter((t) => t !== tag)
      : [...draftTagFilters, tag];
    setDraftTagFilters(next);
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

        <Popover
          open={popoverOpen}
          onOpenChange={(open) => {
            if (open) {
              setDraftStatusFilters(props.statusFilters);
              setDraftTagFilters(props.tagFilters);
              setDraftDateRange(props.dateRange);
            }
            setPopoverOpen(open);
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <TbFilterSearch className="size-4" />
              Filtros
              {hasActiveFilters ? (
                <span className="bg-primary text-primary-foreground inline-flex size-5 items-center justify-center rounded-full text-xs leading-none">
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
                  {visibleStatusOptions.map((status) => (
                    <div key={status} className="inline-flex w-fit items-center gap-2">
                      <Checkbox
                        id={`filter-status-${status}`}
                        checked={draftStatusFilters.includes(status)}
                        onCheckedChange={() => toggleStatus(status)}
                      />
                      <Label htmlFor={`filter-status-${status}`} className="w-fit cursor-pointer text-sm font-normal">
                        {statusLabels[status]}
                      </Label>
                    </div>
                  ))}
                </FieldGroup>
              </FieldSet>

              {props.availableTags.length > 0 ? (
                <FieldSet>
                  <FieldLegend variant="label">Tags</FieldLegend>
                  <FieldGroup className="grid max-h-44 grid-cols-2 gap-x-3 gap-y-2 overflow-y-auto pr-1">
                    {props.availableTags.map((tag) => (
                      <div key={tag} className="inline-flex w-fit items-center gap-2">
                        <Checkbox
                          id={`filter-tag-${tag}`}
                          checked={draftTagFilters.includes(tag)}
                          onCheckedChange={() => toggleTag(tag)}
                        />
                        <Label htmlFor={`filter-tag-${tag}`} className="w-fit cursor-pointer text-sm font-normal">
                          #{tag}
                        </Label>
                      </div>
                    ))}
                  </FieldGroup>
                </FieldSet>
              ) : null}

              <FieldSet>
                <FieldLegend variant="label">Período (agendamento)</FieldLegend>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <DatePicker
                    value={draftDateRange.from}
                    onSelect={(d) => setDraftDateRange({ ...draftDateRange, from: d })}
                    placeholder="De"
                    triggerClassName="h-8 w-full px-3 text-sm sm:w-[152px]"
                  />
                  <DatePicker
                    value={draftDateRange.to}
                    onSelect={(d) => setDraftDateRange({ ...draftDateRange, to: d })}
                    placeholder="Até"
                    triggerClassName="h-8 w-full px-3 text-sm sm:w-[152px]"
                  />
                </div>
              </FieldSet>

              <FieldSet>
                <FieldLegend variant="label">Rede social</FieldLegend>
                <p className="text-muted-foreground text-sm">Indisponível</p>
              </FieldSet>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button variant="ghost" size="sm" onClick={clearDraftFilters}>
                  Limpar
                </Button>
                <Button size="sm" onClick={applyDraftFilters}>
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
            <Badge key={s} variant="secondary" className="gap-1 pr-1">
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
            <Badge key={t} variant="secondary" className="gap-1 pr-1">
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
