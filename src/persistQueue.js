export function createPersistQueue({ persist, rebase }) {
  let tail = Promise.resolve();
  let needsRebase = false;
  return (prev, next) => {
    const job = tail.catch(() => {}).then(async () => {
      const base = needsRebase ? await rebase() : prev;
      needsRebase = false;
      try {
        await persist(base, next);
      } catch (error) {
        needsRebase = true;
        throw error;
      }
    });
    tail = job.catch(() => {});
    return job;
  };
}

