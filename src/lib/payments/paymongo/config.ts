import "server-only";
import { AppError } from "@/lib/booking/errors";

export type PayMongoMode = "test" | "live";
export type PayMongoMethod = "gcash" | "paymaya" | "qrph";
export interface Merchant {
  alias: string;
  ownerId: string;
  venueIds: readonly string[];
  mode: PayMongoMode;
  methods: readonly PayMongoMethod[];
  secretKey: string;
  webhookSecret: string;
}
const METHODS: PayMongoMethod[] = ["gcash", "paymaya", "qrph"];
export function configurationError(): never {
  throw new AppError(
    "Online payments are not available yet. Contact the venue for payment help.",
    503,
    "payments_unavailable",
  );
}
export function ledgerReady() {
  return process.env.PAYMONGO_LEDGER_READY === "true";
}
export function appOrigin() {
  try {
    const url = new URL(process.env.APP_URL ?? "");
    if (
      url.username ||
      url.password ||
      !["http:", "https:"].includes(url.protocol) ||
      (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    )
      configurationError();
    return url.origin;
  } catch {
    return configurationError();
  }
}
function merchants(): Merchant[] {
  const mode = process.env.PAYMONGO_MODE;
  if (mode !== "test" && mode !== "live") configurationError();
  try {
    const entries: unknown = JSON.parse(process.env.PAYMONGO_MERCHANTS ?? "[]");
    if (!Array.isArray(entries)) configurationError();
    const aliases = new Set<string>(),
      venues = new Set<string>();
    return entries.map((entry) => {
      if (!entry || typeof entry !== "object") configurationError();
      const {
        alias,
        ownerId,
        venueIds,
        methods = METHODS,
        secretKeyEnv = "PAYMONGO_SECRET_KEY",
        webhookSecretEnv = "PAYMONGO_WEBHOOK_SECRET",
      } = entry;
      if (
        typeof alias !== "string" ||
        !/^[a-z0-9][a-z0-9-]{0,47}$/.test(alias) ||
        aliases.has(alias) ||
        typeof ownerId !== "string" ||
        !ownerId.trim() ||
        !Array.isArray(venueIds) ||
        !venueIds.length ||
        venueIds.some(
          (id) => typeof id !== "string" || !id.trim() || venues.has(id),
        ) ||
        new Set(venueIds).size !== venueIds.length ||
        !Array.isArray(methods) ||
        !methods.length ||
        methods.some((method) => !METHODS.includes(method)) ||
        new Set(methods).size !== methods.length ||
        typeof secretKeyEnv !== "string" ||
        !/^PAYMONGO_(?:[A-Z0-9_]+_)?SECRET_KEY$/.test(secretKeyEnv) ||
        typeof webhookSecretEnv !== "string" ||
        !/^PAYMONGO_(?:[A-Z0-9_]+_)?WEBHOOK_SECRET$/.test(webhookSecretEnv)
      )
        configurationError();
      const secretKey = process.env[secretKeyEnv],
        webhookSecret = process.env[webhookSecretEnv];
      if (!secretKey?.startsWith(`sk_${mode}_`) || !webhookSecret?.trim())
        configurationError();
      aliases.add(alias);
      venueIds.forEach((id) => venues.add(id));
      return {
        alias,
        ownerId,
        venueIds,
        mode,
        methods,
        secretKey,
        webhookSecret,
      };
    });
  } catch {
    return configurationError();
  }
}
export function merchantForVenue(
  venueId: string,
  ownerId: string,
): Merchant | null {
  if (process.env.PAYMONGO_ENABLED !== "true" || !ledgerReady()) return null;
  appOrigin();
  return (
    merchants().find(
      (m) => m.ownerId === ownerId && m.venueIds.includes(venueId),
    ) ?? null
  );
}
/** Settlement stays available when checkout creation is switched off. */
export function merchantByAlias(alias: string, mode: string): Merchant {
  if (!ledgerReady()) configurationError();
  return (
    merchants().find((m) => m.alias === alias && m.mode === mode) ??
    configurationError()
  );
}
