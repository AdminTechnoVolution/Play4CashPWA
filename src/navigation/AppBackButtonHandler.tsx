import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tryConsumePlayBack, gameSocketCodeFromPlayPath } from '../util/playBackNavigation';
import { resolveBackTarget } from './resolveBackTarget';

type IonBackButtonEvent = CustomEvent<{
  register: (priority: number, handler: (processNextHandler: () => void) => void) => void;
}>;

/**
 * Hardware / OS back: explicit React Router navigation on lobby routes.
 * Play routes defer to tryConsumePlayBack / PlayPage popstate trap.
 */
export function AppBackButtonHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onIonBack = (ev: Event) => {
      const e = ev as IonBackButtonEvent;
      e.detail.register(100, (processNextHandler) => {
        if (tryConsumePlayBack()) return;

        const pathname = location.pathname;
        if (gameSocketCodeFromPlayPath(pathname)) {
          processNextHandler();
          return;
        }

        navigate(resolveBackTarget(pathname));
      });
    };
    document.addEventListener('ionBackButton', onIonBack);
    return () => document.removeEventListener('ionBackButton', onIonBack);
  }, [location.pathname, navigate]);

  return null;
}
