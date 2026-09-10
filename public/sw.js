self.addEventListener('push', (event) => {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: new URL('favicon-32x32.png', self.registration.scope).href,
      badge: new URL('favicon-32x32.png', self.registration.scope).href
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  });
