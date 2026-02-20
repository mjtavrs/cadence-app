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
  const showAdvance = step !== "create";

  return (
    <div className="flex items-center justify-between border-b px-4 pb-4">
      <div className="flex items-center gap-2">
        {showBack && onBack && (
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
        )}
      </div>

      <span className="text-sm font-medium">{STEP_TITLES[step]}</span>
      
      {showAdvance && onAdvance && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="text-primary"
          disabled={!canAdvance}
          onClick={onAdvance}
        >
          Avançar
        </Button>
      )}
    </div>
  );
}
