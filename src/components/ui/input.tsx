import * as React from "react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "form-control px-4 py-2.5 placeholder:text-muted/80",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Field = ({
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
}) => {
  const descriptionId = htmlFor && (error || hint) ? `${htmlFor}-description` : undefined;
  let control = children;
  if (
    htmlFor &&
    React.isValidElement<{ id?: string } & React.AriaAttributes>(children) &&
    children.props.id === htmlFor
  ) {
    control = React.cloneElement(children, {
      "aria-invalid": error ? true : children.props["aria-invalid"],
      "aria-describedby": [children.props["aria-describedby"], descriptionId].filter(Boolean).join(" ") || undefined,
    });
  }
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {control}
      {error ? (
        <p id={descriptionId} role="alert" className="text-sm leading-relaxed text-red-700">{error}</p>
      ) : hint ? (
        <p id={descriptionId} className="text-sm leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  );
};
