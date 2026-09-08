import { describe, it, expect } from "vitest";
import { pickLanAddresses, portFromHost } from "@/lib/dev/lan-address";
import type { NetworkInterfaceInfo } from "node:os";

// Minimal factory for a network interface entry.
function ip(address: string, extra: Partial<NetworkInterfaceInfo> = {}): NetworkInterfaceInfo {
  return {
    address,
    netmask: "255.255.255.0",
    family: "IPv4",
    mac: "00:00:00:00:00:00",
    internal: false,
    cidr: `${address}/24`,
    ...extra,
  } as NetworkInterfaceInfo;
}

describe("pickLanAddresses", () => {
  it("picks the Wi-Fi IPv4 and skips virtual, loopback and link-local", () => {
    const ifaces = {
      "Loopback Pseudo-Interface 1": [ip("127.0.0.1", { internal: true })],
      "vEthernet (WSL)": [ip("172.26.48.1")],
      // IPv6 entry (no cast): Partial<NetworkInterfaceInfo> keeps `family` as "IPv4" | "IPv6",
      // so a wrong value would fail to type-check here — it must be dropped by the IPv4-only filter.
      "Wi-Fi": [ip("172.16.14.20"), ip("fe80::1", { family: "IPv6" })],
      "Ethernet 2": [ip("169.254.10.10")],
    };
    const { chosen, candidates } = pickLanAddresses(ifaces, "3000");
    expect(chosen).toEqual({ iface: "Wi-Fi", address: "172.16.14.20", url: "http://172.16.14.20:3000" });
    // only the real Wi-Fi address survives filtering
    expect(candidates.map((c) => c.address)).toEqual(["172.16.14.20"]);
  });

  it("ranks Wi-Fi ahead of Ethernet when both are present", () => {
    const ifaces = {
      Ethernet: [ip("10.0.0.5")],
      "Wi-Fi": [ip("192.168.1.50")],
    };
    const { chosen, candidates } = pickLanAddresses(ifaces, "3000");
    expect(chosen?.address).toBe("192.168.1.50");
    expect(candidates.map((c) => c.address)).toEqual(["192.168.1.50", "10.0.0.5"]);
  });

  it("returns chosen:null when no usable interface exists", () => {
    const ifaces = {
      "Loopback Pseudo-Interface 1": [ip("127.0.0.1", { internal: true })],
      // RFC-1918 addr — would pass IP filters; only excluded by the VIRTUAL name match.
      "vEthernet (WSL)": [ip("172.26.48.1")],
    };
    expect(pickLanAddresses(ifaces, "3000")).toEqual({ chosen: null, candidates: [] });
  });
});

describe("portFromHost", () => {
  it("extracts the port from a host header", () => {
    expect(portFromHost("172.16.14.20:3000")).toBe("3000");
  });
  it("falls back when no port present", () => {
    expect(portFromHost("localhost")).toBe("3000");
    expect(portFromHost(null)).toBe("3000");
    expect(portFromHost("localhost", "8080")).toBe("8080");
  });
});
