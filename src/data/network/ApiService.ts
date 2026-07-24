import { apiClient, bareClient } from './ApiClient';
import type {
  ApiResponse,
  LoginResponse,
  UserAccountResponse,
  PublicUserStatsResponse,
  GameResponse,
  GreetingResponse,
  WalletResponse,
  RoomStatsResponse,
  RoomResponse,
  RoomPlayer,
  RoomStatusResponse,
  RoomStateResponse,
  CreateRoomRequest,
  BattleshipPlacementRequest,
  RequestWalletChangePayload,
  ConfirmWalletChangeRequest,
  RechargeRequest,
  WithdrawalRequest,
  VerifyWithdrawalRequest,
  RechargeHistoryItem,
  WithdrawalHistoryItem,
  GameHistoryItem,
  TournamentSummary,
  TournamentHistoryItem,
  TournamentBracketResponse,
  TournamentBracketMatch,
  ContactUsSubmitPayload,
  ContactUsSubmitResponse,
  ContactRequestItem,
} from '../models/ApiModels';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap<T>(data: ApiResponse<T>): T {
  if (!data.success || data.data === undefined) {
    throw new Error(
      data.messages?.[0] ?? data.message ?? 'Unexpected empty response',
    );
  }
  return data.data;
}

export const apiService = {
  // ─── Auth ──────────────────────────────────────────────────────────────────
  async login(googleIdToken: string): Promise<LoginResponse> {
    const res = await bareClient.post<ApiResponse<LoginResponse>>('/api/login', {
      token: googleIdToken,
    });
    return unwrap(res.data);
  },

  async refreshToken(refreshToken?: string): Promise<LoginResponse> {
    const res = await bareClient.post<ApiResponse<LoginResponse>>(
      '/api/login/refresh',
      refreshToken ? { refreshToken } : {},
    );
    return unwrap(res.data);
  },

  /** Public — login page community counter */
  async getPublicUserStats(): Promise<PublicUserStatsResponse> {
    const res = await bareClient.get<ApiResponse<PublicUserStatsResponse>>('/api/user/public/stats');
    return unwrap(res.data);
  },

  async logout(refreshToken?: string): Promise<void> {
    await apiClient.post<ApiResponse<void>>(
      '/api/logout',
      refreshToken ? { refreshToken } : {},
    );
  },

  // ─── Account ───────────────────────────────────────────────────────────────
  async getUserAccount(): Promise<UserAccountResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any>>('/api/user/account');
    const raw = unwrap(res.data);
    return {
      id: raw._id ?? raw.id ?? '',
      email: raw.email ?? '',
      username: raw.username ?? '',
      balance: raw.balance ?? 0,
      walletAddress: raw.wallet_address?.wallet ?? raw.wallet ?? '',
      walletCoin: raw.wallet_address?.coin ?? 'USDT',
      walletNetwork: raw.wallet_address?.network ?? '',
      limits: raw.limits
        ? { dailyWithdrawal: raw.limits.daily_withdrawal ?? undefined }
        : undefined,
    };
  },

  // ─── Games ─────────────────────────────────────────────────────────────────
  async getGames(): Promise<GameResponse[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any[]>>('/api/games');
    const raw = unwrap(res.data);
    return raw.map((g) => {
      const he = g.house_edge ?? g.houseEdge;
      const houseEdge =
        typeof he === 'number' && Number.isFinite(he) ? he : undefined;
      const um = g.unoMatchTarget ?? g.uno_match_target;
      const unoMatchTarget =
        typeof um === 'number' && Number.isFinite(um) ? um : undefined;
      const rawRules = g.rules ?? [];
      const rules = Array.isArray(rawRules)
        ? rawRules.map((r: unknown) => (typeof r === 'string' ? r : '')).filter(Boolean)
        : [];
      return {
        id: g._id ?? g.id ?? '',
        name: g.name ?? '',
        minBet: g.min_bet ?? 0,
        socketCode: g.socket_code ?? '',
        turnTimerSeconds: g.turn_timer_seconds ?? 0,
        defaultBets: g.default_bets ?? [],
        description: g.description ?? '',
        rules,
        minPlayers: g.min_players ?? g.minPlayers ?? 2,
        maxPlayers: g.max_players ?? g.maxPlayers ?? 2,
        activeRooms: g.activeRooms ?? g.active_rooms ?? 0,
        houseEdge,
        unoMatchTarget,
      };
    });
  },

  // ─── Greetings ─────────────────────────────────────────────────────────────
  async getGreetings(): Promise<GreetingResponse[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any[]>>('/api/greetings');
    const raw = unwrap(res.data);
    return raw.map((g) => ({
      id: g._id ?? g.id ?? '',
      text: g.text ?? '',
    }));
  },

  // ─── Wallets ───────────────────────────────────────────────────────────────
  async getWallets(): Promise<WalletResponse[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any[]>>('/api/wallets');
    const raw = unwrap(res.data);
    return raw.map((w) => {
      const network = w.red ?? '';
      const description = w.description ?? '';
      const displayLabel = network && description
        ? `${network} - ${description}`
        : network || description || (w.address ?? '').slice(0, 12) + '…';
      return {
        id: w._id ?? '',
        coin: w.coin ?? '',
        address: w.address ?? '',
        network,
        description,
        isActive: w.isActive ?? true,
        minAmount: w.minAmount ?? 0,
        fee: w.networkWithdrawalFee ?? 0,
        displayLabel,
      };
    });
  },

  // ─── Rooms ─────────────────────────────────────────────────────────────────
  async getRoomStats(): Promise<RoomStatsResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any>>('/api/rooms/stats');
    const raw = unwrap(res.data);
    return {
      playersOnline: raw.playersOnline ?? 0,
      activeGames: raw.activeGames ?? 0,
      totalBetAmount: raw.totalBetAmount ?? 0,
    };
  },

  async getRooms(gameId: string): Promise<RoomResponse[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any[]>>(`/api/rooms/game/${gameId}`);
    const raw = unwrap(res.data);
    return raw.map(normalizeRoom);
  },

  async createRoom(req: CreateRoomRequest): Promise<string> {
    const idempKey =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.post<ApiResponse<any>>('/api/rooms', req, {
      headers: { 'Idempotency-Key': idempKey },
    });
    const data = unwrap(res.data);
    return data._id ?? data.id ?? '';
  },

  async joinRoom(roomId: string): Promise<RoomStateResponse> {
    const res = await apiClient.post<ApiResponse<any>>(`/api/rooms/${roomId}/join`);
    return normalizeRoomState(unwrap(res.data));
  },

  async getActiveRoom(): Promise<RoomResponse | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any | null>>('/api/rooms/active');
    const raw = unwrap(res.data);
    if (!raw) return null;
    return normalizeRoom(raw);
  },

  async spectateRoom(roomId: string): Promise<void> {
    console.log('[SPECTATOR][1] ApiService.spectateRoom → POST /api/rooms/' + roomId + '/spectate');
    await apiClient.post<ApiResponse<void>>(`/api/rooms/${roomId}/spectate`);
    console.log('[SPECTATOR][1] ApiService.spectateRoom → 200 OK');
  },

  async readyRoom(roomId: string): Promise<void> {
    await apiClient.patch<ApiResponse<void>>(`/api/rooms/${roomId}/ready`, { ready: true });
  },

  async leaveRoom(roomId: string): Promise<RoomStatusResponse> {
    const res = await apiClient.post<ApiResponse<RoomStatusResponse>>(`/api/rooms/${roomId}/leave`);
    return unwrap(res.data);
  },

  async getRoomStatus(roomId: string): Promise<RoomStatusResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any>>(`/api/rooms/${roomId}/status`);
    const raw = unwrap(res.data);
    return {
      id: raw.id ?? '',
      status: raw.status ?? '',
      playerCount:
        raw.playerCount ??
        raw.player_count ??
        (Array.isArray(raw.players) ? raw.players.length : 0) ??
        0,
      playerLimit: raw.playerLimit ?? raw.player_limit,
      betAmount: raw.bet_amount,
      winner: raw.winner,
      winnerReason: raw.winner_reason,
    };
  },

  async getRoomState(roomId: string): Promise<RoomStateResponse> {
    const res = await apiClient.get<ApiResponse<any>>(`/api/rooms/${roomId}/state`);
    return normalizeRoomState(unwrap(res.data));
  },

  // ─── Battleship ────────────────────────────────────────────────────────────
  // Android: POST /api/rooms/{roomId}/battleship/placement
  // Transforms internal ShipPlacement → backend { type, startRow, startCol, isHorizontal, cells }

  async submitBattleshipPlacement(
    roomId: string,
    req: BattleshipPlacementRequest,
  ): Promise<void> {
    const ships = req.ships.map((s) => {
      const size = (s as unknown as { size?: number }).size ?? 1;
      const cells: number[][] = [];
      for (let i = 0; i < size; i++) {
        cells.push(s.horizontal ? [s.row, s.col + i] : [s.row + i, s.col]);
      }
      return {
        type: s.type.toLowerCase(),
        startRow: s.row,
        startCol: s.col,
        isHorizontal: s.horizontal,
        cells,
      };
    });
    await apiClient.post<ApiResponse<void>>(`/api/rooms/${roomId}/battleship/placement`, { ships });
  },

  // ─── Wallet / Finance ──────────────────────────────────────────────────────
  // POST /api/user/request-wallet-change then POST /api/user/confirm-wallet-change (OTP by email)

  async requestWalletChange(req: RequestWalletChangePayload): Promise<void> {
    const res = await apiClient.post<ApiResponse<void>>('/api/user/request-wallet-change', req);
    if (!res.data?.success) {
      throw new Error(res.data?.messages?.[0] ?? res.data?.message ?? 'error_try_later_message');
    }
  },

  async confirmWalletChange(req: ConfirmWalletChangeRequest): Promise<void> {
    const res = await apiClient.post<ApiResponse<void>>('/api/user/confirm-wallet-change', req);
    if (!res.data?.success) {
      throw new Error(res.data?.messages?.[0] ?? res.data?.message ?? 'error_try_later_message');
    }
  },

  // Android: POST /api/transactions/recharge with { txId, coin }
  async recharge(req: RechargeRequest): Promise<void> {
    const idempotencyKey = req.idempotencyKey ?? createIdempotencyKey();
    await apiClient.post<ApiResponse<void>>('/api/transactions/recharge', req, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  },

  // Android: POST /api/transactions/withdrawal with { amount } only
  async withdrawal(req: WithdrawalRequest): Promise<void> {
    const res = await apiClient.post<ApiResponse<void>>('/api/transactions/withdrawal', req);
    if (!res.data?.success) {
      throw new Error(res.data?.message ?? res.data?.messages?.[0] ?? 'error_try_later_message');
    }
  },

  // Android: POST /api/transactions/verify-withdrawal with { verification_code }
  async verifyWithdrawal(req: VerifyWithdrawalRequest): Promise<void> {
    const res = await apiClient.post<ApiResponse<void>>('/api/transactions/verify-withdrawal', req);
    if (!res.data?.success) {
      throw new Error(res.data?.messages?.[0] ?? res.data?.message ?? 'error_try_later_message');
    }
  },

  // ─── History ───────────────────────────────────────────────────────────────
  // Android: GET /api/transactions/recharge/history

  async getRechargeHistory(): Promise<RechargeHistoryItem[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any[]>>('/api/transactions/recharge/history');
    const raw = unwrap(res.data);
    return raw.map((item) => ({
      amount: item.amount ?? 0,
      coin: item.coin ?? 'USDT',
      txId: item.txId,
      wallet: item.wallet ?? '',
      network: item.network ?? '',
      status: item.status ?? '',
      createdAt: item.created_at ?? item.createdAt ?? '',
    }));
  },

  // Android: GET /api/transactions/withdrawal/history
  async getWithdrawalHistory(): Promise<WithdrawalHistoryItem[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any[]>>('/api/transactions/withdrawal/history');
    const raw = unwrap(res.data);
    return raw.map((item) => ({
      amount: item.amount ?? 0,
      coin: item.coin ?? 'USDT',
      wallet: item.wallet ?? '',
      network: item.network ?? '',
      txFee: item.tx_fee,
      status: item.status ?? '',
      createdAt: item.created_at ?? item.createdAt ?? '',
    }));
  },

  // Android: GET /api/user/history
  async getGameHistory(): Promise<GameHistoryItem[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any[]>>('/api/user/history');
    const raw = unwrap(res.data);
    return raw.map((item) => {
      const opponentNames = Array.isArray(item.opponents)
        ? item.opponents
            .map((opponent: { username?: unknown }) =>
              typeof opponent?.username === 'string' ? opponent.username.trim() : '',
            )
            .filter(Boolean)
        : [];
      const legacyOpponentName =
        typeof item.opponent?.username === 'string' ? item.opponent.username.trim() : '';

      return {
        roomId: item.room_id ?? '',
        gameName: item.game_name ?? '',
        gameCode: item.game_code ?? '',
        betAmount: item.bet_amount ?? 0,
        result: item.result ?? '',
        prize: item.prize ?? 0,
        lostAmount: item.lost_amount ?? item.lostAmount ?? 0,
        opponentNames:
          opponentNames.length > 0
            ? opponentNames
            : legacyOpponentName
              ? [legacyOpponentName]
              : [],
        finishedAt: item.finished_at ?? item.date ?? '',
        auditAdjustment: item.audit_adjustment
          ? {
              kind: item.audit_adjustment.kind,
              amount: Number(item.audit_adjustment.amount ?? 0),
              reason: String(item.audit_adjustment.reason ?? ''),
              createdAt: String(item.audit_adjustment.created_at ?? ''),
              affectedUsernames: Array.isArray(item.audit_adjustment.affected_usernames)
                ? item.audit_adjustment.affected_usernames.map(String)
                : [],
            }
          : null,
      };
    });
  },

  async getTournaments(): Promise<TournamentSummary[]> {
    const res = await apiClient.get<ApiResponse<TournamentSummary[]>>('/api/tournaments');
    return (unwrap(res.data) ?? []).map(normalizeTournament);
  },

  async getMyTournaments(): Promise<TournamentSummary[]> {
    const res = await apiClient.get<ApiResponse<TournamentSummary[]>>('/api/tournaments/mine');
    return (unwrap(res.data) ?? []).map(normalizeTournament);
  },

  async getTournamentHistory(): Promise<TournamentHistoryItem[]> {
    const res = await apiClient.get<ApiResponse<TournamentHistoryItem[]>>('/api/tournaments/history');
    return (unwrap(res.data) ?? []).map(normalizeTournamentHistory);
  },

  async getTournament(id: string): Promise<TournamentSummary> {
    const res = await apiClient.get<ApiResponse<TournamentSummary>>(`/api/tournaments/${id}`);
    return normalizeTournament(unwrap(res.data));
  },

  async getTournamentBracket(id: string): Promise<TournamentBracketResponse> {
    const res = await apiClient.get<ApiResponse<TournamentBracketResponse>>(`/api/tournaments/${id}/bracket`);
    return normalizeTournamentBracket(unwrap(res.data));
  },

  async registerTournament(id: string): Promise<unknown> {
    const idempKey =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const res = await apiClient.post<ApiResponse<unknown>>(`/api/tournaments/${id}/register`, {}, {
      headers: { 'Idempotency-Key': idempKey },
    });
    return unwrap(res.data);
  },

  async unregisterTournament(id: string): Promise<unknown> {
    const idempKey =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const res = await apiClient.post<ApiResponse<unknown>>(`/api/tournaments/${id}/unregister`, {}, {
      headers: { 'Idempotency-Key': idempKey },
    });
    return unwrap(res.data);
  },

  async savePushSubscription(sub: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }): Promise<void> {
    await apiClient.post('/api/user/push-subscription', {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    });
  },

  async removePushSubscription(endpoint: string): Promise<void> {
    await apiClient.post('/api/user/push-subscription/remove', { endpoint });
  },

  // ─── Contact Us ──────────────────────────────────────────────────────────────

  async submitContactUs(req: ContactUsSubmitPayload): Promise<ContactUsSubmitResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.post<ApiResponse<any>>('/api/contact-us', req);
    const raw = unwrap(res.data);
    return { id: raw._id ?? raw.id ?? '' };
  },

  async getMyContactRequests(): Promise<ContactRequestItem[]> {
    const res = await apiClient.get<ApiResponse<any[]>>('/api/contact-us/mine');
    const raw = unwrap(res.data);
    return raw.map((item) => ({
      id: String(item._id ?? item.id ?? ''),
      type: item.type,
      message: String(item.message ?? ''),
      allGames: !!item.all_games,
      gameLabels: Array.isArray(item.game_labels) ? item.game_labels.map(String) : [],
      status: item.status,
      reviewResponse: String(item.public_response ?? item.admin_notes ?? ''),
      createdAt: String(item.createdAt ?? item.created_at ?? ''),
      updatedAt: String(item.updatedAt ?? item.updated_at ?? ''),
    }));
  },
};

function createIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTournament(raw: any): TournamentSummary {
  const serverNow = raw.serverNow ?? raw.server_now ?? new Date().toISOString();
  const startsAt = raw.startsAt ?? raw.starts_at ?? serverNow;
  const myReg = raw.myRegistration ?? raw.my_registration ?? null;
  const myMatch = raw.myActiveMatch ?? raw.my_active_match ?? null;
  return {
    id: String(raw.id ?? raw._id ?? ''),
    title: raw.title ?? '',
    description: raw.description ?? '',
    gameSocketCode: raw.gameSocketCode ?? raw.game_socket_code ?? '',
    status: raw.status ?? '',
    buyIn: raw.buyIn ?? raw.buy_in ?? 0,
    maxPlayers: raw.maxPlayers ?? raw.max_players ?? 0,
    registeredCount: raw.registeredCount ?? raw.registered_count ?? 0,
    startsAt,
    serverNow,
    remainingMs: raw.remainingMs ?? raw.remaining_ms ?? 0,
    pauseRemainingMs: raw.pauseRemainingMs ?? raw.pause_remaining_ms ?? null,
    turnTimerSeconds: raw.turnTimerSeconds ?? raw.turn_timer_seconds ?? 30,
    grossPrizePool: raw.grossPrizePool ?? raw.gross_prize_pool ?? 0,
    houseFeePercent: raw.houseFeePercent ?? raw.house_fee_percent ?? undefined,
    firstPlacePercent: raw.firstPlacePercent ?? raw.first_place_percent ?? undefined,
    secondPlacePercent: raw.secondPlacePercent ?? raw.second_place_percent ?? undefined,
    firstPlaceAmount: raw.firstPlaceAmount ?? raw.first_place_amount ?? undefined,
    secondPlaceAmount: raw.secondPlaceAmount ?? raw.second_place_amount ?? undefined,
    myRegistration: myReg
      ? {
          status: myReg.status ?? 'registered',
          seed: myReg.seed,
          groupNumber: myReg.groupNumber ?? myReg.group_number,
        }
      : null,
    myActiveMatch: myMatch
      ? {
          matchId: String(myMatch.matchId ?? myMatch.match_id ?? ''),
          status: myMatch.status ?? '',
          roomId: myMatch.roomId ?? myMatch.room_id ?? null,
          roundName: myMatch.roundName ?? myMatch.round_name ?? '',
          opponentUsername: myMatch.opponentUsername ?? myMatch.opponent_username ?? null,
          presenceCheckAt: myMatch.presenceCheckAt ?? myMatch.presence_check_at ?? null,
          canJoin: !!(myMatch.canJoin ?? myMatch.can_join),
          needsLobby: !!(myMatch.needsLobby ?? myMatch.needs_lobby),
        }
      : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBracketMatch(raw: any): TournamentBracketMatch {
  const mapPlayer = (p: any) =>
    p && (p.userId ?? p.user_id)
      ? {
          userId: String(p.userId ?? p.user_id),
          username: p.username ?? '',
        }
      : null;

  return {
    id: String(raw.id ?? raw._id ?? ''),
    groupNumber: raw.groupNumber ?? raw.group_number ?? null,
    phase: raw.phase ?? undefined,
    roundName: raw.roundName ?? raw.round_name ?? '',
    roundIndex: raw.roundIndex ?? raw.round_index ?? undefined,
    matchIndex: raw.matchIndex ?? raw.match_index ?? undefined,
    status: raw.status ?? '',
    playerA: mapPlayer(raw.playerA ?? raw.player_a),
    playerB: mapPlayer(raw.playerB ?? raw.player_b),
    winnerUserId: raw.winnerUserId ?? raw.winner_user_id ?? null,
    roomId: raw.roomId ?? raw.room_id ?? null,
    isBye: !!(raw.isBye ?? raw.is_bye),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTournamentBracket(raw: any): TournamentBracketResponse {
  const groups = (raw.groups ?? []).map((g: any) => ({
    groupNumber: g.groupNumber ?? g.group_number ?? 0,
    status: g.status ?? '',
    winnerUserId: g.winnerUserId ?? g.winner_user_id ?? null,
    participants: (g.participants ?? []).map((p: any) => ({
      userId: String(p.userId ?? p.user_id ?? ''),
      username: p.username ?? '',
      seed: p.seed ?? undefined,
      status: p.status ?? undefined,
    })),
  }));
  return {
    groups,
    groupMatches: (raw.groupMatches ?? raw.group_matches ?? []).map(normalizeBracketMatch),
    finalsMatches: (raw.finalsMatches ?? raw.finals_matches ?? []).map(normalizeBracketMatch),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTournamentHistory(raw: any): TournamentHistoryItem {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    title: raw.title ?? '',
    gameSocketCode: raw.gameSocketCode ?? raw.game_socket_code ?? '',
    status: raw.status ?? '',
    buyIn: raw.buyIn ?? raw.buy_in ?? 0,
    maxPlayers: raw.maxPlayers ?? raw.max_players ?? 0,
    registeredCount: raw.registeredCount ?? raw.registered_count ?? 0,
    grossPrizePool: raw.grossPrizePool ?? raw.gross_prize_pool ?? 0,
    houseFeePercent: raw.houseFeePercent ?? raw.house_fee_percent ?? undefined,
    firstPlacePercent: raw.firstPlacePercent ?? raw.first_place_percent ?? undefined,
    firstPlaceAmount: raw.firstPlaceAmount ?? raw.first_place_amount ?? undefined,
    secondPlaceAmount: raw.secondPlaceAmount ?? raw.second_place_amount ?? undefined,
    participantStatus: raw.participantStatus ?? raw.participant_status ?? '',
    finalRank: raw.finalRank ?? raw.final_rank ?? null,
    prizeAmount: raw.prizeAmount ?? raw.prize_amount ?? 0,
    finishedAt: raw.finishedAt ?? raw.finished_at ?? null,
    startedAt: raw.startedAt ?? raw.starts_at ?? raw.started_at ?? '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRoom(raw: any): RoomResponse {
  const players = (raw.players ?? []).map((p: any) => {
    const ref = p.playerId ?? p.user ?? p;
    return {
      id: ref._id ?? ref.id ?? '',
      username: ref.username ?? '',
    };
  });
  return {
    id: raw._id ?? raw.id ?? '',
    name: raw.name ?? '',
    players,
    betAmount: raw.bet_amount ?? 0,
    status: (raw.status ?? raw.roomStatus ?? raw.room_status ?? '').toLowerCase(),
    spectatorsCount: raw.spectatorsCount ?? raw.spectators_count ?? 0,
    gameId: raw.game_id?._id ?? raw.game_id ?? undefined,
    // Phase C: populated game lets the PWA build the play URL on its own — needed
    // by the "active room" deep-link on app boot to know which `/play/<code>` to open.
    socketCode: raw.game_id?.socket_code ?? raw.socketCode ?? undefined,
    playerLimit: raw.player_limit ?? raw.playerLimit ?? raw.maxPlayers ?? 2,
  };
}

export function normalizeRoomState(raw: any): RoomStateResponse {
  const players: RoomPlayer[] = (raw.players ?? []).map((player: any) => {
    const ref = player.playerId ?? player.user ?? player;
    return {
      id: String(ref._id ?? ref.id ?? ''),
      username: ref.username ?? '',
    };
  });
  return {
    roomId: String(raw.roomId ?? raw.room_id ?? raw._id ?? raw.id ?? ''),
    gameId: String(raw.gameId ?? raw.game_id?._id ?? raw.game_id ?? ''),
    gameSocketCode:
      raw.gameSocketCode ?? raw.game_socket_code ?? raw.game_id?.socket_code ?? '',
    status: String(raw.status ?? '').toLowerCase(),
    players,
    currentPlayers: raw.currentPlayers ?? raw.current_players ?? players.length,
    requiredPlayers:
      raw.requiredPlayers ?? raw.required_players ?? raw.playerLimit ?? raw.player_limit ?? 2,
    isCurrentUserInRoom:
      raw.isCurrentUserInRoom ?? raw.is_current_user_in_room ?? false,
    canEnterPlay: raw.canEnterPlay ?? raw.can_enter_play ?? false,
    playPath: raw.playPath ?? raw.play_path ?? null,
    betAmount: raw.betAmount ?? raw.bet_amount ?? 0,
    roomName: raw.roomName ?? raw.room_name ?? raw.name ?? '',
    updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
    startedAt: raw.startedAt ?? raw.started_at ?? null,
  };
}
