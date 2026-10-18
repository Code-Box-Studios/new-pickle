import { LoginForm } from "./LoginForm";

export function OwnerLoginForm({ nextPath, authError, preview }: {
  nextPath: string;
  authError?: "missing" | "invalid" | "oauth";
  preview?: boolean;
}) {
  return <LoginForm audience="owner" nextPath={nextPath} authError={authError} preview={preview} />;
}
