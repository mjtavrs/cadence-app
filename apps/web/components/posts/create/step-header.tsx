"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CreationStep = "select" | "crop" | "create";

const STEP_TITLES: Record<CreationStep, string> = {
  select: "Selecione uma mídia",
  crop: "Cortar e ajustar",
  create: "Criar post",
};

export function StepHeader(props: {
  step: CreationStep;
  canAdvance: boolean;
  onBack?: () => void;
  onAdvance?: () => void;
}) {
  const { step, canAdvance, onBack, onAdvance } = props;
  const showBack = step !== "select";
  const showAdvance = step === "crop";
  const isCreateStep = step === "create";

  return (
    <div className={`relative flex items-center justify-between px-4 ${isCreateStep ? "py-2" : "pt-3 pb-5 border-b"}`}>
      <div className="flex w-24 items-center gap-2">
        {showBack && onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onBack}
            aria-label="Voltar"
          >
            <ArrowLeft className="size-4" />
          </Button>
        ) : null}
      </div>

      <span className="pointer-events-none absolute left-1/2 max-w-[calc(100%-9rem)] -translate-x-1/2 truncate text-sm font-normal sm:max-w-[calc(100%-12rem)] sm:text-base">
        {STEP_TITLES[step]}
      </span>

      {showAdvance && onAdvance ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-24 justify-end text-primary hover:text-primary hover:bg-transparent"
          disabled={!canAdvance}
          onClick={onAdvance}
        >
          Avançar
        </Button>
      ) : (
        <div className="w-24" />
      )}
    </div>
  );
}
