"use client";

import { FaInstagram } from "react-icons/fa";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { SettingsSection } from "./settings-section";

type InstagramConnection = {
  status: "DISCONNECTED" | "PENDING" | "CONNECTED" | "ERROR";
  accountId: string | null;
  accountUsername: string | null;
  tokenExpiresAt: string | null;
  connectedAt: string | null;
  oauthState: string | null;
  lastError: string | null;
};

function statusLabel(status: InstagramConnection["status"]) {
  if (status === "CONNECTED") return "Conectado";
  if (status === "PENDING") return "Pendente";
  if (status === "ERROR") return "Erro";
  return "Desconectado";
}

function statusClassName(status: InstagramConnection["status"]) {
  if (status === "CONNECTED") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "PENDING") return "bg-amber-100 text-amber-700 border-amber-200";
  if (status === "ERROR") return "bg-red-100 text-red-700 border-red-200";
  return "bg-zinc-100 text-zinc-700 border-zinc-200";
}

function formatDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Recife",
  }).format(parsed);
}

export function ConnectionsSettingsCard(props: {
  instagram: InstagramConnection;
  canManage: boolean;
  isConnecting: boolean;
  isCompleting: boolean;
  isDisconnecting: boolean;
  onConnectInstagram: () => void;
  onCompleteInstagram: () => void;
  onDisconnectInstagram: () => void;
}) {
  const disabled = !props.canManage;
  const busy = props.isConnecting || props.isCompleting || props.isDisconnecting;
  const connectedAt = formatDate(props.instagram.connectedAt);
  const tokenExpiresAt = formatDate(props.instagram.tokenExpiresAt);

  return (
    <SettingsSection
      title="Conexões"
    >
      <div className="rounded-md border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <FaInstagram className="size-4 text-pink-600" />
              <p className="text-sm font-medium">Instagram</p>
              <Badge variant="outline" className={statusClassName(props.instagram.status)}>
                {statusLabel(props.instagram.status)}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              {props.instagram.status === "CONNECTED"
                ? "Conta pronta para uso nos agendamentos."
                : "Conecte para habilitar publicação automática no Instagram."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {props.instagram.status === "PENDING" ? (
              <Button variant="outline" size="sm" disabled={disabled || busy} onClick={props.onCompleteInstagram}>
                {props.isCompleting ? (
                  <div className="flex items-center gap-2">
                    <Spinner data-icon="inline-start" />
                    Concluindo...
                  </div>
                ) : (
                  "Concluir"
                )}
              </Button>
            ) : null}

            {props.instagram.status === "CONNECTED" ? (
              <Button variant="destructive" size="sm" disabled={disabled || busy} onClick={props.onDisconnectInstagram}>
                {props.isDisconnecting ? (
                  <div className="flex items-center gap-2">
                    <Spinner data-icon="inline-start" />
                    Desconectando...
                  </div>
                ) : (
                  "Desconectar"
                )}
              </Button>
            ) : (
              <Button size="sm" disabled={disabled || busy} onClick={props.onConnectInstagram}>
                {props.isConnecting ? (
                  <div className="flex items-center gap-2">
                    <Spinner data-icon="inline-start" />
                    Conectando...
                  </div>
                ) : (
                  "Conectar"
                )}
              </Button>
            )}
          </div>
        </div>

        {props.instagram.accountUsername || props.instagram.accountId ? (
          <div className="mt-3 rounded-md border bg-muted/20 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Conta:</span>{" "}
              <span className="font-medium">{props.instagram.accountUsername ?? "Sem username"}</span>
            </p>
            {props.instagram.accountId ? <p className="text-muted-foreground text-xs">ID: {props.instagram.accountId}</p> : null}
            {connectedAt ? <p className="text-muted-foreground text-xs">Conectado em {connectedAt}</p> : null}
            {tokenExpiresAt ? <p className="text-muted-foreground text-xs">Token expira em {tokenExpiresAt}</p> : null}
          </div>
        ) : null}

        {props.instagram.lastError ? <p className="mt-2 text-xs text-red-600">Último erro: {props.instagram.lastError}</p> : null}
      </div>
    </SettingsSection>
  );
}
