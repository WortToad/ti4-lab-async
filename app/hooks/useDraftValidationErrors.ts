import { useMemo } from "react";
import { useDraft } from "~/draftStore";
import { getDraftValidationErrors } from "~/utils/draftValidation";

export function useDraftValidationErrors() {
  const draft = useDraft((state) => state.draft);
  return useMemo(() => getDraftValidationErrors(draft), [draft]);
}
