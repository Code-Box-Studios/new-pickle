import type { PaymentChannel } from "@/generated/prisma";

export const CHANNEL_LABELS: Record<PaymentChannel, string> = {
  GCASH: "GCash",
  MAYA: "Maya",
  QRPH: "QR Ph",
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
};

export function channelLabel(c: PaymentChannel): string {
  return CHANNEL_LABELS[c] ?? c;
}
