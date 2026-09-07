import { DevConsoleSender } from "./dev-sender";
import type { EmailSender } from "./sender";

/**
 * Picks the email implementation. The thin slice ships the dev sender only; a
 * production sender (Resend/SMTP) plugs in here without touching callers.
 */
export const emailSender: EmailSender = new DevConsoleSender();

export * from "./sender";
