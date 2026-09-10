// Requests for the same draft share a queue, including across Vite SSR module
// instances. Database compare-and-swap checks still guard other server processes.
const lockKey = Symbol.for("ti4.base-draft-mutation-locks");
const shared = globalThis as typeof globalThis & {
  [lockKey]?: Map<string, Promise<void>>;
};
const locks = (shared[lockKey] ??= new Map<string, Promise<void>>());

export async function withBaseDraftLock<T>(
  id: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(id, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (locks.get(id) === current) locks.delete(id);
  }
}
