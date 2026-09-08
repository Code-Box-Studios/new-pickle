import type { NetworkInterfaceInfo } from "node:os";

export interface LanCandidate {
  iface: string;
  address: string;
  url: string;
}

// Interface-name fragments we never advertise (virtual adapters / loopback).
// `/loopback/i` intentionally duplicates the per-address `internal` guard below:
// it drops the whole adapter by name, independent of any per-entry `internal` flag.
const VIRTUAL = [/vethernet/i, /\bwsl\b/i, /hyper-?v/i, /virtualbox/i, /vmware/i, /loopback/i, /docker/i];

// Higher = preferred. Physical wireless first, then wired, then anything else.
function rank(iface: string): number {
  if (/wi-?fi|wireless|wlan/i.test(iface)) return 2;
  if (/ethernet|\ben\b|\beth\b/i.test(iface)) return 1;
  return 0;
}

export function pickLanAddresses(
  ifaces: Record<string, NetworkInterfaceInfo[] | undefined>,
  port: string,
): { chosen: LanCandidate | null; candidates: LanCandidate[] } {
  const candidates: LanCandidate[] = [];

  for (const [iface, addrs] of Object.entries(ifaces)) {
    if (!addrs || VIRTUAL.some((re) => re.test(iface))) continue;
    for (const a of addrs) {
      if (a.family !== "IPv4" || a.internal) continue;
      if (a.address.startsWith("169.254.")) continue; // link-local
      candidates.push({ iface, address: a.address, url: `http://${a.address}:${port}` });
    }
  }

  candidates.sort((a, b) => rank(b.iface) - rank(a.iface));
  return { chosen: candidates[0] ?? null, candidates };
}

export function portFromHost(host: string | null, fallback = "3000"): string {
  if (!host) return fallback;
  const idx = host.lastIndexOf(":");
  if (idx === -1) return fallback;
  const port = host.slice(idx + 1);
  return /^\d+$/.test(port) ? port : fallback;
}
