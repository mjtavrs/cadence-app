"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ptBR } from "react-day-picker/locale";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildUtcIsoFromRecifeSelection,
  formatYmdPtBr,
  getTodayForCalendar,
  isAlignedToMinutes,
  makeTimeOptions,
} from "@/lib/datetime";

const TZ = "America/Recife";
const STEP_MINUTES = 15;

export function SchedulePostDialog(props: {
  open: boolean;
  onOpenChange(open: boolean): void;
  isSubmitting?: boolean;
  onConfirm?(postId: string, scheduledAtUtc: string): Promise<void>;
  postId: string | null;
  defaultDate: Date;
  defaultTimeHHmm: string;
  /** Quando postId é null, ao confirmar chama com o ISO selecionado (fluxo de criação). */
  onSelectScheduledAtUtc?(scheduledAtUtc: string): void;
}) {
  const timeOptions = useMemo(() => makeTimeOptions(STEP_MINUTES), []);
  const today = useMemo(() => getTodayForCalendar(TZ), []);

  const [date, setDate] = useState<Date | undefined>(() => props.defaultDate);
  const [timeHHmm, setTimeHHmm] = useState<string | undefined>(() => props.defaultTimeHHmm);

  const isSelectionOnly = props.postId == null;

  async function confirm() {
    if (!date) {
      toast.error("Selecione um dia.");
      return;
    }
    if (!timeHHmm) {
      toast.error("Selecione um horário.");
      return;
    }
    if (!isAlignedToMinutes(timeHHmm, STEP_MINUTES)) {
      toast.error(`O horário deve estar alinhado em ${STEP_MINUTES} minutos.`);
      return;
    }

    const scheduledAtUtc = buildUtcIsoFromRecifeSelection({
      selectedDate: date,
      timeHHmm,
      timeZone: TZ,
    });

    if (new Date(scheduledAtUtc).getTime() <= Date.now()) {
      toast.error("Escolha um horário no futuro.");
      return;
    }

    if (isSelectionOnly && props.onSelectScheduledAtUtc) {
      props.onSelectScheduledAtUtc(scheduledAtUtc);
      props.onOpenChange(false);
      return;
    }

    if (!props.postId || !props.onConfirm) return;
    try {
      await props.onConfirm(props.postId, scheduledAtUtc);
      toast.success("Post agendado.");
      props.onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao agendar post.");
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isSelectionOnly ? "Definir data e hora" : "Agendar post"}</DialogTitle>
          <DialogDescription>
            Escolha a data e o horário (America/Recife). O agendamento precisa ser no futuro.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <div className="text-sm font-medium">Data</div>
              <div className="text-muted-foreground mt-1 text-xs">{date ? formatYmdPtBr(date, TZ) : "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium">Horário</div>
              <div className="text-muted-foreground mt-1 text-xs">{timeHHmm ?? "—"}</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-lg border"
              timeZone={TZ}
              locale={ptBR}
              disabled={{ before: today }}
            />

            <div className="sm:pt-1">
              <div className="text-sm font-medium">Selecionar horário</div>
              <Select value={timeHHmm} onValueChange={(v) => setTimeHHmm(v)}>
                <SelectTrigger className="mt-2 w-full sm:w-48">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-72">
                  {timeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => props.onOpenChange(false)} disabled={props.isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => void confirm()}
            disabled={props.isSubmitting || (!isSelectionOnly && !props.postId)}
          >
            {props.isSubmitting ? "Agendando..." : isSelectionOnly ? "Definir" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

