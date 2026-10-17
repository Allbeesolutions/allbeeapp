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

  it("ignores callbacks from obsolete or stopped channel generations", () => {
    const channels = [];
    const create = vi.fn((status) => {
      const ch = { status, unsubscribe: vi.fn(() => { status("CLOSED"); }) };
      channels.push(ch);
      return ch;
    });
    const onReconnect = vi.fn();
    const onError = vi.fn();
    const reconnect = createRealtimeReconnect({ createChannel: create, onReconnect, onError, retryBaseMs: 100 });
    channels[0].status("CHANNEL_ERROR");
    vi.advanceTimersByTime(100);
    expect(create).toHaveBeenCalledTimes(2);
    channels[0].status("SUBSCRIBED");
    channels[0].status("CLOSED");
    expect(onReconnect).toHaveBeenCalledTimes(0);
    expect(onError).toHaveBeenCalledTimes(1);
    channels[1].status("SUBSCRIBED");
    channels[1].status("SUBSCRIBED");
    expect(onReconnect).toHaveBeenCalledTimes(1);
    reconnect.stop();
    reconnect.stop();
    channels[1].status("CLOSED");
    channels[1].status("SUBSCRIBED");
    vi.runAllTimers();
    expect(create).toHaveBeenCalledTimes(2);
    expect(onReconnect).toHaveBeenCalledTimes(1);
    expect(channels[1].unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("cancels an upcoming retry when the active channel recovers", () => {
    const channels = [];
    const create = vi.fn((status) => {
      const ch = { status, unsubscribe: vi.fn() };
      channels.push(ch);
      return ch;
    });
    const onReconnect = vi.fn();
    const reconnect = createRealtimeReconnect({ createChannel: create, onReconnect, retryBaseMs: 100 });
    channels[0].status("CHANNEL_ERROR");
    vi.advanceTimersByTime(50);
    channels[0].status("SUBSCRIBED");
    vi.advanceTimersByTime(500);
    expect(create).toHaveBeenCalledTimes(1);
    expect(onReconnect).toHaveBeenCalledTimes(1);
    channels[0].status("TIMED_OUT");
    vi.advanceTimersByTime(100);
    expect(create).toHaveBeenCalledTimes(2);
    reconnect.stop();
  });

  it("retries a failed initial channel creation without crashing the workspace", () => {
    const onError = vi.fn();
    const create = vi.fn().mockImplementationOnce(() => { throw new Error("Realtime unavailable"); })
      .mockImplementation((status) => ({ status, unsubscribe: vi.fn() }));
    const reconnect = createRealtimeReconnect({ createChannel: create, onError, retryBaseMs: 100 });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(create).toHaveBeenCalledTimes(2);
    expect(reconnect.getChannel()).toBeTruthy();
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
