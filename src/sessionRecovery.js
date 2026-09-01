function createSessionRecovery(refreshSession, onFailure = () => {}) {
  let inFlight = null;
  return async () => {
    if (inFlight) return inFlight;
    inFlight = Promise.resolve().then(refreshSession).catch((error) => {
      onFailure(error);
      return null;
    }).finally(() => { inFlight = null; });
    return inFlight;
  };
}
export { createSessionRecovery };
