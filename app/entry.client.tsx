import { HydratedRouter } from "react-router/dom";
import { startTransition, StrictMode, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import posthog from "posthog-js";

// Initialize PostHog
function PosthogInit() {
  useEffect(() => {
    posthog.init("phc_OOxDW31RdcnDDSAj4xhjY7RVTtR053K4gVeJrMVML2H", {
      api_host: "https://us.i.posthog.com",
      person_profiles: "identified_only", // or 'always' to create profiles for anonymous users as well
      session_recording: {
        maskNetworkRequestFn: (request) =>
          /\/draft\/bag\//.test(request.url) ? null : request,
      },
      before_send: (event) => {
        // Private draft URLs and card selections must never enter analytics.
        if (/^\/draft\/bag\//.test(window.location.pathname)) return null;
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

  return null;
}
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
      <PosthogInit />
    </StrictMode>,
  );
});
