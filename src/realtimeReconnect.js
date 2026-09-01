function createRealtimeReconnect({ createChannel, onReconnect, onError = () => {}, retryBaseMs = 1000, retryMaxMs = 30000 }) {
  let channel = null;
  let stopped = false;
  let timer = null;
  let attempt = 0;
  const connect = () => {
    if (stopped) return;
    channel = createChannel((status) => {
      if (status === "SUBSCRIBED") {
        attempt = 0;
        onReconnect?.();
        return;
      }
      if (!["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) return;
      onError?.(new Error(`realtime:${status}`));
      if (stopped || timer) return;
      const delay = Math.min(retryMaxMs, retryBaseMs * (2 ** attempt++));
      const failed = channel;
      timer = setTimeout(() => {
        timer = null;
        failed?.unsubscribe?.();
        connect();
      }, delay);
    });
  };
  connect();
  return {
    getChannel: () => channel,
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      channel?.unsubscribe?.();
    },
  };
}
export { createRealtimeReconnect };
