import * as React from "react";
import { cn } from "@/lib/cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-input bg-background px-4 py-2.5 text-base transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

// Compatibility composition preserves label and validation IDs across existing forms.
import {
  Field as FormField,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "./field";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const descriptionId =
    htmlFor && (error || hint) ? `${htmlFor}-description` : undefined;
  let control = children;
  if (
    htmlFor &&
    React.isValidElement<{ id?: string } & React.AriaAttributes>(children) &&
    children.props.id === htmlFor
  ) {
    control = React.cloneElement(children, {
      "aria-invalid": error ? true : children.props["aria-invalid"],
      "aria-describedby":
        [children.props["aria-describedby"], descriptionId]
          .filter(Boolean)
          .join(" ") || undefined,
    });
  }
  return (
    <FormField data-invalid={error ? true : undefined} className="gap-2">
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {control}
      {error ? (
        <FieldError id={descriptionId}>{error}</FieldError>
      ) : hint ? (
        <FieldDescription id={descriptionId}>{hint}</FieldDescription>
      ) : null}
    </FormField>
  );
}
