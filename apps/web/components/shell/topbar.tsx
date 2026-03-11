"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, PanelLeftIcon } from "lucide-react";
import { IoSettingsOutline } from "react-icons/io5";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { WorkspaceSelectorContent } from "@/components/shell/workspace-selector-content";
import { ThemeToggle } from "./theme-toggle";

const ALLOWED_LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/heic"]);
const ALLOWED_LOGO_EXT_REGEX = /\.(png|jpe?g|webp|heic)$/i;

type PresignResponse = {
  workspaceLogoKey?: string;
  uploadUrl?: string;
  message?: string;
};

type SaveGeneralResponse = {
  general?: {
    workspaceLogoUrl?: string | null;
  };
  message?: string;
};

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

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

function getWorkspaceInitials(name: string | null) {
  if (!name?.trim()) return "WS";
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("") || "WS";
}

export function Topbar(props: {
  workspaceName: string | null;
  workspaceLogoUrl: string | null;
  canManageWorkspace: boolean;
  onOpenMobileSidebar(): void;
  onToggleDesktopSidebar(): void;
}) {
  const router = useRouter();
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(props.workspaceLogoUrl);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const { data, error, loading, selecting, select, refetch } = useWorkspaces();

  useEffect(() => {
    setLogoUrl(props.workspaceLogoUrl);
  }, [props.workspaceLogoUrl]);

  const handleOpenChange = (open: boolean) => {
    setWorkspaceDialogOpen(open);
    if (open) refetch();
  };

  const handleSelect = (workspaceId: string) => {
    select(workspaceId).then((ok) => {
      if (ok) {
        setWorkspaceDialogOpen(false);
        router.refresh();
      }
    });
  };

  function openLogoPicker() {
    if (!props.canManageWorkspace || uploadingLogo) return;
    logoInputRef.current?.click();
  }

  async function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    event.currentTarget.value = "";

    if (!isAllowedLogoFile(file)) {
      toast.error("Formato inválido. Use PNG, JPEG, WebP ou HEIC.");
      return;
    }
    const contentType = resolveLogoContentType(file);
    if (!contentType) {
      toast.error("Não foi possível identificar o tipo da imagem.");
      return;
    }

    setUploadingLogo(true);
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

      const presignPayload = (await presignRes.json().catch(() => null)) as PresignResponse | null;
      if (!presignRes.ok || !presignPayload?.workspaceLogoKey || !presignPayload?.uploadUrl) {
        throw new Error(getErrorMessage(presignPayload, "Falha ao preparar upload do logo."));
      }

      const uploadRes = await fetch(presignPayload.uploadUrl, {
        method: "PUT",
        headers: { "content-type": contentType },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Falha ao enviar a imagem do logo.");

      const saveRes = await fetch("/api/workspaces/settings/general", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceLogoKey: presignPayload.workspaceLogoKey }),
      });

      const savePayload = (await saveRes.json().catch(() => null)) as SaveGeneralResponse | null;
      if (!saveRes.ok) throw new Error(getErrorMessage(savePayload, "Falha ao salvar logo do workspace."));

      setLogoUrl(savePayload?.general?.workspaceLogoUrl ?? null);
      toast.success("Logo do workspace atualizado.");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar logo do workspace.");
    } finally {
      setUploadingLogo(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-2 border-b bg-background/80 px-3 py-2 backdrop-blur sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            className="md:hidden"
            variant="ghost"
            size="icon"
            onClick={props.onOpenMobileSidebar}
            aria-label="Abrir menu"
          >
            <PanelLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            className="hidden md:inline-flex"
            variant="ghost"
            size="icon"
            onClick={props.onToggleDesktopSidebar}
            aria-label="Alternar sidebar"
          >
            <PanelLeftIcon className="h-4 w-4" />
          </Button>

          <input
            ref={logoInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.heic,image/png,image/jpeg,image/webp,image/heic"
            className="hidden"
            onChange={handleLogoFileChange}
          />

          <button
            type="button"
            className="group relative inline-flex cursor-pointer disabled:cursor-not-allowed"
            onClick={openLogoPicker}
            disabled={!props.canManageWorkspace || uploadingLogo}
            aria-label={props.canManageWorkspace ? "Alterar logo do workspace" : "Logo do workspace"}
            title={props.canManageWorkspace ? "Alterar logo do workspace" : "Logo do workspace"}
          >
            <Avatar className="ring-1 ring-border">
              {logoUrl ? <AvatarImage src={logoUrl} alt="Logo do workspace" className="object-cover" /> : null}
              <AvatarFallback>{getWorkspaceInitials(props.workspaceName)}</AvatarFallback>
            </Avatar>
            {uploadingLogo ? (
              <span className="bg-background/90 absolute inset-0 flex items-center justify-center rounded-full">
                <Spinner className="size-3" />
              </span>
            ) : null}
          </button>

          <div className="flex min-w-0 flex-col leading-tight">
            <div className="text-muted-foreground hidden text-xs sm:block">Workspace atual</div>
            {props.workspaceName ? (
              <div className="truncate text-sm font-medium">{props.workspaceName}</div>
            ) : null}
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="sm:hidden"
            onClick={() => setWorkspaceDialogOpen(true)}
            aria-label="Ver meus workspaces"
            title="Ver meus workspaces"
          >
            <BriefcaseBusiness className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="hidden sm:inline-flex md:max-w-[34vw] lg:max-w-none"
            onClick={() => setWorkspaceDialogOpen(true)}
          >
            Ver meus workspaces
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Abrir configurações">
            <Link href="/app/settings">
              <IoSettingsOutline className="h-4 w-4" />
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <Dialog open={workspaceDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecione um workspace</DialogTitle>
            <DialogDescription>Escolha a empresa em que você vai trabalhar agora.</DialogDescription>
          </DialogHeader>
          <WorkspaceSelectorContent
            data={data}
            error={error}
            loading={loading}
            selecting={selecting}
            onSelect={handleSelect}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
