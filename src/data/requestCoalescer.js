// Reuse an in-flight read for the same table scope, even when other scopes
// started between two callers. Settled promises are removed before a refresh.
export function coalesceRequest(inFlight, key, create) {
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = Promise.resolve().then(create);
  inFlight.set(key, request);
  request.finally(() => {
    if (inFlight.get(key) === request) inFlight.delete(key);
  }).catch(() => {});
  return request;
}
