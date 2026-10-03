import { LocalFsStorage } from "./local-fs-storage";
import { SupabaseStorage } from "./supabase-storage";
import type { PaymentProofStorage } from "./proof-storage";

const useLocal = process.env.STORAGE_PROVIDER === "local" && process.env.NODE_ENV !== "production";
export const paymentProofStorage: PaymentProofStorage = useLocal ? new LocalFsStorage("payment-proofs") : new SupabaseStorage("payment-proofs");
export const venueMediaStorage: PaymentProofStorage = useLocal ? new LocalFsStorage("venue-media") : new SupabaseStorage("venue-media");
export * from "./proof-storage";
