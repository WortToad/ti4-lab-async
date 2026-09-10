self.addEventListener('push', (event) => {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: new URL('icon.png?v=3', self.registration.scope).href,
      badge: new URL('badge.png?v=3', self.registration.scope).href
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  });
