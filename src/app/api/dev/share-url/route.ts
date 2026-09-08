import os from "node:os";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { pickLanAddresses, portFromHost, type LanCandidate } from "@/lib/dev/lan-address";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

// Dev-only: surface the machine's LAN URL as a QR so a phone on the same Wi-Fi
// can open the running dev app. 404s in production.
export async function GET(req: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const port = portFromHost(req.headers.get("host"));
    const { chosen, candidates } = pickLanAddresses(os.networkInterfaces(), port);

    if (!chosen) {
      return NextResponse.json({
        url: null,
        qrDataUrl: null,
        candidates: [],
        error: "No LAN interface found — are you on Wi-Fi?",
      });
    }

    const withQr = await Promise.all(
      candidates.map(async (c: LanCandidate) => ({ ...c, qrDataUrl: await QRCode.toDataURL(c.url) })),
    );
    const chosenQr = withQr.find((c) => c.address === chosen.address)!;

    return NextResponse.json({ url: chosenQr.url, qrDataUrl: chosenQr.qrDataUrl, candidates: withQr });
  } catch (e) {
    return errorResponse(e);
  }
}
