"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "next-themes";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("Informe um email válido."),
  password: z.string().min(1, "Informe sua senha."),
});

const newPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres.")
      .regex(/[a-z]/, "A senha deve ter pelo menos 1 letra minúscula.")
      .regex(/[A-Z]/, "A senha deve ter pelo menos 1 letra maiúscula.")
      .regex(/[0-9]/, "A senha deve ter pelo menos 1 número."),
    confirmPassword: z.string().min(1, "Confirme sua nova senha."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

type LoginFormValues = z.infer<typeof loginSchema>;
type NewPasswordFormValues = z.infer<typeof newPasswordSchema>;

type Mode = "login" | "newPassword";

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") || "/app", [searchParams]);
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === "dark" ? "/logo_light.webp" : "/logo_dark.webp";

  const [mode, setMode] = useState<Mode>("login");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  });

  const newPasswordForm = useForm<NewPasswordFormValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
    mode: "onChange",
  });

  const watchedPassword = newPasswordForm.watch("newPassword");
  const checks = useMemo(() => {
    return [
      { ok: watchedPassword.length >= 8, label: "Pelo menos 8 caracteres" },
      { ok: /[a-z]/.test(watchedPassword), label: "1 letra minúscula" },
      { ok: /[A-Z]/.test(watchedPassword), label: "1 letra maiúscula" },
      { ok: /[0-9]/.test(watchedPassword), label: "1 número" },
    ];
  }, [watchedPassword]);

  async function onLoginSubmit(values: LoginFormValues) {
    setServerError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as unknown;
        const message = getErrorMessage(payload) ?? "Não foi possível entrar agora.";
        if (res.status === 409) {
          setMode("newPassword");
          setServerError(null);
          newPasswordForm.reset();
          setIsLoading(false);
          return;
        }
        setServerError(message);
        setIsLoading(false);
        return;
      }

      // Manter loading até a navegação completar
      router.replace(next);
    } catch (error) {
      setServerError("Não foi possível entrar agora.");
      setIsLoading(false);
    }
  }

  async function onNewPasswordSubmit(values: NewPasswordFormValues) {
    setServerError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/new-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword: values.newPassword }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as unknown;
        setServerError(getErrorMessage(payload) ?? "Não foi possível definir a nova senha agora.");
        setIsLoading(false);
        return;
      }

      // Manter loading até a navegação completar
      router.replace(next);
    } catch (error) {
      setServerError("Não foi possível definir a nova senha agora.");
      setIsLoading(false);
    }
  }

  const isSubmitting = isLoading || loginForm.formState.isSubmitting || newPasswordForm.formState.isSubmitting;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <Image
        src={logoSrc}
        alt="Cadence"
        width={200}
        height={200}
        className="mb-8 h-auto w-40 shrink-0 object-contain"
        priority
      />
      <Card className="w-full max-w-md p-6">
        <div className="mb-6 space-y-1 text-center">
          <h1 className="text-3xl font-normal tracking-tight">
            {mode === "login" ? "Entrar" : "Definir nova senha"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {mode === "login"
              ? "Acesse seu workspace e continue seu planejamento editorial."
              : "Por segurança, defina uma nova senha para continuar."}
          </p>
        </div>

        {mode === "login" ? (
          <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@empresa.com"
                disabled={isSubmitting}
                {...loginForm.register("email")}
              />
              {loginForm.formState.errors.email?.message && (
                <p className="text-destructive text-sm">
                  {loginForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                disabled={isSubmitting}
                {...loginForm.register("password")}
              />
              {loginForm.formState.errors.password?.message && (
                <p className="text-destructive text-sm">
                  {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>

            {serverError && <p className="text-destructive text-sm">{serverError}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        ) : (
          <form onSubmit={newPasswordForm.handleSubmit(onNewPasswordSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <PasswordInput
                id="newPassword"
                autoComplete="new-password"
                disabled={isSubmitting}
                {...newPasswordForm.register("newPassword")}
              />
              {newPasswordForm.formState.errors.newPassword?.message && (
                <p className="text-destructive text-sm">
                  {newPasswordForm.formState.errors.newPassword.message}
                </p>
              )}
              <ul className="text-muted-foreground text-sm space-y-1">
                {checks.map((c) => (
                  <li key={c.label} className={c.ok ? "text-green-700 dark:text-green-400" : ""}>
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                disabled={isSubmitting}
                {...newPasswordForm.register("confirmPassword")}
              />
              {newPasswordForm.formState.errors.confirmPassword?.message && (
                <p className="text-destructive text-sm">
                  {newPasswordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            {serverError && <p className="text-destructive text-sm">{serverError}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Definir senha e continuar"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={isSubmitting}
              onClick={() => {
                setMode("login");
                setServerError(null);
                newPasswordForm.reset();
              }}
            >
              Voltar
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
          <Card className="w-full max-w-md p-6">
            <div className="text-muted-foreground text-sm">Carregando...</div>
          </Card>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

