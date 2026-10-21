import { describe, expect, it, vi } from "vitest";
import { startUnreadNotificationPolling } from "./notificationPolling.js";

function setup(fetchCount, onCount = vi.fn()) {
  const handlers = new Map();
  const documentRef = {
    visibilityState: "visible",
    addEventListener: vi.fn((name, cb) => handlers.set(name, cb)),
    removeEventListener: vi.fn((name, cb) => { if (handlers.get(name) === cb) handlers.delete(name); }),
  };
  let tick;
  const setIntervalFn = vi.fn(fn => { tick = fn; return 73; });
  const clearIntervalFn = vi.fn();
  const stop = startUnreadNotificationPolling({fetchCount,onCount,documentRef,setIntervalFn,clearIntervalFn});
  const drain = async () => { for(let i=0;i<6;i++) await Promise.resolve(); };
  return { documentRef,handlers,get tick(){return tick;},onCount,fetchCount,setIntervalFn,clearIntervalFn,stop,drain };
}

describe("unread notification polling", () => {
  it("retains last count after a failed RPC and retries when visible", async () => {
    const fetchCount=vi.fn().mockResolvedValueOnce({data:4,error:null})
      .mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({data:6,error:null});
    const h=setup(fetchCount);
    await h.drain();
    expect(h.onCount).toHaveBeenLastCalledWith(4);
    h.documentRef.visibilityState="hidden";
    h.tick();
    await h.drain();
    expect(fetchCount).toHaveBeenCalledTimes(1);
    h.documentRef.visibilityState="visible";
    h.handlers.get("visibilitychange")();
    await h.drain();
    expect(h.onCount).toHaveBeenCalledTimes(1);
    h.tick();
    await h.drain();
    expect(h.onCount).toHaveBeenLastCalledWith(6);
    h.stop();
    expect(h.clearIntervalFn).toHaveBeenCalledWith(73);
    expect(h.documentRef.removeEventListener).toHaveBeenCalledWith("visibilitychange",expect.any(Function));
  });

  it("coalesces overlapping count reads and ignores responses after cleanup", async () => {
    let resolve;
    const fetchCount=vi.fn().mockImplementation(()=>new Promise(done=>{resolve=done}));
    const h=setup(fetchCount);
    await h.drain();
    h.tick();h.tick();
    h.handlers.get("visibilitychange")();
    await h.drain();
    expect(fetchCount).toHaveBeenCalledTimes(1);
    h.stop();
    resolve({data:999,error:null});
    await h.drain();
    expect(h.onCount).not.toHaveBeenCalled();
  });

  it("never replaces a valid unread count with an error or invalid number", async () => {
    const fetchCount=vi.fn().mockResolvedValueOnce({data:3,error:null})
      .mockResolvedValueOnce({data:12,error:{message:"permission denied"}})
      .mockResolvedValueOnce({data:NaN,error:null});
    const h=setup(fetchCount);
    await h.drain();
    h.tick();await h.drain();
    h.tick();await h.drain();
    expect(h.onCount).toHaveBeenCalledTimes(1);
    expect(h.onCount).toHaveBeenCalledWith(3);
    h.stop();
  });
});
