"use client";

import { useRef } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import { SettingsSection } from "./settings-section";

export type GeneralFormValue = {
  workspaceName: string;
  workspaceLogoKey: string | null;
  workspaceLogoUrl: string | null;
  timezone: string;
  locale: string;
};

const TIMEZONE_OPTIONS = [
  { value: "America/Recife", label: "América/Recife (-03:00)" },
  { value: "America/Sao_Paulo", label: "América/São Paulo (-03:00)" },
  { value: "UTC", label: "UTC (+00:00)" },
] as const;

const LOCALE_OPTIONS = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (United States)" },
  { value: "es-419", label: "Español (Latinoamérica)" },
] as const;

function getWorkspaceInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "WS";
  const words = trimmed.split(/\s+/).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("") || "WS";
}

export function GeneralSettingsCard(props: {
  value: GeneralFormValue;
  canManage: boolean;
  isBusy: boolean;
  isUploadingLogo: boolean;
  onChange: (next: GeneralFormValue) => void;
  onUploadLogo: (file: File) => void;
}) {
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  function onLogoInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    props.onUploadLogo(file);
  }

  return (
    <SettingsSection title="Geral">
      <div className="space-y-2">
        <Label>Logo do workspace</Label>
        <div className="space-y-3 pt-2">
          <Avatar className="size-34 ring-1 ring-border">
            {props.value.workspaceLogoUrl ? (
              <AvatarImage src={props.value.workspaceLogoUrl} alt="Logo do workspace" className="object-cover" />
            ) : null}
            <AvatarFallback>{getWorkspaceInitials(props.value.workspaceName)}</AvatarFallback>
          </Avatar>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!props.canManage || props.isUploadingLogo || props.isBusy}
              onClick={() => logoInputRef.current?.click()}
            >
              {props.isUploadingLogo ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Enviando...
                </>
              ) : (
                "Alterar logo"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!props.canManage || props.isUploadingLogo || props.isBusy || !props.value.workspaceLogoKey}
              onClick={() => props.onChange({ ...props.value, workspaceLogoKey: null, workspaceLogoUrl: null })}
            >
              Remover
            </Button>
          </div>

          <input
            ref={logoInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.heic,image/png,image/jpeg,image/webp,image/heic"
            className="hidden"
            onChange={onLogoInputChange}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="settings-workspace-name">Nome do workspace</Label>
        <Input
          id="settings-workspace-name"
          value={props.value.workspaceName}
          onChange={(event) => props.onChange({ ...props.value, workspaceName: event.target.value })}
          disabled={!props.canManage || props.isBusy}
          maxLength={100}
        />
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-timezone">Fuso horário</Label>
          <Select
            value={props.value.timezone}
            onValueChange={(value) => props.onChange({ ...props.value, timezone: value })}
            disabled={!props.canManage || props.isBusy}
          >
            <SelectTrigger id="settings-timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-locale">Idioma</Label>
          <Select
            value={props.value.locale}
            onValueChange={(value) => props.onChange({ ...props.value, locale: value })}
            disabled={!props.canManage || props.isBusy}
          >
            <SelectTrigger id="settings-locale" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </SettingsSection>
  );
}
