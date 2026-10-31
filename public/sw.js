// Notification-only worker. Deliberately has no fetch, cache, or push handlers.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedUrl = new URL(event.notification.data?.url || "/dashboard", self.location.origin);
  const targetUrl = requestedUrl.origin === self.location.origin
    ? requestedUrl.href
    : new URL("/dashboard", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus().then((focused) => {
            if ("navigate" in focused && focused.url !== targetUrl) {
              return focused.navigate(targetUrl);
            }
            return focused;
          });
        }
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
