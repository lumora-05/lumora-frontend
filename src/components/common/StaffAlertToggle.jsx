import { BellOff, BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  disableStaffAlerts,
  enableStaffAlerts,
  isStaffAlertsEnabled,
  prepareStaffAlerts,
  staffNotificationPermission,
  triggerStaffAlert,
} from '../../utils/staffAlerts';

export default function StaffAlertToggle() {
  const [enabled, setEnabled] = useState(() => isStaffAlertsEnabled());
  const [permission, setPermission] = useState(() => staffNotificationPermission());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let prepared = false;
    const prepare = () => {
      if (prepared) return;
      prepared = true;
      void prepareStaffAlerts();
      document.removeEventListener('pointerdown', prepare);
      document.removeEventListener('keydown', prepare);
    };
    document.addEventListener('pointerdown', prepare, { once: true });
    document.addEventListener('keydown', prepare, { once: true });
    return () => {
      document.removeEventListener('pointerdown', prepare);
      document.removeEventListener('keydown', prepare);
    };
  }, [enabled]);

  async function toggle() {
    if (busy) return;
    if (enabled) {
      disableStaffAlerts();
      setEnabled(false);
      return;
    }

    setBusy(true);
    try {
      const result = await enableStaffAlerts();
      setEnabled(result.enabled);
      setPermission(result.permission);
      if (result.enabled) {
        triggerStaffAlert({
          title: 'Đã bật cảnh báo Lumora',
          body: result.permission === 'granted'
            ? 'Âm thanh, rung và thông báo hệ thống đã sẵn sàng.'
            : 'Âm thanh và rung đã bật. Thông báo hệ thống đang bị trình duyệt giới hạn.',
          tag: 'lumora-alert-enabled',
        });
      }
    } finally {
      setBusy(false);
    }
  }

  const browserBlocked = permission === 'denied';
  const label = enabled ? 'Cảnh báo đang bật' : 'Bật cảnh báo';

  return (
    <button
      type="button"
      className={`staff-alert-toggle${enabled ? ' enabled' : ''}${browserBlocked ? ' browser-blocked' : ''}`}
      onClick={toggle}
      disabled={busy}
      title={browserBlocked
        ? 'Trình duyệt đang chặn thông báo hệ thống; âm thanh/rung trong ứng dụng vẫn có thể hoạt động.'
        : enabled
          ? 'Bấm để tắt âm thanh, rung và thông báo nhắc việc.'
          : 'Bật âm thanh, rung và thông báo nhắc việc cho nhân viên.'}
      aria-pressed={enabled}
    >
      {enabled ? <BellRing size={17} /> : <BellOff size={17} />}
      <span>{busy ? 'Đang bật...' : label}</span>
    </button>
  );
}
