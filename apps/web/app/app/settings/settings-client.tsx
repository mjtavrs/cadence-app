"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConnectionsSettingsCard } from "./_components/connections-settings-card";
import { GeneralSettingsCard, type GeneralFormValue } from "./_components/general-settings-card";
import { MembersSettingsCard } from "./_components/members-settings-card";
import { NotificationsSettingsCard, type NotificationsFormValue } from "./_components/notifications-settings-card";
import { PublishingSettingsCard, type PublishingFormValue } from "./_components/publishing-settings-card";
import { UnsavedChangesBar } from "./_components/unsaved-changes-bar";
import type { InstagramConnection, WorkspaceMember, WorkspaceSettings } from "./types";

const ALLOWED_LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/heic"]);
const ALLOWED_LOGO_EXT_REGEX = /\.(png|jpe?g|webp|heic)$/i;

type LogoPresignResponse = {
  workspaceLogoKey?: string;
  uploadUrl?: string;
  message?: string;
};

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function normalizeRole(role: string): WorkspaceMember["role"] {
  const normalized = role.toUpperCase();
  if (normalized === "OWNER" || normalized === "ADMIN" || normalized === "EDITOR" || normalized === "VIEWER") {
    return normalized;
  }
  return "VIEWER";
}

function createGeneralFormState(
  settings: WorkspaceSettings,
  workspaceName: string | null,
  workspaceLogoUrl: string | null,
): GeneralFormValue {
  return {
    workspaceName: settings.general.workspaceName ?? workspaceName ?? "",
    workspaceLogoKey: settings.general.workspaceLogoKey,
    workspaceLogoUrl: settings.general.workspaceLogoUrl ?? workspaceLogoUrl,
    timezone: settings.general.timezone,
    locale: settings.general.locale,
  };
}

type NotificationField = keyof NotificationsFormValue;

function isAllowedLogoFile(file: File) {
  if (ALLOWED_LOGO_MIME_TYPES.has(file.type)) return true;
  return ALLOWED_LOGO_EXT_REGEX.test(file.name);
}

function resolveLogoContentType(file: File) {
  if (ALLOWED_LOGO_MIME_TYPES.has(file.type)) return file.type;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".heic")) return "image/heic";
  return null;
}

