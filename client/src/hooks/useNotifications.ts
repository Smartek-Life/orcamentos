import { useCallback, useState } from 'react';

export type NotificationTone = 'info' | 'success' | 'error';

export interface AppNotification {
  id: string;
  tone: NotificationTone;
  message: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const pushNotification = useCallback((tone: NotificationTone, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setNotifications((current) => [...current, { id, tone, message }]);

    window.setTimeout(() => {
      setNotifications((current) => current.filter((notification) => notification.id !== id));
    }, 4800);
  }, []);

  return {
    notifications,
    dismissNotification,
    pushNotification,
  };
}
