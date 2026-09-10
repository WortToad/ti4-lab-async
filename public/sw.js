self.addEventListener('push', (event) => {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: new URL('ti4toad.png', self.registration.scope).href,
      badge: new URL('ti4toad.png', self.registration.scope).href
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  });
