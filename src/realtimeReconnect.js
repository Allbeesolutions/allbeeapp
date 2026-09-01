function createRealtimeReconnect({ createChannel, onReconnect, onError = () => {}, retryBaseMs = 1000, retryMaxMs = 30000 }) {
  let channel = null;
  let stopped = false;
  let timer = null;
  let attempt = 0;
  const connect = () => {
    if (stopped) return;
    channel = createChannel(() => {
      attempt = 0;
      onReconnect?.();
    }, (error) => {
      onError?.(error);
      if (stopped || timer) return;
      const delay = Math.min(retryMaxMs, retryBaseMs * (2 ** attempt++));
      timer = setTimeout(() => { timer = null; connect(); }, delay);
    });
  };
  connect();
  return { getChannel: () => channel, stop: () => { stopped = true; if (timer) clearTimeout(timer); timer = null; channel?.unsubscribe?.(); } };
}
export { createRealtimeReconnect };
