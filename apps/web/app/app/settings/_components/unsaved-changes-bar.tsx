"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function UnsavedChangesBar(props: {
  visible: boolean;
  saving: boolean;
  errorMessage?: string | null;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className={[
        "fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 transition-all duration-200",
        props.visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      ].join(" ")}
      aria-hidden={!props.visible}
    >
      <div className="bg-background/95 flex w-full max-w-3xl flex-col gap-3 rounded-md border px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm">
            <span className="font-medium">Atenção</span> - você fez alterações que ainda não foram salvas.
          </p>
          {props.errorMessage ? <p className="text-xs text-red-600">{props.errorMessage}</p> : null}
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={props.onDiscard} disabled={props.saving}>
            Descartar alterações
          </Button>
          <Button type="button" className="w-full sm:w-auto" onClick={props.onSave} disabled={props.saving}>
            {props.saving ? (
              <span className="inline-flex items-center gap-2">
                <Spinner data-icon="inline-start" />
                Salvando...
              </span>
            ) : (
              "Salvar"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
