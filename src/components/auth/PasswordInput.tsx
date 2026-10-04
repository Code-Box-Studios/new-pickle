"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function PasswordInput({ id, label = "Password", value, onChange, isNew = false, invalid = false }: {
  id: string; label?: string; value: string; onChange: (value: string) => void; isNew?: boolean; invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <Field label={label} htmlFor={id}>
    <div className="relative min-w-0">
      <Input id={id} type={visible ? "text" : "password"} value={value} onChange={event => onChange(event.target.value)} autoComplete={isNew ? "new-password" : "current-password"} minLength={isNew ? 8 : undefined} maxLength={isNew ? 72 : 1024} required placeholder={isNew ? "Create a strong password" : "Enter your password"} className="h-13 bg-canvas pr-14" aria-invalid={invalid || undefined} />
      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 size-11 text-muted-foreground" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}</Button>
    </div>
  </Field>;
}
