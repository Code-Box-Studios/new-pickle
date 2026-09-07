/**
 * Email seam. Dev prints the link; a prod sender (Resend/SMTP) plugs in via
 * `email/index.ts` without touching callers.
 */
export interface EmailSender {
  sendMagicLink(to: string, url: string): Promise<void>;
}
