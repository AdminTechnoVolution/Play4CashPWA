import {
  IonModal,
  IonIcon,
} from '@ionic/react';
import { chevronForwardOutline } from 'ionicons/icons';
import { useT } from '../../i18n/translations';
import { SovereignPrimaryButton } from './SovereignButton';

export type GameRulesModalGame = {
  name?: string;
  description?: string;
  rules?: string[];
  houseEdge?: number;
  defaultBets?: number[];
  unoMatchTarget?: number;
  socketCode?: string;
};

type Props = {
  isOpen: boolean;
  onDismiss: () => void;
  game: GameRulesModalGame | null;
};

function formatHouseEdgePercent(edge: number | undefined): string | null {
  if (edge == null || typeof edge !== 'number' || !Number.isFinite(edge)) return null;
  const rounded =
    Math.abs(edge - Math.round(edge)) < 1e-9
      ? Math.round(edge)
      : Math.round(edge * 100) / 100;
  return `${rounded}%`;
}

export default function GameRulesModal({ isOpen, onDismiss, game }: Props) {
  const t = useT();
  const rules = game?.rules?.filter((r) => r.trim().length > 0) ?? [];
  const houseEdgeLabel = formatHouseEdgePercent(game?.houseEdge);

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      style={{ '--height': '80%', '--border-radius': '20px' } as React.CSSProperties}
    >
      <div
        style={{
          padding: '24px',
          background: 'var(--sovereign-surface)',
          color: 'var(--sovereign-text)',
          height: '100%',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--sovereign-gold)' }}>
            {game?.name}
          </h2>
          <IonIcon
            icon={chevronForwardOutline}
            style={{ fontSize: '24px', cursor: 'pointer', transform: 'rotate(90deg)', color: 'var(--sovereign-text-muted)' }}
            onClick={onDismiss}
          />
        </div>

        <section style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--sovereign-gold)', marginBottom: '8px' }}>
            {t('game_description_title')}
          </h3>
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: '15px' }}>
            {game?.description || t('dashboard_no_games_subtitle')}
          </p>
        </section>

        {rules.length > 0 && (
          <section style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--sovereign-gold)', marginBottom: '8px' }}>
              {t('game_rules_title')}
            </h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: '20px',
                lineHeight: 1.55,
                fontSize: '15px',
              }}
            >
              {rules.map((rule, index) => (
                <li key={`${index}-${rule.slice(0, 24)}`} style={{ marginBottom: '8px' }}>
                  {rule}
                </li>
              ))}
            </ul>
          </section>
        )}

        {game?.socketCode === 'uno' && typeof game?.unoMatchTarget === 'number' && (
          <section style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--sovereign-gold)', marginBottom: '8px' }}>
              {t('uno_target_label')}
            </h3>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>
              {t('uno_lobby_match_target').replace('{{points}}', String(game.unoMatchTarget))}
            </p>
          </section>
        )}

        {houseEdgeLabel && (
          <section style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--sovereign-gold)', marginBottom: '8px' }}>
              {t('game_commission')}
            </h3>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>{houseEdgeLabel}</p>
          </section>
        )}

        {(game?.defaultBets?.length ?? 0) > 0 && (
          <section style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--sovereign-gold)', marginBottom: '8px' }}>
              {t('game_suggested_bets')}
            </h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {game!.defaultBets!.map((bet) => (
                <span
                  key={bet}
                  style={{
                    background: 'rgba(201,168,76,0.15)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: 'var(--sovereign-gold)',
                  }}
                >
                  ${bet}
                </span>
              ))}
            </div>
          </section>
        )}

        <SovereignPrimaryButton expand="block" onClick={onDismiss} style={{ marginTop: '24px' }}>
          {t('ok')}
        </SovereignPrimaryButton>
      </div>
    </IonModal>
  );
}
