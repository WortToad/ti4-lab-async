import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { appPath } from "~/utils/appUrl";

type MutationResult = {
  success: boolean;
  error?: string;
  message?: string;
  removedSelection?: unknown;
};

export function useDraftApiMutation() {
  const fetcher = useFetcher<MutationResult>();
  const pending = useRef<
    | {
        before: MutationResult | undefined;
        resolve: (result: MutationResult) => void;
      }
    | undefined
  >(undefined);

  useEffect(() => {
    if (
      fetcher.state !== "idle" ||
      !pending.current ||
      fetcher.data === pending.current.before
    )
      return;
    const request = pending.current;
    pending.current = undefined;
    request.resolve(
      fetcher.data ?? {
        success: false,
        error: "The draft could not be updated. Try again.",
      },
    );
  }, [fetcher.data, fetcher.state]);

  useEffect(
    () => () => {
      pending.current?.resolve({
        success: false,
        error: "The draft was closed before this request finished.",
      });
      pending.current = undefined;
    },
    [],
  );

  const submit = (
    path: string,
    body: Record<string, string | number>,
  ): Promise<MutationResult> => {
    if (pending.current)
      return Promise.resolve({
        success: false,
        error: "Wait for your current draft action to finish.",
      });
    return new Promise<MutationResult>((resolve) => {
      pending.current = { before: fetcher.data, resolve };
      // Router-managed mutations keep refreshes aware of pending actions and
      // revalidate through the authenticated loader before the caller resumes.
      void fetcher
        .submit(body, {
          action: appPath(path),
          method: "post",
          encType: "application/json",
        })
        .catch((error: unknown) => {
          pending.current = undefined;
          resolve({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "The draft could not be updated. Try again.",
          });
        });
    });
  };

  return { submit, busy: fetcher.state !== "idle" };
}
