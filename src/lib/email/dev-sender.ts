import type { EmailSender } from "./sender";

// Dev-only: keep the most recent magic link per email so a dev-only banner /
// endpoint can surface it (no SMTP needed). Backed by globalThis so it survives
// module re-evaluation in the Next dev server.
const g = globalThis as unknown as { __rpMagicLinks?: Map<string, string> };
export const lastMagicLinks: Map<string, string> =
  g.__rpMagicLinks ?? (g.__rpMagicLinks = new Map());

export class DevConsoleSender implements EmailSender {
  async sendMagicLink(to: string, url: string): Promise<void> {
    lastMagicLinks.set(to.toLowerCase(), url);
    console.log(`\n🔗 [DEV magic link] ${to}\n   ${url}\n`);
  }
}
