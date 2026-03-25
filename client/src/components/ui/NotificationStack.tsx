import type { AppNotification } from '../../hooks/useNotifications';

interface NotificationStackProps {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
}

const toneClasses: Record<AppNotification['tone'], string> = {
  info: 'border-slate-200 bg-white text-slateink',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
};

export function NotificationStack({ notifications, onDismiss }: NotificationStackProps) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-50 flex w-full max-w-sm flex-col gap-3">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={[
            'pointer-events-auto rounded-2xl border px-4 py-3 shadow-soft',
            toneClasses[notification.tone],
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-4">
            <p className="whitespace-pre-line text-sm leading-6">{notification.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(notification.id)}
              className="rounded-full px-2 py-1 text-xs font-semibold text-current/70 transition hover:bg-black/5 hover:text-current"
            >
              Fechar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
