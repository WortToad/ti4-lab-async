self.addEventListener("push", (event) => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: new URL("brand/ti4-draft-command.png", self.registration.scope).href,
    badge: new URL("brand/ti4-draft-command.png", self.registration.scope).href,
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || self.registration.scope,
    self.registration.scope,
  );
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find((client) => client.url === target.href);
      if (existing) return existing.focus();
      return self.clients.openWindow(target.href);
    })(),
  );
});
