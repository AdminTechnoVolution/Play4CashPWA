import { useEffect, useState } from 'react';
import { useConnectionStore } from '../../store/connectionStore';
import { useT } from '../../i18n/translations';

/**
 * Phase D: persistent top-bar shown whenever any tracked Socket.IO namespace is
 * in the `connecting`/`reconnecting` state. Disappears as soon as every socket
 * comes back online so it can't accidentally linger.
 *
 * Implementation notes:
 *  - Debounced 600 ms before appearing — avoids flashing on the brief reconnect
 *    transient that happens immediately after a normal page transition.
 *  - Pure top-fixed div instead of `IonToast` so it stacks predictably with the
 *    other PWA banners (install prompt, active-room) and is keyboard-safe.
 */
export default function ReconnectionBanner() {
  const t = useT();
  const isAnyReconnecting = useConnectionStore((s) => s.isAnyReconnecting());
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isAnyReconnecting) {
      setShow(false);
      return;
    }
    const id = window.setTimeout(() => setShow(true), 600);
    return () => window.clearTimeout(id);
  }, [isAnyReconnecting]);

  useEffect(() => {
    if (!show) return;
    // #region agent log
    const statuses = useConnectionStore.getState().statuses;
    fetch('http://127.0.0.1:7561/ingest/0b3eb4fe-aeac-4231-b94b-1592d63bdad8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'83380c'},body:JSON.stringify({sessionId:'83380c',location:'ReconnectionBanner.tsx:show',message:'banner_visible',data:{statuses,isAnyReconnecting},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
  }, [show, isAnyReconnecting]);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10001,
        padding: '8px 16px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(255,180,76,0.97) 0%, rgba(217,127,16,0.97) 100%)',
        color: '#1a1a1a',
        fontWeight: 600,
        fontSize: 14,
        letterSpacing: 0.3,
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
      }}
    >
      <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#1a1a1a', marginRight: 8, opacity: 0.6 }} />
      {t('reconnection_banner_message')}
    </div>
  );
}
