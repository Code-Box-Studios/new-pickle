/** Browser-safe Pasalo payloads. Dates are ISO strings; prices are centavos. */
export type ListingStatus = "ACTIVE" | "RESERVED" | "SOLD" | "WITHDRAWN" | "EXPIRED" | "VOIDED";
export type TradeStatus = "RESERVED" | "PAYMENT_SENT" | "TRANSFERRED" | "RELEASED" | "EXPIRED" | "VOIDED";

export interface PasaloListingView {
  id: string;
  venueName: string;
  venueSlug: string;
  courtName: string;
  city: string;
  startsAt: string;
  endsAt: string;
  originalPriceCents: number;
  priceCents: number;
  note: string | null;
  status: ListingStatus;
  sellerName: string;
}

export interface PasaloTradeView {
  id: string;
  status: TradeStatus;
  priceCents: number;
  customerName: string;
  expiresAt: string;
  paymentSentAt: string | null;
  transferredAt: string | null;
  paymentReference: string | null;
}

export interface PasaloMessageView {
  id: string;
  body: string;
  createdAt: string;
  sender: "BUYER" | "SELLER" | "SYSTEM";
  mine: boolean;
}

export interface PasaloThreadView {
  listing: PasaloListingView;
  trade: PasaloTradeView;
  role: "BUYER" | "SELLER";
  payment: { channel: "GCASH" | "MAYA"; accountName: string; accountNumber: string };
  messages: PasaloMessageView[];
  hasOlder: boolean;
  bookingReference: string | null;
}

export interface PasaloDetailView {
  listing: PasaloListingView;
  isSeller: boolean;
  myTradeId: string | null;
  canClaim: boolean;
}

export interface PasaloMineView {
  selling: { listing: PasaloListingView; tradeId: string | null; conversations: PasaloTradeView[]; hasOlderConversations: boolean }[];
  buying: { listing: PasaloListingView; trade: PasaloTradeView }[];
}

export interface CreateListingInput {
  bookingId: string;
  priceCents: number;
  note?: string;
  paymentChannel: "GCASH" | "MAYA";
  paymentAccountName: string;
  paymentAccountNumber: string;
}

export interface ClaimInput { customerName: string; customerMobile: string }
