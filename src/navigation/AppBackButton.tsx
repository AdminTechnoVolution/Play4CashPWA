import { IonButton, IonIcon } from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';

type AppBackButtonProps = {
  to: string;
  color?: string;
};

/**
 * SPA-safe back control. Avoids a document-level navigation that can reload the app unexpectedly.
 */
export function AppBackButton({ to, color = 'var(--sovereign-gold)' }: AppBackButtonProps) {
  const navigate = useNavigate();

  return (
    <IonButton
      fill="clear"
      onClick={() => navigate(to)}
      aria-label="Back"
      style={{ '--color': color } as React.CSSProperties}
    >
      <IonIcon icon={arrowBackOutline} slot="icon-only" style={{ color }} />
    </IonButton>
  );
}
