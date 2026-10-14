import type { NextRequest } from "next/server";
import { readPasalo, mutatePasalo } from "@/lib/pasalo/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
export async function GET(req: NextRequest, ctx: Context) { return readPasalo(req, (await ctx.params).path); }
export async function POST(req: NextRequest, ctx: Context) { return mutatePasalo(req, (await ctx.params).path); }
