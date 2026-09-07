import { LocalFsStorage } from "./local-fs-storage";
import type { PaymentProofStorage } from "./proof-storage";

/**
 * Single place that picks storage implementations. Swap to object storage here
 * for production; callers import these instances.
 */
export const paymentProofStorage: PaymentProofStorage = new LocalFsStorage("payment-proofs");
export const venueMediaStorage: PaymentProofStorage = new LocalFsStorage("venue-media");

export * from "./proof-storage";
