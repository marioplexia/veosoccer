import { describe, expect, it } from "vitest";
import { livekitConfig, rtmpTarget } from "./livekit-server";

describe("rtmpTarget", () => {
  it("une servidor y clave con una sola barra", () => {
    expect(rtmpTarget("rtmps://live-api-s.facebook.com:443/rtmp/", "FB-123-abc")).toBe("rtmps://live-api-s.facebook.com:443/rtmp/FB-123-abc");
    expect(rtmpTarget("rtmps://live-api-s.facebook.com:443/rtmp", "FB-123-abc")).toBe("rtmps://live-api-s.facebook.com:443/rtmp/FB-123-abc");
  });
});

describe("livekitConfig", () => {
  it("sin variables de entorno devuelve null (modo ensayo)", () => {
    const old = { ...process.env };
    delete process.env.LIVEKIT_URL; delete process.env.LIVEKIT_API_KEY; delete process.env.LIVEKIT_API_SECRET;
    expect(livekitConfig()).toBeNull();
    process.env = old;
  });
  it("convierte wss a https para la API del servidor", () => {
    const old = { ...process.env };
    process.env.LIVEKIT_URL = "wss://demo.livekit.cloud"; process.env.LIVEKIT_API_KEY = "k"; process.env.LIVEKIT_API_SECRET = "s";
    expect(livekitConfig()?.httpUrl).toBe("https://demo.livekit.cloud");
    process.env = old;
  });
});
