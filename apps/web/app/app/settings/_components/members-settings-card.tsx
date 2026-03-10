"use client";

import { Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import type { WorkspaceMember } from "../types";
import { SettingsSection } from "./settings-section";

const roleOptions: WorkspaceMember["role"][] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];

function memberLabel(member: WorkspaceMember) {
  return member.name || member.email || member.userId;
}

export function MembersSettingsCard(props: {
  items: WorkspaceMember[];
  canManage: boolean;
  pendingRoleUserId: string | null;
  pendingDeleteUserId: string | null;
  onChangeRole: (userId: string, role: WorkspaceMember["role"]) => void;
  onRemove: (member: WorkspaceMember) => void;
}) {
  return (
    <SettingsSection title="Membros">
      {props.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum membro encontrado.</p>
      ) : (
        <ScrollArea className="max-h-[420px] pr-2">
          <div className="space-y-2">
            {props.items.map((member) => {
              const rolePending = props.pendingRoleUserId === member.userId;
              const deletePending = props.pendingDeleteUserId === member.userId;
              const busy = rolePending || deletePending;
              const canEditMember = props.canManage && !member.isCurrentUser;

              return (
                <div
                  key={member.userId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">{memberLabel(member)}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {member.email ? (
                        <span className="text-muted-foreground text-xs">{member.email}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">{member.userId}</span>
                      )}
                      {member.isCurrentUser ? <Badge variant="outline">Você</Badge> : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={member.role}
                      onValueChange={(role) => props.onChangeRole(member.userId, role as WorkspaceMember["role"])}
                      disabled={!canEditMember || busy}
                    >
                      <SelectTrigger size="sm" className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="text-red-600 hover:text-red-600"
                      disabled={!canEditMember || busy}
                      onClick={() => props.onRemove(member)}
                    >
                      {deletePending ? <Spinner /> : <Trash2Icon className="size-4" />}
                    </Button>

                    {rolePending ? <Spinner className="text-muted-foreground" /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </SettingsSection>
  );
}

