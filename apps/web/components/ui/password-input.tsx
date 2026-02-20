"use client";

import { useState } from "react";
import { LuEye, LuEyeClosed } from "react-icons/lu";
import { cn } from "@/lib/utils";
import { Input } from "./input";

interface PasswordInputProps extends Omit<React.ComponentProps<typeof Input>, "type"> {
  showToggle?: boolean;
}

export function PasswordInput({ showToggle = true, className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-10 hide-password-browser-toggle", className)}
        {...props}
      />
      {showToggle && (
        <button
          type="button"
          tabIndex={-1}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          onClick={() => setVisible((v) => !v)}
          disabled={props.disabled}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? <LuEyeClosed className="size-4" /> : <LuEye className="size-4" />}
        </button>
      )}
    </div>
  );
}
