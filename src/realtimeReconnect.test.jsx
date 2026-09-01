import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRealtimeReconnect } from "./realtimeReconnect.js";

describe("createRealtimeReconnect", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reconnects with exponential backoff after a channel error", () => {
    const channels = [];
    const create = vi.fn((status) => { const ch = { status, unsubscribe: vi.fn() }; channels.push(ch); return ch; });
    const reconnect = createRealtimeReconnect({ createChannel: create, retryBaseMs: 100, retryMaxMs: 500 });
    expect(create).toHaveBeenCalledTimes(1);
    channels[0].status("CHANNEL_ERROR");
    vi.advanceTimersByTime(99); expect(create).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1); expect(create).toHaveBeenCalledTimes(2);
    channels[1].status("TIMED_OUT");
    vi.advanceTimersByTime(199); expect(create).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1); expect(create).toHaveBeenCalledTimes(3);
    reconnect.stop();
  });

  it("resets backoff after a successful reconnect and stops cleanly", () => {
    const channels = [];
    const create = vi.fn((status) => { const ch = { status, unsubscribe: vi.fn() }; channels.push(ch); return ch; });
    const onReconnect = vi.fn();
    const reconnect = createRealtimeReconnect({ createChannel: create, onReconnect, retryBaseMs: 100 });
    channels[0].status("CHANNEL_ERROR");
    vi.advanceTimersByTime(100);
    channels[1].status("SUBSCRIBED");
    expect(onReconnect).toHaveBeenCalledTimes(1);
    channels[1].status("CHANNEL_ERROR");
    vi.advanceTimersByTime(100);
    expect(create).toHaveBeenCalledTimes(3);
    reconnect.stop();
    channels[2].status("CHANNEL_ERROR");
    vi.runAllTimers();
    expect(create).toHaveBeenCalledTimes(3);
    expect(channels[2].unsubscribe).toHaveBeenCalledTimes(1);
  });
});
