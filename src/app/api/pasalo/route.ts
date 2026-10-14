import type { NextRequest } from "next/server";
import { readPasalo, mutatePasalo } from "@/lib/pasalo/http";
export const runtime = "nodejs";
export async function GET(req: NextRequest) { return readPasalo(req); }
export async function POST(req: NextRequest) { return mutatePasalo(req); }
