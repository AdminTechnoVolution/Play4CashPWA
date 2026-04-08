export interface GameContext {
  gameId: string;
  gameName: string;
}

export interface PlayContext {
  roomId: string;
  betAmount: number;
  roomName: string;
  opponentName: string;
  hasOpponent: boolean;
  isSpectator: boolean;
  isPlayer1: boolean;
}

const GAME_CTX_KEY = 'p4c_game_context';
const PLAY_CTX_KEY = 'p4c_play_context';

export const saveGameContext = (ctx: GameContext) => {
  sessionStorage.setItem(GAME_CTX_KEY, JSON.stringify(ctx));
};

export const getGameContext = (): GameContext | null => {
  try {
    const raw = sessionStorage.getItem(GAME_CTX_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const savePlayContext = (ctx: PlayContext) => {
  sessionStorage.setItem(PLAY_CTX_KEY, JSON.stringify(ctx));
};

export const getPlayContext = (): PlayContext | null => {
  try {
    const raw = sessionStorage.getItem(PLAY_CTX_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const clearPlayContext = () => {
  sessionStorage.removeItem(PLAY_CTX_KEY);
};

export const clearRoutingContext = () => {
  sessionStorage.removeItem(GAME_CTX_KEY);
  sessionStorage.removeItem(PLAY_CTX_KEY);
};
