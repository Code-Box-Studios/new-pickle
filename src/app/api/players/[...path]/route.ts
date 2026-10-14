import type { NextRequest } from "next/server";
import { playerRequest } from "@/lib/players/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
export async function GET(req: NextRequest, ctx: Context) { return playerRequest(req, (await ctx.params).path); }
export async function POST(req: NextRequest, ctx: Context) { return playerRequest(req, (await ctx.params).path); }
export async function PATCH(req: NextRequest, ctx: Context) { return playerRequest(req, (await ctx.params).path); }
