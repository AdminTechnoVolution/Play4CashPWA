export type ConnectFourDisc = 'R' | 'Y';
export type ConnectFourCell = ConnectFourDisc | null;

export interface ConnectFourPlayerState {
  userId: string;
  username: string;
  color: ConnectFourDisc;
  connected: boolean;
}

export interface ConnectFourMove {
  userId: string;
  row: number;
  col: number;
  color: ConnectFourDisc;
  at: string;
}

export interface ConnectFourGameState {
  roomId: string;
  status: 'waiting' | 'started' | 'finished';
  board: ConnectFourCell[][];
  players: ConnectFourPlayerState[];
  currentTurnUserId: string | null;
  winnerUserId: string | null;
  winningCells: Array<{ row: number; col: number }>;
  isDraw: boolean;
  lastMove?: ConnectFourMove;
  turnDeadlineAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConnectFourGameOverPayload {
  reason: 'win' | 'draw' | 'timeout' | 'forfeit';
  winnerUserId: string | null;
  winningCells: Array<{ row: number; col: number }>;
  state: ConnectFourGameState;
}

/** Socket envelope from API namespace `/connect-four`. */
export interface ConnectFourSocketEnvelope {
  success?: boolean;
  messages?: string[];
  data?: Record<string, unknown>;
}
