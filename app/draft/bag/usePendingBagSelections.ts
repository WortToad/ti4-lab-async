import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { BagDraftView } from "./types";
import {
  defaultBagSelection,
  getBagSelectionConfig,
  restorePendingBagSelection,
  serializePendingBagSelection,
  type BagSelectionConfig,
} from "./pendingSelections";

type Selection = {
  scope: string | undefined;
  context: string;
  owner: string;
  ids: string[];
};

export function usePendingBagSelections(
  view: BagDraftView,
): [string[], Dispatch<SetStateAction<string[]>>] {
  const config = getBagSelectionConfig(view);
  const context = JSON.stringify(config);
  const scope = config
    ? `${view.id}:${view.privateSeat!.id}:${view.lobby.ownUuid}`
    : undefined;
  const storageKey = `ti4:pending-bag-selection:${view.id}`;
  const [selection, setSelection] = useState<Selection>();
  const current = selection?.context === context && selection.scope === scope;
  const defaults = config
    ? defaultBagSelection(config)
    : (view.privateSeat?.keptItemIds ?? []);

  useEffect(() => {
    let cancelled = false;
    if (!scope) {
      setSelection(undefined);
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {
        /* Storage may be disabled. */
      }
      return;
    }
    const activeConfig = JSON.parse(context) as BagSelectionConfig;
    void (async () => {
      let owner = "";
      let ids = defaultBagSelection(activeConfig);
      try {
        // Bind saved choices to the current recovery identity without storing its credential.
        const digest = await window.crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(scope),
        );
        owner = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");
        if (cancelled) return;
        ids = restorePendingBagSelection(
          window.sessionStorage.getItem(storageKey),
          owner,
          activeConfig,
        );
      } catch {
        // Continue with in-memory selections when browser storage is unavailable.
      }
      if (!cancelled)
        setSelection((previous) => ({
          scope,
          context,
          owner,
          ids:
            previous?.scope === scope && previous.context === context
              ? previous.ids
              : ids,
        }));
    })();
    return () => {
      cancelled = true;
    };
  }, [context, scope, storageKey]);

  useEffect(() => {
    if (!current || !selection.owner || !scope) return;
    try {
      window.sessionStorage.setItem(
        storageKey,
        serializePendingBagSelection(
          selection.owner,
          JSON.parse(context) as BagSelectionConfig,
          selection.ids,
        ),
      );
    } catch {
      /* Keep drafting if this tab cannot save selections. */
    }
  }, [context, current, scope, selection, storageKey]);

  return [
    current ? selection.ids : defaults,
    (update) => {
      setSelection((previous) => {
        const existing =
          previous?.context === context && previous.scope === scope;
        const ids = existing ? previous.ids : defaults;
        return {
          scope,
          context,
          owner: existing ? previous.owner : "",
          ids: typeof update === "function" ? update(ids) : update,
        };
      });
    },
  ];
}
