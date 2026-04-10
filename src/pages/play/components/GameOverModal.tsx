import React from 'react';
import { IonModal } from '@ionic/react';
import { SovereignPrimaryButton, SovereignSecondaryButton } from '../../../ui/components/SovereignButton';
import type { GameOverPayload } from '../../../data/models/ApiModels';
import { useT } from '../../../i18n/translations';
import { 
  resolveGameEndFallbackMessage, 
  playerGameEndReasonFallback, 
  PlayerGameEndReasonProfile,
  GameEndMessageKeys,
  applyWsMessagePlaceholders
} from '../../../i18n/ApiMessageDisplay';

interface GameOverModalProps {
  isOpen: boolean;
  gameOver: GameOverPayload | null;
  isSpectator?: boolean;
  onExit: () => void;
  gameProfile?: PlayerGameEndReasonProfile;
}


const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  gameOver,
  isSpectator = false,
  onExit,
  gameProfile = 'CHESS', // Default to CHESS if not provided
}) => {
  const t = useT();
  if (!gameOver) return null;

  const isWin  = !isSpectator && gameOver.youWon;
  const isDraw = gameOver.isDraw;

  const msgKeys: GameEndMessageKeys = {
    victoryOpponentTimeout: 'room_winner_reason_timeout_won',
    defeatOwnTimeout: 'room_winner_reason_timeout_lost',
    victoryOpponentDisconnected: 'room_winner_reason_forfeit_won',
    victoryDefault: 'bs_victory', // Generic victory
    defeatDefault: 'bs_defeat',  // Generic defeat
    victoryCheckmate: 'spectator_end_checkmate', // used as key name in resolve
    defeatCheckmate: 'spectator_end_checkmate',  // used as key name in resolve
    draw: 'spectator_match_draw_result',
    stalemate: 'chess_stalemate',
    insufficientMaterial: 'chess_insufficient_material',
  };

  // ── Title ───────────────────────────────────────────────────────────────────
  const title = isSpectator 
    ? t('spectator_match_finished')
    : isWin 
      ? t('bs_victory') 
      : isDraw 
        ? t('spectator_match_draw_result') 
        : t('bs_defeat');

  // ── Reason / Body ──────────────────────────────────────────────────────────
  // Mirroring Battleship's clean display logic: translating the key resolved in the store
  const reasonText = gameOver.reason ? t(gameOver.reason) : '';

  const accentColor = isSpectator
    ? (isDraw ? 'var(--sovereign-text-muted)' : 'var(--sovereign-gold)')
    : isWin
      ? 'var(--sovereign-gold)'
      : isDraw
        ? '#8a9bbf'
        : '#cf6679';

  // ── Body ────────────────────────────────────────────────────────────────────
  const renderBody = () => {
    if (isSpectator) {
      const line1 = isDraw
        ? t('spectator_match_draw_result')
        : applyWsMessagePlaceholders(t('spectator_match_winner_x'), { username: gameOver.winner || '---' });

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ color: 'var(--sovereign-text)', fontSize: 14, lineHeight: 1.6, margin: 0, textAlign: 'center' }}>
            {line1}
          </p>
          {reasonText && (
            <p style={{ color: 'var(--sovereign-text-muted)', fontSize: 13, lineHeight: 1.5, margin: 0, textAlign: 'center' }}>
              {reasonText}
            </p>
          )}
        </div>
      );
    }

    return (
      <p style={{ color: 'var(--sovereign-text)', fontSize: 14, lineHeight: 1.6, margin: 0, textAlign: 'center', whiteSpace: 'pre-line' }}>
        {reasonText}
      </p>
    );
  };

  return (
    <IonModal
      isOpen={isOpen}
      backdropDismiss={false}
      style={{
        '--background': 'transparent',
        '--backdrop-opacity': '0.65',
      } as React.CSSProperties}
    >
      {/* Centering wrapper */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '24px' }}>
        {/* Card — matches Android AlertDialog */}
        <div
          style={{
            background: 'var(--sovereign-surface)',
            borderRadius: 16,
            padding: '24px 24px 20px',
            width: '100%',
            maxWidth: 340,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Title */}
          <p style={{ color: accentColor, fontSize: 20, fontWeight: 800, margin: 0, textAlign: 'center' }}>
            {title}
          </p>

          {/* Body */}
          {renderBody()}

          {/* Prize — only for winners */}
          {isWin && gameOver.prize != null && gameOver.prize > 0 && (
            <div style={{
              background: 'rgba(201,168,76,0.15)',
              border: '1px solid rgba(201,168,76,0.5)',
              borderRadius: 8,
              padding: '8px 20px',
              alignSelf: 'center',
            }}>
              <p style={{ color: 'var(--sovereign-gold)', fontSize: 18, fontWeight: 800, margin: 0, textAlign: 'center' }}>
                + {gameOver.prize.toFixed(2)} USDT
              </p>
            </div>
          )}

          {/* Buttons ────────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <SovereignPrimaryButton
              onClick={onExit}
              style={{ backgroundColor: accentColor } as React.CSSProperties}
            >
              {t('ok')}
            </SovereignPrimaryButton>
          </div>
        </div>
      </div>
    </IonModal>
  );
};

export default GameOverModal;
