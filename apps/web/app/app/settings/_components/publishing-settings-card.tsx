"use client";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

import { SettingsSection } from "./settings-section";

export type PublishingFormValue = {
  requireApprovalForContributors: boolean;
};

export function PublishingSettingsCard(props: {
  value: PublishingFormValue;
  channels: Array<{ platform: string; placement: string }>;
  canManage: boolean;
  isSavingToggle: boolean;
  onToggleRequireApproval: (checked: boolean) => void;
}) {
  return (
    <SettingsSection title="Publicação">
      <div className="flex items-center justify-between gap-4 py-1">
        <div className="space-y-1">
          <Label htmlFor="settings-require-approval">Exigir aprovação para contribuidores</Label>
          <p className="text-muted-foreground text-xs">
            Quando ativo, usuários sem permissão de aprovação enviam para revisão.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {props.isSavingToggle ? <Spinner className="text-muted-foreground" /> : null}
          <Switch
            id="settings-require-approval"
            checked={props.value.requireApprovalForContributors}
            onCheckedChange={props.onToggleRequireApproval}
            disabled={!props.canManage || props.isSavingToggle}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Canais padrão</Label>
        <div className="flex flex-wrap gap-2">
          {props.channels.map((channel) => (
            <Badge key={`${channel.platform}:${channel.placement}`} variant="secondary">
              {channel.platform} - {channel.placement}
            </Badge>
          ))}
        </div>
      </div>
    </SettingsSection>
  );
}

