/** Keep a delayed background read from replacing a newer mutation revalidation. */
export function createOrderedLoader<T>() {
  let nextOrder = 0;
  type Outcome = { order: number } & ({ value: T } | { error: unknown });
  const latest = new Map<string, Outcome>();
  return async (scope: string, read: () => Promise<T>): Promise<T> => {
    const order = ++nextOrder;
    let outcome: Outcome;
    try {
      outcome = { order, value: await read() };
    } catch (error) {
      outcome = {
        order,
        error: error instanceof Response ? error.clone() : error,
      };
    }
    const previous = latest.get(scope);
    if (previous && previous.order > order) outcome = previous;
    else {
      latest.delete(scope);
      latest.set(scope, outcome);
      if (latest.size > 10) latest.delete(latest.keys().next().value!);
    }
    if ("error" in outcome)
      throw outcome.error instanceof Response
        ? outcome.error.clone()
        : outcome.error;
    return outcome.value;
  };
}
