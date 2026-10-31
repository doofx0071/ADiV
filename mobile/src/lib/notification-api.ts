export function configureNotificationHandler() {}

export function subscribeToMaintenanceNotification(_onOpen: () => void) {
  void _onOpen;
  return { remove() {} };
}
