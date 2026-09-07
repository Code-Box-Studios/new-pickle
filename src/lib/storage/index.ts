import { LocalFsStorage } from "./local-fs-storage";
import type { PaymentProofStorage } from "./proof-storage";

/**
 * Single place that picks the storage implementation. Swap to an object-storage
 * implementation here for production; callers import `paymentProofStorage`.
 */
export const paymentProofStorage: PaymentProofStorage = new LocalFsStorage();

export * from "./proof-storage";
