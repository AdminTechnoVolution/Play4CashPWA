import { useEffect } from 'react';
import { tryConsumePlayBack } from '../util/playBackNavigation';

type IonBackButtonEvent = CustomEvent<{
  register: (priority: number, handler: (processNextHandler: () => void) => void) => void;
}>;

/**
 * Registers a high-priority hardware/header back handler inside React Router context.
 * Delegates to IonBackButton (via processNextHandler) so defaultHref works on lobby pages.
 * Play screens consume back first (modals, forfeit flow) via tryConsumePlayBack().
 */
export function AppBackButtonHandler() {
  useEffect(() => {
    const onIonBack = (ev: Event) => {
      const e = ev as IonBackButtonEvent;
      e.detail.register(100, (processNextHandler) => {
        if (tryConsumePlayBack()) return;
        processNextHandler();
      });
    };
    document.addEventListener('ionBackButton', onIonBack);
    return () => document.removeEventListener('ionBackButton', onIonBack);
  }, []);

  return null;
}