export function SettingsClient(props: {
  initialSettings: WorkspaceSettings;
  initialConnection: InstagramConnection;
  initialMembers: WorkspaceMember[];
  workspaceRole: string | null;
  workspaceName: string | null;
  workspaceLogoUrl: string | null;
}) {
  const router = useRouter();
  const initialGeneral = createGeneralFormState(props.initialSettings, props.workspaceName, props.workspaceLogoUrl);

  const [generalSaved, setGeneralSaved] = useState<GeneralFormValue>(initialGeneral);
  const [generalDraft, setGeneralDraft] = useState<GeneralFormValue>(initialGeneral);
  const [generalSaveError, setGeneralSaveError] = useState<string | null>(null);
  const [localLogoPreviewUrl, setLocalLogoPreviewUrl] = useState<string | null>(null);
  const [uploadingGeneralLogo, setUploadingGeneralLogo] = useState(false);

  const [publishingForm, setPublishingForm] = useState<PublishingFormValue>({
    requireApprovalForContributors: props.initialSettings.publishing.requireApprovalForContributors,
  });
  const [publishingChannels, setPublishingChannels] = useState(props.initialSettings.publishing.defaultChannels);

  const [notificationsForm, setNotificationsForm] = useState<NotificationsFormValue>({
    emailOnPendingApproval: props.initialSettings.notifications.emailOnPendingApproval,
    emailOnScheduled: props.initialSettings.notifications.emailOnScheduled,
    emailOnPublished: props.initialSettings.notifications.emailOnPublished,
    emailOnFailed: props.initialSettings.notifications.emailOnFailed,
  });

  const [connection, setConnection] = useState<InstagramConnection>(props.initialConnection);
  const [members, setMembers] = useState<WorkspaceMember[]>(props.initialMembers);

  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingPublishingToggle, setSavingPublishingToggle] = useState(false);
  const [savingNotificationKeys, setSavingNotificationKeys] = useState<Set<NotificationField>>(new Set());

  const [connectingInstagram, setConnectingInstagram] = useState(false);
  const [completingInstagram, setCompletingInstagram] = useState(false);
  const [disconnectingInstagram, setDisconnectingInstagram] = useState(false);
  const [pendingRoleUserId, setPendingRoleUserId] = useState<string | null>(null);
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | null>(null);

  const canManage = useMemo(
    () => props.workspaceRole === "OWNER" || props.workspaceRole === "ADMIN",
    [props.workspaceRole],
  );

  const hasUnsavedGeneralChanges =
    canManage &&
    (generalDraft.workspaceName !== generalSaved.workspaceName ||
      generalDraft.workspaceLogoKey !== generalSaved.workspaceLogoKey ||
      generalDraft.timezone !== generalSaved.timezone ||
      generalDraft.locale !== generalSaved.locale);

  useEffect(() => {
    return () => {
      if (localLogoPreviewUrl) URL.revokeObjectURL(localLogoPreviewUrl);
    };
  }, [localLogoPreviewUrl]);

  async function uploadGeneralLogo(file: File) {
    if (!canManage || savingGeneral) return;

    if (!isAllowedLogoFile(file)) {
      toast.error("Formato inválido. Use PNG, JPEG, WebP ou HEIC.");
      return;
    }
    const contentType = resolveLogoContentType(file);
    if (!contentType) {
      toast.error("Não foi possível identificar o tipo da imagem.");
      return;
    }

    setUploadingGeneralLogo(true);
    try {
      const presignRes = await fetch("/api/workspaces/settings/logo/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentType,
          fileName: file.name,
          sizeBytes: file.size,
        }),
      });

      const presignPayload = (await presignRes.json().catch(() => null)) as LogoPresignResponse | null;
      if (!presignRes.ok || !presignPayload?.workspaceLogoKey || !presignPayload?.uploadUrl) {
        throw new Error(getErrorMessage(presignPayload, "Falha ao preparar upload do logo."));
      }

      const uploadRes = await fetch(presignPayload.uploadUrl, {
        method: "PUT",
        headers: { "content-type": contentType },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Falha ao enviar a imagem do logo.");

      const nextPreviewUrl = URL.createObjectURL(file);
      if (localLogoPreviewUrl) URL.revokeObjectURL(localLogoPreviewUrl);
      setLocalLogoPreviewUrl(nextPreviewUrl);

      setGeneralDraft((prev) => ({
        ...prev,
        workspaceLogoKey: presignPayload.workspaceLogoKey ?? prev.workspaceLogoKey,
        workspaceLogoUrl: nextPreviewUrl,
      }));
      setGeneralSaveError(null);
      toast.success("Logo carregado. Clique em salvar para aplicar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar logo.");
    } finally {
      setUploadingGeneralLogo(false);
    }
  }

  async function saveGeneral() {
    if (!canManage) return;

    setSavingGeneral(true);
    setGeneralSaveError(null);
    try {
      const res = await fetch("/api/workspaces/settings/general", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceName: generalDraft.workspaceName || null,
          workspaceLogoKey: generalDraft.workspaceLogoKey,
          timezone: generalDraft.timezone,
          locale: generalDraft.locale,
        }),
      });

      const payload = (await res.json().catch(() => null)) as
        | {
            message?: string;
            general?: {
              workspaceName: string | null;
              workspaceLogoKey: string | null;
              workspaceLogoUrl: string | null;
              timezone: string;
              locale: string;
            };
          }
        | null;

      if (!res.ok) throw new Error(getErrorMessage(payload, "Falha ao salvar configurações gerais."));

      const nextGeneral: GeneralFormValue = {
        workspaceName: payload?.general?.workspaceName ?? generalDraft.workspaceName,
        workspaceLogoKey: payload?.general?.workspaceLogoKey ?? generalDraft.workspaceLogoKey,
        workspaceLogoUrl: payload?.general?.workspaceLogoUrl ?? generalDraft.workspaceLogoUrl,
        timezone: payload?.general?.timezone ?? generalDraft.timezone,
        locale: payload?.general?.locale ?? generalDraft.locale,
      };

      if (localLogoPreviewUrl) {
        URL.revokeObjectURL(localLogoPreviewUrl);
        setLocalLogoPreviewUrl(null);
      }

      setGeneralSaved(nextGeneral);
      setGeneralDraft(nextGeneral);
      router.refresh();
    } catch (error) {
      setGeneralSaveError(error instanceof Error ? error.message : "Falha ao salvar configurações gerais.");
    } finally {
      setSavingGeneral(false);
    }
  }

  function discardGeneralChanges() {
    if (localLogoPreviewUrl) {
      URL.revokeObjectURL(localLogoPreviewUrl);
      setLocalLogoPreviewUrl(null);
    }
    setGeneralDraft(generalSaved);
    setGeneralSaveError(null);
  }

  async function toggleRequireApproval(checked: boolean) {
    if (!canManage || savingPublishingToggle) return;

    const previous = publishingForm.requireApprovalForContributors;
    setPublishingForm((prev) => ({ ...prev, requireApprovalForContributors: checked }));
    setSavingPublishingToggle(true);

    try {
      const res = await fetch("/api/workspaces/settings/publishing", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requireApprovalForContributors: checked }),
      });

      const payload = (await res.json().catch(() => null)) as
        | {
            message?: string;
            publishing?: {
              requireApprovalForContributors: boolean;
              defaultChannels: Array<{ platform: string; placement: string }>;
            };
          }
        | null;

      if (!res.ok) throw new Error(getErrorMessage(payload, "Falha ao salvar configurações de publicação."));

      if (payload?.publishing) {
        setPublishingForm({ requireApprovalForContributors: payload.publishing.requireApprovalForContributors });
        setPublishingChannels(payload.publishing.defaultChannels);
      }
    } catch (error) {
      setPublishingForm((prev) => ({ ...prev, requireApprovalForContributors: previous }));
      toast.error(error instanceof Error ? error.message : "Falha ao salvar configurações de publicação.");
    } finally {
      setSavingPublishingToggle(false);
    }
  }

  function markNotificationKeySaving(key: NotificationField, saving: boolean) {
    setSavingNotificationKeys((prev) => {
      const next = new Set(prev);
      if (saving) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function toggleNotification(key: NotificationField, checked: boolean) {
    if (!canManage || savingNotificationKeys.has(key)) return;

    const previous = notificationsForm[key];
    setNotificationsForm((prev) => ({ ...prev, [key]: checked }));
    markNotificationKeySaving(key, true);

    try {
      const res = await fetch("/api/workspaces/settings/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: checked }),
      });

      const payload = (await res.json().catch(() => null)) as
        | {
            message?: string;
            notifications?: NotificationsFormValue;
          }
        | null;

      if (!res.ok) throw new Error(getErrorMessage(payload, "Falha ao salvar notificações."));

      if (payload?.notifications) {
        setNotificationsForm(payload.notifications);
      }
    } catch (error) {
      setNotificationsForm((prev) => ({ ...prev, [key]: previous }));
      toast.error(error instanceof Error ? error.message : "Falha ao salvar notificações.");
    } finally {
      markNotificationKeySaving(key, false);
    }
  }

  async function connectInstagram() {
    setConnectingInstagram(true);
    try {
      const res = await fetch("/api/workspaces/connections/instagram/auth-url", {
        method: "POST",
      });
      const payload = (await res.json().catch(() => null)) as
        | {
            message?: string;
            oauthState?: string;
            status?: InstagramConnection["status"];
            authUrl?: string;
          }
        | null;

      if (!res.ok) throw new Error(getErrorMessage(payload, "Falha ao iniciar conexão com Instagram."));

      setConnection((prev) => ({
        ...prev,
        status: payload?.status ?? "PENDING",
        connected: false,
        oauthState: payload?.oauthState ?? prev.oauthState,
      }));

      if (payload?.authUrl) {
        window.open(payload.authUrl, "_blank", "noopener,noreferrer");
      }

      toast.success("Fluxo de conexão iniciado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao iniciar conexão com Instagram.");
    } finally {
      setConnectingInstagram(false);
    }
  }

  async function completeInstagram() {
    setCompletingInstagram(true);
    try {
      const res = await fetch("/api/workspaces/connections/instagram/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: "manual-connect",
          state: connection.oauthState,
          accountUsername: "instagram_workspace",
        }),
      });

      const payload = (await res.json().catch(() => null)) as
        | {
            message?: string;
            instagram?: InstagramConnection;
          }
        | null;
      if (!res.ok) throw new Error(getErrorMessage(payload, "Falha ao concluir conexão com Instagram."));

      if (payload?.instagram) setConnection(payload.instagram);
      toast.success("Instagram conectado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao concluir conexão com Instagram.");
    } finally {
      setCompletingInstagram(false);
    }
  }

  async function disconnectInstagram() {
    setDisconnectingInstagram(true);
    try {
      const res = await fetch("/api/workspaces/connections/instagram", {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => null)) as
        | {
            message?: string;
            instagram?: InstagramConnection;
          }
        | null;

      if (!res.ok) throw new Error(getErrorMessage(payload, "Falha ao desconectar Instagram."));

      if (payload?.instagram) setConnection(payload.instagram);
      toast.success("Instagram desconectado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao desconectar Instagram.");
    } finally {
      setDisconnectingInstagram(false);
    }
  }

  async function changeMemberRole(userId: string, role: WorkspaceMember["role"]) {
    setPendingRoleUserId(userId);
    try {
      const res = await fetch(`/api/workspaces/members/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const payload = (await res.json().catch(() => null)) as { message?: string; role?: string } | null;
      if (!res.ok) throw new Error(getErrorMessage(payload, "Falha ao atualizar role do membro."));

      const nextRole = normalizeRole(payload?.role ?? role);
      setMembers((prev) => prev.map((member) => (member.userId === userId ? { ...member, role: nextRole } : member)));
      toast.success("Role atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar role do membro.");
    } finally {
      setPendingRoleUserId(null);
    }
  }

  async function removeMember(member: WorkspaceMember) {
    const confirmed = window.confirm(`Remover ${member.name ?? member.email ?? member.userId} do workspace?`);
    if (!confirmed) return;

    setPendingDeleteUserId(member.userId);
    try {
      const res = await fetch(`/api/workspaces/members/${encodeURIComponent(member.userId)}`, {
        method: "DELETE",
      });

      const payload = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) throw new Error(getErrorMessage(payload, "Falha ao remover membro."));

      setMembers((prev) => prev.filter((current) => current.userId !== member.userId));
      toast.success("Membro removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao remover membro.");
    } finally {
      setPendingDeleteUserId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-10 pb-24">
      {!canManage ? (
        <p className="text-muted-foreground text-sm">Seu perfil tem acesso apenas de leitura para estas configurações.</p>
      ) : null}

      <GeneralSettingsCard
        value={generalDraft}
        canManage={canManage}
        isBusy={savingGeneral}
        isUploadingLogo={uploadingGeneralLogo}
        onChange={setGeneralDraft}
        onUploadLogo={uploadGeneralLogo}
      />

      <PublishingSettingsCard
        value={publishingForm}
        channels={publishingChannels}
        canManage={canManage}
        isSavingToggle={savingPublishingToggle}
        onToggleRequireApproval={toggleRequireApproval}
      />

      <NotificationsSettingsCard
        value={notificationsForm}
        canManage={canManage}
        savingKeys={savingNotificationKeys}
        onToggle={toggleNotification}
      />

      <ConnectionsSettingsCard
        instagram={connection}
        canManage={canManage}
        isConnecting={connectingInstagram}
        isCompleting={completingInstagram}
        isDisconnecting={disconnectingInstagram}
        onConnectInstagram={connectInstagram}
        onCompleteInstagram={completeInstagram}
        onDisconnectInstagram={disconnectInstagram}
      />

      <MembersSettingsCard
        items={members}
        canManage={canManage}
        pendingRoleUserId={pendingRoleUserId}
        pendingDeleteUserId={pendingDeleteUserId}
        onChangeRole={changeMemberRole}
        onRemove={removeMember}
      />

      <UnsavedChangesBar
        visible={hasUnsavedGeneralChanges}
        saving={savingGeneral}
        errorMessage={generalSaveError}
        onDiscard={discardGeneralChanges}
        onSave={saveGeneral}
      />
    </div>
  );
}
