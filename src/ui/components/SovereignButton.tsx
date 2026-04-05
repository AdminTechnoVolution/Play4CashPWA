import React from 'react';
import { IonButton, IonSpinner } from '@ionic/react';

interface SovereignButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  expand?: 'block' | 'full';
  type?: 'button' | 'submit' | 'reset';
  style?: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
}

export const SovereignPrimaryButton: React.FC<SovereignButtonProps> = ({
  onClick,
  disabled = false,
  loading = false,
  expand = 'block',
  type = 'button',
  style,
  className,
  children,
}) => {
  return (
    <IonButton
      expand={expand}
      onClick={onClick}
      disabled={disabled || loading}
      type={type}
      className={className}
      style={{
        '--background': 'var(--sovereign-gold)',
        '--background-activated': 'var(--sovereign-gold-light)',
        '--background-hover': 'var(--sovereign-gold-light)',
        '--color': '#0a1628',
        '--border-radius': '12px',
        '--box-shadow': '0 4px 16px rgba(201, 168, 76, 0.35)',
        fontWeight: '700',
        fontSize: '15px',
        letterSpacing: '0.5px',
        ...style,
      } as React.CSSProperties}
    >
      {loading ? <IonSpinner name="crescent" style={{ color: '#0a1628', width: 20, height: 20 }} /> : children}
    </IonButton>
  );
};

export const SovereignSecondaryButton: React.FC<SovereignButtonProps> = ({
  onClick,
  disabled = false,
  loading = false,
  expand = 'block',
  type = 'button',
  style,
  className,
  children,
}) => {
  return (
    <IonButton
      expand={expand}
      fill="outline"
      onClick={onClick}
      disabled={disabled || loading}
      type={type}
      className={className}
      style={{
        '--background': 'transparent',
        '--background-activated': 'rgba(201, 168, 76, 0.12)',
        '--background-hover': 'rgba(201, 168, 76, 0.08)',
        '--color': 'var(--sovereign-gold)',
        '--border-color': 'var(--sovereign-gold)',
        '--border-width': '1.5px',
        '--border-radius': '12px',
        fontWeight: '600',
        fontSize: '15px',
        letterSpacing: '0.5px',
        ...style,
      } as React.CSSProperties}
    >
      {loading ? <IonSpinner name="crescent" style={{ color: 'var(--sovereign-gold)', width: 20, height: 20 }} /> : children}
    </IonButton>
  );
};
