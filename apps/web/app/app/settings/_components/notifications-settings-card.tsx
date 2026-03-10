"use client";

import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

import { SettingsSection } from "./settings-section";

export type NotificationsFormValue = {
  emailOnPendingApproval: boolean;
  emailOnScheduled: boolean;
  emailOnPublished: boolean;
  emailOnFailed: boolean;
};

type NotificationKey = keyof NotificationsFormValue;

function NotificationToggle(props: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  saving: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="space-y-1">
        <Label htmlFor={props.id}>{props.label}</Label>
        <p className="text-muted-foreground text-xs">{props.description}</p>
      </div>
      <div className="flex items-center gap-2">
        {props.saving ? <Spinner className="text-muted-foreground" /> : null}
        <Switch
          id={props.id}
          checked={props.checked}
          onCheckedChange={props.onCheckedChange}
          disabled={props.disabled || props.saving}
        />
      </div>
    </div>
  );
}

export function NotificationsSettingsCard(props: {
  value: NotificationsFormValue;
  canManage: boolean;
  savingKeys: Set<NotificationKey>;
  onToggle: (key: NotificationKey, checked: boolean) => void;
}) {
  const disabled = !props.canManage;

  return (
    <SettingsSection title="Notificações">
      <NotificationToggle
        id="settings-notify-pending"
        label="Post aguardando aprovação"
        description="Envia alerta quando um post entra em revisão."
        checked={props.value.emailOnPendingApproval}
        disabled={disabled}
        saving={props.savingKeys.has("emailOnPendingApproval")}
        onCheckedChange={(checked) => props.onToggle("emailOnPendingApproval", checked)}
      />

      <NotificationToggle
        id="settings-notify-scheduled"
        label="Post agendado"
        description="Envia alerta quando um post é agendado."
        checked={props.value.emailOnScheduled}
        disabled={disabled}
        saving={props.savingKeys.has("emailOnScheduled")}
        onCheckedChange={(checked) => props.onToggle("emailOnScheduled", checked)}
      />

      <NotificationToggle
        id="settings-notify-published"
        label="Post publicado"
        description="Envia alerta quando a publicação ocorre com sucesso."
        checked={props.value.emailOnPublished}
        disabled={disabled}
        saving={props.savingKeys.has("emailOnPublished")}
        onCheckedChange={(checked) => props.onToggle("emailOnPublished", checked)}
      />

      <NotificationToggle
        id="settings-notify-failed"
        label="Falha de publicação"
        description="Envia alerta quando ocorrer erro na publicação."
        checked={props.value.emailOnFailed}
        disabled={disabled}
        saving={props.savingKeys.has("emailOnFailed")}
        onCheckedChange={(checked) => props.onToggle("emailOnFailed", checked)}
      />
    </SettingsSection>
  );
}

