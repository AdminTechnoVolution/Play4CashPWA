import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonList,
  IonItem,
  IonText,
  IonBadge,
  IonIcon,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  RefresherEventDetail,
} from '@ionic/react';
import { AppBackButton } from '../../navigation/AppBackButton';
import {
  medalOutline,
  trophyOutline,
  arrowDownOutline,
  arrowUpOutline,
  timeOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  hourglassOutline,
} from 'ionicons/icons';
import { apiRepository } from '../../data/network/ApiRepository';
import { formatApiMessageForDisplay } from '../../i18n/ApiMessageDisplay';
import '../../ui/theme/variables.css';
import type { RechargeHistoryItem, WithdrawalHistoryItem, GameHistoryItem, TournamentHistoryItem } from '../../data/models/ApiModels';
import { useT } from '../../i18n/translations';
import { formatUSD } from '../../util/formatCurrency';
import { tournamentHistoryOutcomeStyle } from '../../util/tournamentUtils';

type Tab = 'deposits' | 'withdrawals' | 'games' | 'tournaments';

const TransactionHistoryPage: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('deposits');

  const [deposits, setDeposits] = useState<RechargeHistoryItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalHistoryItem[]>([]);
  const [games, setGames] = useState<GameHistoryItem[]>([]);
  const [tournaments, setTournaments] = useState<TournamentHistoryItem[]>([]);

  const [depositsLoading, setDepositsLoading] = useState(false);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);

  const [depositsLoaded, setDepositsLoaded] = useState(false);
  const [withdrawalsLoaded, setWithdrawalsLoaded] = useState(false);
  const [gamesLoaded, setGamesLoaded] = useState(false);
  const [tournamentsLoaded, setTournamentsLoaded] = useState(false);

  const loadDeposits = useCallback(async () => {
    setDepositsLoading(true);
    try {
      const data = await apiRepository.getRechargeHistory();
      setDeposits(data);
      setDepositsLoaded(true);
    } catch (err: any) {
      console.error(formatApiMessageForDisplay(err));
    } finally {
      setDepositsLoading(false);
    }
  }, []);

  const loadWithdrawals = useCallback(async () => {
    setWithdrawalsLoading(true);
    try {
      const data = await apiRepository.getWithdrawalHistory();
      setWithdrawals(data);
      setWithdrawalsLoaded(true);
    } catch (err: any) {
      console.error(formatApiMessageForDisplay(err));
    } finally {
      setWithdrawalsLoading(false);
    }
  }, []);

  const loadGames = useCallback(async () => {
    setGamesLoading(true);
    try {
      const data = await apiRepository.getGameHistory();
      setGames(data);
      setGamesLoaded(true);
    } catch (err: any) {
      console.error(formatApiMessageForDisplay(err));
    } finally {
      setGamesLoading(false);
    }
  }, []);

  const loadTournaments = useCallback(async () => {
    setTournamentsLoading(true);
    try {
      const data = await apiRepository.getTournamentHistory();
      setTournaments(data);
      setTournamentsLoaded(true);
    } catch (err: any) {
      console.error(formatApiMessageForDisplay(err));
    } finally {
      setTournamentsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeposits();
  }, []);

  useEffect(() => {
    if (activeTab === 'withdrawals' && !withdrawalsLoaded) loadWithdrawals();
    if (activeTab === 'games' && !gamesLoaded) loadGames();
    if (activeTab === 'tournaments' && !tournamentsLoaded) loadTournaments();
  }, [activeTab]);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    if (activeTab === 'deposits') await loadDeposits();
    if (activeTab === 'withdrawals') await loadWithdrawals();
    if (activeTab === 'games') await loadGames();
    if (activeTab === 'tournaments') await loadTournaments();
    event.detail.complete();
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const truncate = (str: string, max = 18) =>
    str.length > max ? `${str.slice(0, 8)}...${str.slice(-6)}` : str;

  const statusColor = (status: string): string => {
    const s = status.toLowerCase();
    if (s.includes('success') || s.includes('approved') || s.includes('complete')) return '#4caf50';
    if (s.includes('pending') || s.includes('processing')) return 'var(--sovereign-gold)';
    if (s.includes('fail') || s.includes('reject') || s.includes('error')) return 'var(--sovereign-error)';
    return 'var(--sovereign-text-muted)';
  };

  const statusIcon = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('success') || s.includes('approved') || s.includes('complete')) return checkmarkCircleOutline;
    if (s.includes('fail') || s.includes('reject')) return closeCircleOutline;
    return hourglassOutline;
  };

  const statusLabel = (status: string): string => {
    const s = status.toLowerCase();
    if (s.includes('success') || s.includes('approved') || s.includes('complete'))
      return t('APP.HISTORY.STATUS_COMPLETED');
    if (s.includes('pending') || s.includes('processing'))
      return t('APP.HISTORY.STATUS_PENDING');
    if (s.includes('fail') || s.includes('reject') || s.includes('error'))
      return t('APP.HISTORY.STATUS_FAILED');
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const gameResultStyle = (result: 'win' | 'lose' | 'draw'): { bg: string; color: string; label: string } => {
    if (result === 'win') return { bg: 'rgba(76,175,80,0.15)', color: '#4caf50', label: t('APP.HISTORY.RESULT_WIN') };
    if (result === 'lose') return { bg: 'rgba(207,102,121,0.15)', color: 'var(--sovereign-error)', label: t('APP.HISTORY.RESULT_LOSE') };
    return { bg: 'rgba(138,155,191,0.15)', color: 'var(--sovereign-text-muted)', label: t('APP.HISTORY.RESULT_DRAW') };
  };

  const normalizeGameHistoryResult = (item: GameHistoryItem): 'win' | 'lose' | 'draw' => {
    const result = (item.result || '').toLowerCase();
    if (result === 'win' || result === 'lose' || result === 'draw') return result;
    return item.prize > 0 ? 'win' : 'lose';
  };

  const SkeletonItem = () => (
    <div
      style={{
        background: 'var(--sovereign-surface)',
        border: '1px solid var(--sovereign-border)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '8px',
      }}
    >
      <IonSkeletonText animated style={{ width: '40%', height: '16px', marginBottom: '8px', borderRadius: '6px' }} />
      <IonSkeletonText animated style={{ width: '60%', height: '14px', borderRadius: '6px' }} />
    </div>
  );

  const EmptyState: React.FC<{ icon: string; message: string }> = ({ icon, message }) => (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <IonIcon icon={icon} style={{ fontSize: '64px', color: 'var(--sovereign-text-muted)', display: 'block', margin: '0 auto 16px' }} />
      <IonText>
        <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '15px', margin: 0 }}>{message}</p>
      </IonText>
    </div>
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <AppBackButton to="/dashboard" />
          </IonButtons>
          <IonTitle style={{ color: 'var(--sovereign-text)', fontWeight: '700' }}>{t('history_hub_title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': 'transparent' } as React.CSSProperties}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent pullingText="Pull to refresh" refreshingSpinner="crescent" />
        </IonRefresher>

        {/* Segment */}
        <div style={{ padding: '16px 16px 8px' }}>
          <IonSegment
            value={activeTab}
            onIonChange={(e) => setActiveTab(e.detail.value as Tab)}
            style={{ '--background': 'var(--sovereign-surface)', borderRadius: '10px' } as React.CSSProperties}
          >
            <IonSegmentButton value="deposits">
              <IonLabel style={{ fontSize: '11px', textTransform: 'none' }}>{t('history_tab_deposits')}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="withdrawals">
              <IonLabel style={{ fontSize: '11px', textTransform: 'none' }}>{t('history_tab_withdrawals')}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="games">
              <IonLabel style={{ fontSize: '11px', textTransform: 'none' }}>{t('history_tab_games')}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="tournaments">
              <IonLabel style={{ fontSize: '11px', textTransform: 'none' }}>{t('history_tab_tournaments')}</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>

        <div style={{ padding: '8px 16px 40px' }}>

          {/* DEPOSITS TAB */}
          {activeTab === 'deposits' && (
            <>
              {depositsLoading ? (
                [0, 1, 2, 3].map((i) => <SkeletonItem key={i} />)
              ) : deposits.length === 0 ? (
                <EmptyState icon={arrowDownOutline} message={t('deposit_history_empty')} />
              ) : (
                <IonList style={{ background: 'transparent' }}>
                  {deposits.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--sovereign-surface)',
                        border: '1px solid var(--sovereign-border)',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '8px',
                        animation: 'fadeInUp 0.4s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              background: 'rgba(76,175,80,0.12)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <IonIcon icon={arrowDownOutline} style={{ color: '#4caf50', fontSize: '18px' }} />
                          </div>
                          <div>
                            <IonText>
                              <p style={{ color: 'var(--sovereign-text)', fontWeight: '700', fontSize: '15px', margin: 0 }}>
                                +${formatUSD(item.amount)}
                              </p>
                            </IonText>
                            <IonText>
                              <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '12px', margin: 0, fontFamily: 'monospace' }}>
                                {t('transaction_label_tx_id')}: {truncate(item.txId ?? '')}
                              </p>
                            </IonText>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: `rgba(${item.status.toLowerCase().includes('success') ? '76,175,80' : '138,155,191'},0.12)`,
                              borderRadius: '6px',
                              padding: '3px 8px',
                              marginBottom: '4px',
                            }}
                          >
                            <IonIcon icon={statusIcon(item.status)} style={{ color: statusColor(item.status), fontSize: '12px' }} />
                            <IonText>
                              <span style={{ color: statusColor(item.status), fontSize: '11px', fontWeight: '700', textTransform: 'capitalize' }}>
                                {statusLabel(item.status)}
                              </span>
                            </IonText>
                          </div>
                          <IonText>
                            <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '11px', margin: 0 }}>
                              {formatDate(item.createdAt)}
                            </p>
                          </IonText>
                        </div>
                      </div>
                    </div>
                  ))}
                </IonList>
              )}
            </>
          )}

          {/* WITHDRAWALS TAB */}
          {activeTab === 'withdrawals' && (
            <>
              {withdrawalsLoading ? (
                [0, 1, 2, 3].map((i) => <SkeletonItem key={i} />)
              ) : withdrawals.length === 0 ? (
                <EmptyState icon={arrowUpOutline} message={t('withdrawal_history_empty')} />
              ) : (
                <IonList style={{ background: 'transparent' }}>
                  {withdrawals.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--sovereign-surface)',
                        border: '1px solid var(--sovereign-border)',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '8px',
                        animation: 'fadeInUp 0.4s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              background: 'rgba(201,168,76,0.12)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <IonIcon icon={arrowUpOutline} style={{ color: 'var(--sovereign-gold)', fontSize: '18px' }} />
                          </div>
                          <div>
                            <IonText>
                              <p style={{ color: 'var(--sovereign-text)', fontWeight: '700', fontSize: '15px', margin: '0 0 2px 0' }}>
                                -${formatUSD(item.amount)}
                              </p>
                            </IonText>
                            <IonText>
                              <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '12px', margin: '0 0 1px 0', fontFamily: 'monospace' }}>
                                {truncate(item.wallet)}
                              </p>
                            </IonText>
                            <IonText>
                              <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '11px', margin: 0 }}>
                                {item.network}
                              </p>
                            </IonText>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: `rgba(${statusColor(item.status) === '#4caf50' ? '76,175,80' : '138,155,191'},0.12)`,
                              borderRadius: '6px',
                              padding: '3px 8px',
                              marginBottom: '4px',
                            }}
                          >
                            <IonIcon icon={statusIcon(item.status)} style={{ color: statusColor(item.status), fontSize: '12px' }} />
                            <IonText>
                              <span style={{ color: statusColor(item.status), fontSize: '11px', fontWeight: '700', textTransform: 'capitalize' }}>
                                {statusLabel(item.status)}
                              </span>
                            </IonText>
                          </div>
                          <IonText>
                            <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '11px', margin: 0 }}>
                              {formatDate(item.createdAt)}
                            </p>
                          </IonText>
                        </div>
                      </div>
                    </div>
                  ))}
                </IonList>
              )}
            </>
          )}

          {/* GAMES TAB */}
          {activeTab === 'games' && (
            <>
              {gamesLoading ? (
                [0, 1, 2, 3].map((i) => <SkeletonItem key={i} />)
              ) : games.length === 0 ? (
                <EmptyState icon={trophyOutline} message={t('game_history_empty')} />
              ) : (
                <IonList style={{ background: 'transparent' }}>
                  {games.map((item, idx) => {
                    const normalizedResult = normalizeGameHistoryResult(item);
                    const resultStyle = gameResultStyle(normalizedResult);
                    const showLostAmount = normalizedResult === 'lose' && (item.lostAmount ?? 0) > 0;
                    return (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--sovereign-surface)',
                          border: '1px solid var(--sovereign-border)',
                          borderRadius: '12px',
                          padding: '16px',
                          marginBottom: '8px',
                          animation: 'fadeInUp 0.4s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: resultStyle.bg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <IonIcon icon={trophyOutline} style={{ color: resultStyle.color, fontSize: '18px' }} />
                            </div>
                            <div>
                              <IonText>
                                <p style={{ color: 'var(--sovereign-text)', fontWeight: '700', fontSize: '14px', margin: '0 0 2px 0' }}>
                                  {t('game_history_label_opponent')}: {item.opponentName}
                                </p>
                              </IonText>
                              <IonText>
                                <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '12px', margin: 0 }}>
                                  {item.gameName ?? item.gameCode}
                                </p>
                              </IonText>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <IonBadge
                              style={{
                                background: resultStyle.bg,
                                color: resultStyle.color,
                                border: `1px solid ${resultStyle.color}40`,
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: '800',
                                display: 'block',
                                marginBottom: '4px',
                              }}
                            >
                              {resultStyle.label}
                            </IonBadge>
                            {item.prize > 0 && (
                              <IonText>
                                <span style={{ color: 'var(--sovereign-gold)', fontWeight: '700', fontSize: '13px' }}>
                                  +${formatUSD(item.prize)}
                                </span>
                              </IonText>
                            )}
                            {showLostAmount && (
                              <IonText>
                                <span style={{ color: 'var(--sovereign-error)', fontWeight: '700', fontSize: '13px' }}>
                                  -${formatUSD(item.lostAmount ?? 0)}
                                </span>
                              </IonText>
                            )}
                          </div>
                        </div>

                        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <IonIcon icon={timeOutline} style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px' }} />
                          <IonText>
                            <span style={{ color: 'var(--sovereign-text-muted)', fontSize: '12px' }}>
                              {formatDate(item.finishedAt)}
                            </span>
                          </IonText>
                        </div>
                      </div>
                    );
                  })}
                </IonList>
              )}
            </>
          )}

          {/* TOURNAMENTS TAB */}
          {activeTab === 'tournaments' && (
            <>
              {tournamentsLoading ? (
                [0, 1, 2, 3].map((i) => <SkeletonItem key={i} />)
              ) : tournaments.length === 0 ? (
                <EmptyState icon={trophyOutline} message={t('tournament_history_empty')} />
              ) : (
                <IonList style={{ background: 'transparent' }}>
                  {tournaments.map((item) => {
                    const outcome = tournamentHistoryOutcomeStyle(item);
                    const icon = item.participantStatus === 'runner_up' ? medalOutline : trophyOutline;
                    const when = item.finishedAt ?? item.startedAt;
                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          navigate(`/tournaments/${item.id}/bracket`, { state: { tournament: item } })
                        }
                        onKeyDown={(e) =>
                          e.key === 'Enter' &&
                          navigate(`/tournaments/${item.id}/bracket`, { state: { tournament: item } })
                        }
                        style={{
                          background: 'var(--sovereign-surface)',
                          border: '1px solid var(--sovereign-border)',
                          borderRadius: '12px',
                          padding: '16px',
                          marginBottom: '8px',
                          animation: 'fadeInUp 0.4s ease',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: outcome.bg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <IonIcon icon={icon} style={{ color: outcome.color, fontSize: '18px' }} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <IonText>
                                <p
                                  style={{
                                    color: 'var(--sovereign-text)',
                                    fontWeight: '700',
                                    fontSize: '14px',
                                    margin: '0 0 2px 0',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {item.title}
                                </p>
                              </IonText>
                              <IonText>
                                <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '12px', margin: 0 }}>
                                  {item.gameSocketCode.replace(/-/g, ' ')} · {item.registeredCount}/{item.maxPlayers}
                                </p>
                              </IonText>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', marginLeft: '8px', flexShrink: 0 }}>
                            <IonBadge
                              style={{
                                background: outcome.bg,
                                color: outcome.color,
                                border: `1px solid ${outcome.color}40`,
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: '800',
                                display: 'block',
                                marginBottom: '4px',
                              }}
                            >
                              {t(outcome.labelKey)}
                            </IonBadge>
                            {item.prizeAmount > 0 && (
                              <IonText>
                                <span style={{ color: 'var(--sovereign-gold)', fontWeight: '700', fontSize: '13px' }}>
                                  +${formatUSD(item.prizeAmount)}
                                </span>
                              </IonText>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <IonIcon icon={timeOutline} style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px' }} />
                            <IonText>
                              <span style={{ color: 'var(--sovereign-text-muted)', fontSize: '12px' }}>
                                {when ? formatDate(when) : '—'}
                              </span>
                            </IonText>
                          </div>
                          <IonText>
                            <span style={{ color: 'var(--sovereign-text-muted)', fontSize: '11px' }}>
                              {t('tournament_history_buy_in')}: ${formatUSD(item.buyIn)}
                            </span>
                          </IonText>
                        </div>
                      </div>
                    );
                  })}
                </IonList>
              )}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default TransactionHistoryPage;
