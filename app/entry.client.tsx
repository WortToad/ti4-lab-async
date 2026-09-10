import { HydratedRouter } from "react-router/dom";
import { startTransition, StrictMode, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import posthog from "posthog-js";

// Keep the router as the only rendered child, matching the server tree so
// React useId values (including Mantine responsive selectors) hydrate correctly.
function ClientApp() {
  useEffect(() => {
    const key = import.meta.env.VITE_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, {
      api_host: "https://us.i.posthog.com",
      person_profiles: "identified_only", // or 'always' to create profiles for anonymous users as well
      session_recording: {
        maskNetworkRequestFn: (request) =>
          /\/draft\/bag\//.test(request.url) ? null : request,
      },
      before_send: (event) => {
        // Private draft URLs and card selections must never enter analytics.
        if (/\/draft\/bag\//.test(window.location.pathname)) return null;
        if (
          event?.properties &&
          Object.values(event.properties).some(
            (value) =>
              typeof value === "string" && /\/draft\/bag\//.test(value),
          )
        )
          return null;
        return event;
      },
    });
  }, []);

  return <HydratedRouter />;
}
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <ClientApp />
    </StrictMode>,
  );
});
