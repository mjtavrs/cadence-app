"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserIcon, ChevronDown, ChevronUp } from "lucide-react";
import { IoIosLock } from "react-icons/io";

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
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ACCEPT_AVATAR = "image/png,image/jpeg,image/webp,image/heic,image/heif";

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
  const [securityOpen, setSecurityOpen] = useState(false);
  const [newPasswordFocused, setNewPasswordFocused] = useState(false);

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
    if (!file) return;
    const accepted = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
    if (!accepted.includes(file.type)) {
      toast.error("Selecione uma imagem (PNG, JPEG, WEBP ou HEIC).");
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

  const sectionTitleClass = "text-base font-semibold mb-3";

  const newPasswordRegister = form.register("newPassword");
  const newPasswordFieldProps = {
    ...newPasswordRegister,
    onFocus: () => setNewPasswordFocused(true),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      newPasswordRegister.onBlur(e);
      setNewPasswordFocused(false);
    },
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent className="sm:max-w-xl" showCloseButton={!disabled}>
        <DialogHeader className="pb-1">
          <DialogTitle className="text-xl">Seus dados</DialogTitle>
        </DialogHeader>

        {loadingMe ? (
          <div className="text-muted-foreground py-6 text-center text-sm">
            Carregando...
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-1">
            <p className={sectionTitleClass}>Perfil</p>
            <Separator />
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_AVATAR}
              className="hidden"
              aria-hidden
              onChange={handleAvatarFileChange}
            />

            <div className="flex items-start gap-8">
              <div className="flex shrink-0 flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={disabled}
                  className="rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none size-24 shrink-0 sm:size-28"
                >
                  <Avatar className="size-full ring-2 ring-border">
                    {avatarUrl ? (
                      <AvatarImage src={avatarUrl} alt="Avatar" />
                    ) : null}
                    <AvatarFallback className="text-2xl sm:text-3xl">
                      <UserIcon className="size-12 text-muted-foreground sm:size-14" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="sr-only">Escolher foto</span>
                </button>
                <Button
                  type="button"
                  variant="link"
                  className="text-sky-500 h-auto p-0 text-sm hover:text-sky-600"
                  onClick={handleAvatarClick}
                  disabled={disabled}
                >
                  Alterar imagem
                </Button>
              </div>

              <div className="min-w-0 flex-1 space-y-3">
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

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="space-y-2 cursor-help">
                      <Label htmlFor="profile-email">Email</Label>
                      <div className="relative">
                        <Input
                          id="profile-email"
                          type="email"
                          {...form.register("email")}
                          disabled
                          className="bg-muted pr-10"
                        />
                        <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                          <IoIosLock className="size-5" />
                        </span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start">
                    O email não pode ser alterado aqui.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setSecurityOpen((o) => !o)}
                className={`group flex w-full cursor-pointer items-center justify-between py-1 ${sectionTitleClass}`}
                aria-expanded={securityOpen}
              >
                Segurança
                {securityOpen ? (
                  <ChevronUp className="size-4 shrink-0" />
                ) : (
                  <ChevronDown className="size-4 shrink-0" />
                )}
              </button>
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: securityOpen ? "1fr" : "0fr" }}
              >
                <div className="min-h-0 overflow-hidden px-1 pb-1">
                  <div className="space-y-3 pt-3">
                    <div className="space-y-2">
                      <Label htmlFor="profile-current-password">Senha atual</Label>
                      <PasswordInput
                        id="profile-current-password"
                        placeholder="••••••••"
                        autoComplete="current-password"
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
                      <PasswordInput
                        id="profile-new-password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        disabled={disabled}
                        {...newPasswordFieldProps}
                      />
                      {form.formState.errors.newPassword?.message && (
                        <p className="text-destructive text-sm">
                          {form.formState.errors.newPassword.message}
                        </p>
                      )}
                      <div
                        className="grid transition-[grid-template-rows] duration-200 ease-out"
                        style={{ gridTemplateRows: newPasswordFocused ? "1fr" : "0fr" }}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <ul className="text-muted-foreground mt-1.5 list-inside list-disc text-xs">
                            <li>Mínimo 8 caracteres</li>
                            <li>Pelo menos 1 letra minúscula</li>
                            <li>Pelo menos 1 letra maiúscula</li>
                            <li>Pelo menos 1 número</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-confirm-password">Confirmar nova senha</Label>
                      <PasswordInput
                        id="profile-confirm-password"
                        placeholder="••••••••"
                        autoComplete="new-password"
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
