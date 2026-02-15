"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const profileFormSchema = z
  .object({
    name: z
      .string()
      .max(100, "O nome deve ter no máximo 100 caracteres.")
      .transform((v) => v.trim()),
    email: z.string(),
    avatar: z.string(),
    currentPassword: z.string(),
    newPassword: z.string(),
    confirmNewPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    const hasAnyPassword = [
      data.currentPassword.trim(),
      data.newPassword.trim(),
      data.confirmNewPassword.trim(),
    ].some((v) => v.length > 0);

    if (!hasAnyPassword) return;

    if (!data.currentPassword.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe a senha atual.", path: ["currentPassword"] });
      return;
    }
    if (data.newPassword.length < 8) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A senha deve ter pelo menos 8 caracteres.", path: ["newPassword"] });
      return;
    }
    if (!/[a-z]/.test(data.newPassword)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A senha deve ter pelo menos 1 letra minúscula.", path: ["newPassword"] });
      return;
    }
    if (!/[A-Z]/.test(data.newPassword)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A senha deve ter pelo menos 1 letra maiúscula.", path: ["newPassword"] });
      return;
    }
    if (!/[0-9]/.test(data.newPassword)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A senha deve ter pelo menos 1 número.", path: ["newPassword"] });
      return;
    }
    if (data.newPassword !== data.confirmNewPassword) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "As senhas não coincidem.", path: ["confirmNewPassword"] });
    }
  });

type ProfileFormValues = z.infer<typeof profileFormSchema>;

type InitialValues = {
  name: string;
  email: string;
  avatar: string;
};

type MePayload = {
  name?: string | null;
  email?: string;
  avatar?: string | null;
};

export function ProfileModal(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState<InitialValues | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      email: "",
      avatar: "",
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
    mode: "onSubmit",
  });

  const avatarUrl = avatarPreview ?? (form.watch("avatar") || null);

  useEffect(() => {
    if (!props.open) return;

    setAvatarPreview(null);
    setLoadingMe(true);
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MePayload | null) => {
        if (data) {
          const initial = {
            name: data.name ?? "",
            email: data.email ?? "",
            avatar: data.avatar ?? "",
          };
          setInitialValues(initial);
          form.reset({
            ...initial,
            currentPassword: "",
            newPassword: "",
            confirmNewPassword: "",
          });
        }
      })
      .catch(() => toast.error("Não foi possível carregar o perfil."))
      .finally(() => setLoadingMe(false));
  }, [props.open]);

  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (JPEG, PNG, WEBP ou similar).");
      return;
    }
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
    form.setValue("avatar", url);
  }

  function hasProfileChanges(values: ProfileFormValues): boolean {
    if (!initialValues) return false;
    const nameChanged = (values.name ?? "").trim() !== initialValues.name.trim();
    const avatarChanged = (avatarPreview ?? values.avatar) !== initialValues.avatar;
    return nameChanged || avatarChanged;
  }

  function hasPasswordChanges(values: ProfileFormValues): boolean {
    return (
      values.currentPassword.trim() !== "" &&
      values.newPassword.trim() !== "" &&
      values.confirmNewPassword.trim() !== ""
    );
  }

  async function onSubmit(values: ProfileFormValues) {
    const profileChanged = hasProfileChanges(values);
    const passwordChanged = hasPasswordChanges(values);

    if (!profileChanged && !passwordChanged) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }

    let profileOk = true;
    let passwordOk = true;

    if (profileChanged) {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name?.trim() || undefined }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        toast.error(payload?.message ?? "Não foi possível salvar o perfil.");
        profileOk = false;
      }
    }

    if (passwordChanged && (profileOk || !profileChanged)) {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        toast.error(payload?.message ?? "Não foi possível alterar a senha.");
        passwordOk = false;
      } else {
        form.setValue("currentPassword", "");
        form.setValue("newPassword", "");
        form.setValue("confirmNewPassword", "");
      }
    }

    if (profileOk && (passwordChanged ? passwordOk : true)) {
      const messages: string[] = [];
      if (profileChanged) messages.push("Perfil atualizado.");
      if (passwordChanged && passwordOk) messages.push("Senha alterada.");
      toast.success(messages.join(" "));
      setInitialValues({
        name: (values.name ?? "").trim(),
        email: values.email ?? "",
        avatar: avatarPreview ?? values.avatar ?? "",
      });
      props.onOpenChange(false);
      router.refresh();
    }
  }

  const isSubmitting = form.formState.isSubmitting;
  const disabled = loadingMe || isSubmitting;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!disabled}>
        <DialogHeader>
          <DialogTitle>Seus dados</DialogTitle>
        </DialogHeader>
        <Separator />

        {loadingMe ? (
          <div className="text-muted-foreground py-6 text-center text-sm">
            Carregando...
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-hidden
              onChange={handleAvatarFileChange}
            />

            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={disabled}
                className="rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none size-28 shrink-0 sm:size-32"
              >
                <Avatar className="size-full ring-2 ring-border">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt="Avatar" />
                  ) : null}
                  <AvatarFallback className="text-3xl sm:text-4xl">
                    <UserIcon className="size-14 text-muted-foreground sm:size-16" />
                  </AvatarFallback>
                </Avatar>
                <span className="sr-only">Escolher foto</span>
              </button>
              <span className="text-muted-foreground text-xs">
                Clique na foto para trocar (em breve: upload será salvo)
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-name">Nome</Label>
              <Input
                id="profile-name"
                {...form.register("name")}
                placeholder="Seu nome"
                disabled={disabled}
              />
              {form.formState.errors.name?.message && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                {...form.register("email")}
                disabled
                className="bg-muted"
              />
              <p className="text-muted-foreground text-xs">
                O email não pode ser alterado aqui.
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-base font-semibold">Senha</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="profile-current-password">Senha atual</Label>
                  <Input
                    id="profile-current-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    disabled={disabled}
                    {...form.register("currentPassword")}
                  />
                  {form.formState.errors.currentPassword?.message && (
                    <p className="text-destructive text-sm">
                      {form.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-new-password">Nova senha</Label>
                  <Input
                    id="profile-new-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    disabled={disabled}
                    {...form.register("newPassword")}
                  />
                  {form.formState.errors.newPassword?.message && (
                    <p className="text-destructive text-sm">
                      {form.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-confirm-password">Confirmar nova senha</Label>
                  <Input
                    id="profile-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    disabled={disabled}
                    {...form.register("confirmNewPassword")}
                  />
                  {form.formState.errors.confirmNewPassword?.message && (
                    <p className="text-destructive text-sm">
                      {form.formState.errors.confirmNewPassword.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => props.onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={disabled}>
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
