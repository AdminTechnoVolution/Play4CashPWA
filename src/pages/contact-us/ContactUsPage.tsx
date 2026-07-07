import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonText,
  IonIcon,
  IonSkeletonText,
  IonAlert,
  IonCheckbox,
  IonToggle,
  IonItem,
  IonLabel,
} from '@ionic/react';
import {
  chevronDownOutline,
  chevronUpOutline,
  mailOutline,
  gameControllerOutline,
  chatbubbleOutline,
} from 'ionicons/icons';
import { apiRepository } from '../../data/network/ApiRepository';
import { SovereignPrimaryButton } from '../../ui/components/SovereignButton';
import GenericErrorModal from '../../ui/components/GenericErrorModal';
import { AppBackButton } from '../../navigation/AppBackButton';
import { useT } from '../../i18n/translations';
import { formatApiMessageForDisplay } from '../../i18n/ApiMessageDisplay';
import type { ContactUsType, GameResponse } from '../../data/models/ApiModels';
import '../../ui/theme/variables.css';

const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;

const ContactUsPage: React.FC = () => {
  const t = useT();

  const [type, setType] = useState<ContactUsType | ''>('');
  const [message, setMessage] = useState('');
  const [allGames, setAllGames] = useState(false);
  const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(new Set());

  const [games, setGames] = useState<GameResponse[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [typeExpanded, setTypeExpanded] = useState(true);
  const [gamesExpanded, setGamesExpanded] = useState(true);
  const [messageExpanded, setMessageExpanded] = useState(true);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    (async () => {
      setGamesLoading(true);
      try {
        const data = await apiRepository.getGames();
        setGames(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('error_try_later_message'));
      } finally {
        setGamesLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGame = (gameId: string) => {
    if (allGames) return;
    setSelectedGameIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  };

  const handleAllGamesToggle = (checked: boolean) => {
    setAllGames(checked);
    if (checked) setSelectedGameIds(new Set());
  };

  const validate = (): string => {
    if (!type) return t('contact_us_validation_type_required');
    const trimmed = message.trim();
    if (trimmed.length < MESSAGE_MIN) return t('contact_us_validation_message_min');
    if (trimmed.length > MESSAGE_MAX) return t('contact_us_validation_message_max');
    if (!allGames && selectedGameIds.size === 0) return t('contact_us_validation_games_required');
    return '';
  };

  const handleSubmit = async () => {
    const validation = validate();
    if (validation) {
      setValidationError(validation);
      return;
    }
    setValidationError('');
    setSubmitting(true);
    try {
      await apiRepository.submitContactUs({
        type: type as ContactUsType,
        message: message.trim(),
        game_ids: allGames ? [] : Array.from(selectedGameIds),
        all_games: allGames,
      });
      setType('');
      setMessage('');
      setAllGames(false);
      setSelectedGameIds(new Set());
      setAlertMessage(t('contact_us_success'));
      setAlertOpen(true);
    } catch (err) {
      const msg = formatApiMessageForDisplay(
        err instanceof Error ? err.message : null,
        'error_try_later_message',
      );
      setAlertMessage(msg);
      setAlertOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  const messageLength = message.length;
  const canSubmit =
    !!type &&
    message.trim().length >= MESSAGE_MIN &&
    message.trim().length <= MESSAGE_MAX &&
    (allGames || selectedGameIds.size > 0) &&
    !submitting;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <AppBackButton to="/dashboard" />
          </IonButtons>
          <IonTitle style={{ color: 'var(--sovereign-text)', fontWeight: '700' }}>
            {t('contact_us_title')}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': 'transparent' } as React.CSSProperties}>
        <div
          style={{
            padding: '24px 20px',
            maxWidth: '480px',
            margin: '0 auto',
            animation: 'fadeInUp 0.5s ease',
          }}
        >
          <CollapsibleCard
            icon={mailOutline}
            title={t('contact_us_type_label')}
            expanded={typeExpanded}
            onToggle={() => setTypeExpanded((v) => !v)}
          >
            <FieldGroup label={t('contact_us_type_label')}>
              <IonSelect
                value={type}
                onIonChange={(e) => setType(e.detail.value)}
                interface="action-sheet"
                placeholder="—"
                style={selectStyle as React.CSSProperties}
              >
                <IonSelectOption value="comment">{t('contact_us_type_comment')}</IonSelectOption>
                <IonSelectOption value="suggestion">{t('contact_us_type_suggestion')}</IonSelectOption>
                <IonSelectOption value="error">{t('contact_us_type_error')}</IonSelectOption>
              </IonSelect>
            </FieldGroup>
          </CollapsibleCard>

          <CollapsibleCard
            icon={gameControllerOutline}
            title={t('contact_us_games_label')}
            expanded={gamesExpanded}
            onToggle={() => setGamesExpanded((v) => !v)}
          >
            <IonItem
              lines="none"
              style={{
                '--background': 'transparent',
                '--padding-start': '0',
                '--inner-padding-end': '0',
                marginBottom: '12px',
              } as React.CSSProperties}
            >
              <IonLabel style={{ color: 'var(--sovereign-text)', fontSize: '14px' }}>
                {t('contact_us_all_games')}
              </IonLabel>
              <IonToggle
                slot="end"
                checked={allGames}
                onIonChange={(e) => handleAllGamesToggle(e.detail.checked)}
                style={{ '--handle-background': 'var(--sovereign-gold)' } as React.CSSProperties}
              />
            </IonItem>

            {gamesLoading ? (
              <IonSkeletonText animated style={{ height: '120px', borderRadius: '10px' }} />
            ) : games.length === 0 ? (
              <IonText>
                <p style={hintStyle}>{t('dashboard_no_games_subtitle')}</p>
              </IonText>
            ) : (
              <div
                style={{
                  opacity: allGames ? 0.5 : 1,
                  pointerEvents: allGames ? 'none' : 'auto',
                  transition: 'opacity 0.2s ease',
                }}
              >
                {games.map((game) => (
                  <IonItem
                    key={game.id}
                    lines="none"
                    button
                    onClick={() => toggleGame(game.id)}
                    style={{
                      '--background': 'transparent',
                      '--padding-start': '0',
                      '--inner-padding-end': '0',
                      marginBottom: '4px',
                    } as React.CSSProperties}
                  >
                    <IonCheckbox
                      slot="start"
                      checked={selectedGameIds.has(game.id)}
                      disabled={allGames}
                      style={{ '--border-color': 'var(--sovereign-border)' } as React.CSSProperties}
                    />
                    <IonLabel style={{ color: 'var(--sovereign-text)', fontSize: '14px' }}>
                      {game.name}
                    </IonLabel>
                  </IonItem>
                ))}
              </div>
            )}
          </CollapsibleCard>

          <CollapsibleCard
            icon={chatbubbleOutline}
            title={t('contact_us_message_label')}
            expanded={messageExpanded}
            onToggle={() => setMessageExpanded((v) => !v)}
          >
            <FieldGroup label={t('contact_us_message_label')}>
              <IonTextarea
                value={message}
                onIonInput={(e) => setMessage(e.detail.value ?? '')}
                rows={6}
                maxlength={MESSAGE_MAX}
                placeholder={t('contact_us_message_placeholder')}
                style={textareaStyle as React.CSSProperties}
              />
            </FieldGroup>
            <IonText>
              <p
                style={{
                  ...hintStyle,
                  textAlign: 'right',
                  color:
                    messageLength > MESSAGE_MAX
                      ? 'var(--ion-color-danger)'
                      : 'var(--sovereign-text-muted)',
                }}
              >
                {messageLength} / {MESSAGE_MAX}
              </p>
            </IonText>
          </CollapsibleCard>

          {validationError && (
            <IonText>
              <p
                style={{
                  color: 'var(--ion-color-danger)',
                  fontSize: '13px',
                  margin: '0 0 16px 0',
                  textAlign: 'center',
                }}
              >
                {validationError}
              </p>
            </IonText>
          )}

          <SovereignPrimaryButton
            onClick={handleSubmit}
            loading={submitting}
            expand="block"
            disabled={!canSubmit}
          >
            {t('contact_us_submit')}
          </SovereignPrimaryButton>

          <div style={{ height: '40px' }} />
        </div>

        <IonAlert
          isOpen={alertOpen}
          onDidDismiss={() => setAlertOpen(false)}
          header={t('information')}
          message={alertMessage}
          buttons={[t('ok')]}
          cssClass="sovereign-alert"
        />
      </IonContent>

      <GenericErrorModal isOpen={!!error} message={error} onDismiss={() => setError('')} />
    </IonPage>
  );
};

interface CollapsibleCardProps {
  icon: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  icon,
  title,
  expanded,
  onToggle,
  children,
}) => (
  <div style={{ marginBottom: '20px' }}>
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'pointer',
        background: 'var(--sovereign-surface)',
        border: '1px solid var(--sovereign-border)',
        borderRadius: expanded ? '16px 16px 0 0' : '16px',
        padding: '16px 20px',
        transition: 'border-radius 0.2s ease',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'rgba(201,168,76,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IonIcon icon={icon} style={{ color: 'var(--sovereign-gold)', fontSize: '20px' }} />
      </div>
      <IonText style={{ flex: 1 }}>
        <h3
          style={{
            color: 'var(--sovereign-text)',
            fontWeight: '700',
            fontSize: '16px',
            margin: 0,
          }}
        >
          {title}
        </h3>
      </IonText>
      <IonIcon
        icon={expanded ? chevronUpOutline : chevronDownOutline}
        style={{ color: 'var(--sovereign-text)', fontSize: '20px', flexShrink: 0 }}
      />
    </div>

    <div
      style={{
        maxHeight: expanded ? '1200px' : '0',
        overflow: 'hidden',
        transition: 'max-height 0.35s ease',
      }}
    >
      <div
        style={{
          background: 'var(--sovereign-surface)',
          border: '1px solid var(--sovereign-border)',
          borderTop: 'none',
          borderRadius: '0 0 16px 16px',
          padding: '20px',
        }}
      >
        {children}
      </div>
    </div>
  </div>
);

const FieldGroup: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div style={{ marginBottom: '16px' }}>
    <IonText>
      <label
        style={{
          color: 'var(--sovereign-text-muted)',
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '1px',
          display: 'block',
          marginBottom: '8px',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </label>
    </IonText>
    {children}
  </div>
);

const selectStyle = {
  '--background': 'transparent',
  '--color': 'var(--sovereign-text)',
  border: '1px solid var(--sovereign-border)',
  borderRadius: '10px',
  padding: '12px 14px',
  width: '100%',
};

const textareaStyle = {
  '--background': 'transparent',
  '--color': 'var(--sovereign-text)',
  '--placeholder-color': 'var(--sovereign-text-muted)',
  '--padding-start': '14px',
  '--padding-end': '14px',
  '--padding-top': '12px',
  '--padding-bottom': '12px',
  border: '1px solid var(--sovereign-border)',
  borderRadius: '10px',
};

const hintStyle: React.CSSProperties = {
  color: 'var(--sovereign-text-muted)',
  fontSize: '12px',
  margin: '0 0 12px 0',
  lineHeight: '1.5',
};

export default ContactUsPage;
