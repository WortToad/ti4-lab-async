import { useFetcher, useNavigate } from "react-router";
import { useRef, useState } from "react";
import { Draft } from "~/types";
import { appPath } from "~/utils/appUrl";

export type DraftInput = Omit<Draft, "pickOrder"> & {
  presetUrl?: string;
};

export function useCreateDraft() {
  const fetcher = useFetcher();
  return (input: DraftInput) => {
    fetcher.submit(input, {
      method: "POST",
      encType: "application/json",
      action: "/draft/new",
    });
  };
}

export function useCreateDraftPreview(onCreated: () => void) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const pending = useRef(false);

  const createDraft = async (input: DraftInput) => {
    if (pending.current) return;
    pending.current = true;
    setCreating(true);
    setError(undefined);
    try {
      const response = await fetch(appPath("/api/draft/create"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Draft-Response": "json",
        },
        body: JSON.stringify(input),
      });
      const result = await response.json().catch(() => ({
        error:
          "Unable to create the lobby. Your preview is saved; please try again.",
      }));
      if (!response.ok || typeof result.url !== "string") {
        throw new Error(
          result.error ||
            "Unable to create the lobby. Your preview is saved; please try again.",
        );
      }
      onCreated();
      navigate(result.url);
    } catch (failure) {
      setError(
        failure instanceof Error && failure.message !== "Failed to fetch"
          ? failure.message
          : "Unable to create the lobby. Check your connection and try again; your preview is saved.",
      );
    } finally {
      pending.current = false;
      setCreating(false);
    }
  };
  return { createDraft, creating, error };
}
