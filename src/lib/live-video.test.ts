import { describe, expect, it } from "vitest";
import { FrameRing, SegmentUploader, replayDurationMs, replayFrameIndex, baseMime, extOf } from "./live-video";

const blob = {} as Blob;

describe("FrameRing", () => {
  it("conserva solo los últimos segundos y devuelve ventanas en orden", () => {
    const r = new FrameRing(10_000);
    for (let t = 0; t <= 30_000; t += 1000) r.push({ t, blob });
    expect(r.size).toBe(11);
    expect(r.window(25_000, 28_000).map((f) => f.t)).toEqual([25_000, 26_000, 27_000, 28_000]);
    expect(r.window(0, 5000)).toEqual([]);
    r.clear(); expect(r.size).toBe(0);
  });
});

describe("repetición", () => {
  const times = [1000, 1100, 1200, 1300, 1400];
  it("avanza por los cuadros a la velocidad indicada y termina", () => {
    expect(replayFrameIndex(times, 0, 1)).toBe(0);
    expect(replayFrameIndex(times, 250, 1)).toBe(2);
    expect(replayFrameIndex(times, 250, 0.5)).toBe(1);
    expect(replayFrameIndex(times, 400, 1)).toBe(4);
    expect(replayFrameIndex(times, 401, 1)).toBe(-1);
    expect(replayFrameIndex([], 0, 1)).toBe(-1);
    expect(replayDurationMs(times, 0.5)).toBe(800);
    expect(replayDurationMs([5], 1)).toBe(0);
  });
});

describe("SegmentUploader", () => {
  const seg = (idx: number) => ({ idx, blob, durationMs: 1000 });
  it("sube en orden y reintenta sin perder segmentos", async () => {
    const done: number[] = [];
    let failures = 2;
    const up = new SegmentUploader(async (s) => { if (s.idx === 1 && failures-- > 0) return false; done.push(s.idx); return true; }, undefined, () => 0);
    up.add(seg(0)); up.add(seg(1)); up.add(seg(2));
    expect(await up.flush()).toBe(true);
    expect(done).toEqual([0, 1, 2]);
    expect(up.uploaded).toBe(3);
  });
  it("si la subida sigue fallando, lo pendiente se queda en la cola y se puede reintentar", async () => {
    let online = false;
    const done: number[] = [];
    const up = new SegmentUploader(async (s) => { if (!online) throw new Error("sin red"); done.push(s.idx); return true; }, undefined, () => 0);
    up.add(seg(0)); up.add(seg(1));
    expect(await up.flush(2)).toBe(false);
    expect(up.pending).toBe(2);
    expect(up.failedOnce).toBe(true);
    online = true;
    expect(await up.flush()).toBe(true);
    expect(done).toEqual([0, 1]);
  });
});

describe("tipos de video", () => {
  it("normaliza el tipo y la extensión", () => {
    expect(baseMime("video/mp4;codecs=avc1")).toBe("video/mp4");
    expect(baseMime("video/webm;codecs=vp9,opus")).toBe("video/webm");
    expect(extOf("video/mp4")).toBe("mp4");
    expect(extOf("video/webm;codecs=vp8")).toBe("webm");
  });
});
