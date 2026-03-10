import type { APIGatewayProxyHandler } from "aws-lambda";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canManageApproval } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { signPutObject } from "../../media/s3";

type Body = {
  workspaceId?: string;
  contentType?: string;
  fileName?: string;
  sizeBytes?: number;
};

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/heic"]);

function safeExtFromContentType(contentType: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
  };
  return map[contentType] ?? "bin";
}

function randomId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  let body: Body = {};
  try {
    body = event.body ? (JSON.parse(event.body) as Body) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const workspaceId = body.workspaceId?.trim();
  const contentType = body.contentType?.trim();
  const sizeBytes = body.sizeBytes;

  if (!workspaceId) return badRequest("workspaceId é obrigatório.");
  if (!contentType || !ALLOWED_LOGO_CONTENT_TYPES.has(contentType)) {
    return badRequest("Formato de imagem não suportado para logo.");
  }
  if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return badRequest("sizeBytes inválido.");
  }
  if (sizeBytes > MAX_LOGO_BYTES) return badRequest("Arquivo excede 5MB.");

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");
    if (!canManageApproval(membership.role)) return unauthorized("Sem permissão para alterar configurações.");

    const id = randomId();
    const ext = safeExtFromContentType(contentType);
    const workspaceLogoKey = `workspaces/${workspaceId}/settings/logo/${id}.${ext}`;

    const uploadUrl = await signPutObject({
      key: workspaceLogoKey,
      contentType,
      contentLength: sizeBytes,
      expiresSeconds: 60,
    });

    return json(200, { workspaceLogoKey, uploadUrl });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível preparar o upload do logo agora.");
  }
};
