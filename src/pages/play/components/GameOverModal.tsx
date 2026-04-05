import React from 'react';
import { IonModal, IonContent } from '@ionic/react';
import { SovereignPrimaryButton, SovereignSecondaryButton } from '../../../ui/components/SovereignButton';
import type { GameOverPayload } from '../../../data/models/ApiModels';
import { useT } from '../../../i18n/translations';

interface GameOverModalProps {
  isOpen: boolean;
  gameOver: GameOverPayload | null;
  onPlayAgain: () => void;
  onExit: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({ isOpen, gameOver, onPlayAgain, onExit }) => {
  const t = useT();
  if (!gameOver) return null;

  const isWin = gameOver.youWon;
  const isDraw = gameOver.isDraw;

  const icon = isWin ? '🏆' : isDraw ? '🤝' : '💔';
  const title = isWin ? t('APP.GAME.GAME_OVER_WIN') : isDraw ? t('APP.GAME.GAME_OVER_DRAW') : t('APP.GAME.GAME_OVER_LOSE');
  const titleColor = isWin
    ? 'var(--sovereign-gold)'
    : isDraw
      ? '#8a9bbf'
      : '#cf6679';

  const reasonLabel: Record<string, string> = {
    checkmate: t('APP.GAME.REASON_CHECKMATE'),
    stalemate: t('APP.GAME.REASON_STALEMATE'),
    timeout: t('APP.GAME.REASON_TIMEOUT'),
    forfeit: t('APP.GAME.REASON_FORFEIT'),
    all_sunk: 'All ships sunk',
    blocked: 'No moves available',
    resigned: t('APP.GAME.REASON_RESIGN'),
  };
  const reasonText = gameOver.reason
    ? (reasonLabel[gameOver.reason] ?? gameOver.reason)
    : null;

  return (
    <IonModal
      isOpen={isOpen}
      backdropDismiss={false}
      style={{ '--background': 'rgba(10,22,40,0.95)', '--border-radius': '0' }}
    >
      <IonContent
        style={{ '--background': 'transparent' }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100%',
            padding: '40px 24px',
            textAlign: 'center',
          }}
        >
          {/* Icon */}
          <div
            style={{
              fontSize: 80,
              marginBottom: 16,
              filter: isWin ? 'drop-shadow(0 0 24px rgba(201,168,76,0.6))' : 'none',
              animation: isWin ? 'pulse 2s ease-in-out infinite' : 'none',
            }}
          >
            {icon}
          </div>

          {/* Title */}
          <h1
            style={{
              color: titleColor,
              fontSize: 36,
              fontWeight: 800,
              margin: '0 0 8px',
              letterSpacing: 1,
            }}
          >
            {title}
          </h1>

          {/* Reason */}
          {reasonText && (
            <p
              style={{
                color: 'var(--sovereign-text-muted)',
                fontSize: 16,
                margin: '0 0 24px',
                fontWeight: 500,
              }}
            >
              {reasonText}
            </p>
          )}

          {/* Prize */}
          {isWin && gameOver.prize != null && gameOver.prize > 0 && (
            <div
              style={{
                background: 'rgba(201,168,76,0.12)',
                border: '1.5px solid var(--sovereign-gold)',
                borderRadius: 16,
                padding: '12px 32px',
                marginBottom: 32,
              }}
            >
              <p style={{ color: 'var(--sovereign-text-muted)', fontSize: 12, margin: '0 0 2px' }}>
                {t('APP.GAME.PRIZE')}
              </p>
              <p
                style={{
                  color: 'var(--sovereign-gold)',
                  fontSize: 28,
                  fontWeight: 800,
                  margin: 0,
                }}
              >
                ${gameOver.prize.toFixed(2)}
              </p>
            </div>
          )}

          {!isWin && !isDraw && (
            <div style={{ marginBottom: 32 }}>
              <p style={{ color: 'var(--sovereign-text-muted)', fontSize: 14, margin: 0 }}>
                Better luck next time!
              </p>
            </div>
          )}

          {isDraw && (
            <div style={{ marginBottom: 32 }}>
              <p style={{ color: 'var(--sovereign-text-muted)', fontSize: 14, margin: 0 }}>
                It's a tie — no one wins this round.
              </p>
            </div>
          )}

          {/* Buttons */}
          <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SovereignPrimaryButton onClick={onPlayAgain}>
              {t('APP.GAME.PLAY_AGAIN')}
            </SovereignPrimaryButton>
            <SovereignSecondaryButton onClick={onExit}>
              {t('APP.GAME.EXIT')}
            </SovereignSecondaryButton>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};

export default GameOverModal;
