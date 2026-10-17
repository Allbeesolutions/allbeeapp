// A single owner for each realtime channel generation.  Old Supabase
// callbacks may arrive after removeChannel() resolves or a screen unmounts.
function createRealtimeReconnect({ createChannel, onReconnect, onError = () => {}, retryBaseMs = 1000, retryMaxMs = 30000 }) {
  let channel = null;
  let stopped = false;
  let timer = null;
  let attempt = 0;
  let generation = 0;

  const disconnect = (current) => {
    try {
      const pending = current?.unsubscribe?.();
      pending?.catch?.(() => {});
    } catch (error) {
      if (!stopped) onError(error);
    }
  };

  const scheduleRetry = (token) => {
    if (stopped || token !== generation || timer) return;
    const delay = Math.min(retryMaxMs, retryBaseMs * (2 ** Math.min(attempt++, 20)));
    timer = setTimeout(() => {
      timer = null;
      if (stopped || token !== generation) return;
      generation++; // Invalidate previous status callbacks before unsubscribe.
      const stale = channel;
      channel = null;
      disconnect(stale);
      connect();
    }, delay);
  };

  function connect() {
    if (stopped) return;
    const token = ++generation;
    let subscribed = false;
    const statusHandler = (status) => {
      if (stopped || token !== generation) return;
      if (status === "SUBSCRIBED") {
        // Channel recovered while a retry was pending: don't replace it.
        if (timer) clearTimeout(timer);
        timer = null;
        attempt = 0;
        if (!subscribed) onReconnect?.();
        subscribed = true;
        return;
      }
      if (!["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) return;
      subscribed = false;
      if (timer) return;
      onError(new Error(`realtime:${status}`));
      scheduleRetry(token);
    };
    try {
      const next = createChannel(statusHandler);
      if (stopped || token !== generation) {
        disconnect(next);
      } else {
        channel = next;
      }
    } catch (error) {
      onError(error);
      scheduleRetry(token);
    }
  }

  connect();
  return {
    getChannel: () => channel,
    stop: () => {
      if (stopped) return;
      stopped = true;
      generation++; // Ignore late SUBSCRIBED/CLOSED events.
      if (timer) clearTimeout(timer);
      timer = null;
      const stale = channel;
      channel = null;
      disconnect(stale);
    },
  };
}
export { createRealtimeReconnect };
