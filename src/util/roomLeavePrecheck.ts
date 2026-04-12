import type { RoomStatusResponse, UserAccountResponse } from '../data/models/ApiModels';

/**
 * Maps API `winnerReason` to an i18n key (`_won` / `_lost` suffix), mirroring Android
 * `RoomLeavePrecheck.kt` → `appStringKeyForWinnerReason`.
 */
export function appStringKeyForWinnerReason(apiReason: string | undefined, isWinner: boolean): string {
  const suffix = isWinner ? '_won' : '_lost';
  const r = apiReason?.trim().toLowerCase() ?? '';
  if (!r) return `room_winner_reason_unknown${suffix}`;
  const base = (() => {
    switch (r) {
      case 'playing':
        return 'room_winner_reason_playing';
      case 'forfeit':
        return 'room_winner_reason_forfeit';
      case 'timeout':
        return 'room_winner_reason_timeout';
      case 'win':
        return 'room_winner_reason_win';
      case 'checkmate':
      case 'check_mate':
      case 'check-mate':
        return 'room_winner_reason_checkmate';
      case 'stalemate':
        return 'room_winner_reason_stalemate';
      case 'insufficient_material':
        return 'room_winner_reason_insufficient_material';
      default:
        return 'room_winner_reason_unknown';
    }
  })();
  return base + suffix;
}

/** Room already settled: non-empty winner and terminal status (Android precheck uses `finished`; API may also send synonyms). */
export function isRoomTerminalWithWinner(status: Pick<RoomStatusResponse, 'status' | 'winner'>): boolean {
  const s = status.status?.trim().toLowerCase() ?? '';
  if (s !== 'finished' && s !== 'completed' && s !== 'game_over') return false;
  return (status.winner?.trim() ?? '').length > 0;
}

function isWinnerCurrentUser(winner: string | undefined, me: UserAccountResponse | null): boolean | null {
  const w = winner?.trim();
  if (!w || !me) return null;
  const wl = w.toLowerCase();
  return wl === me.id.trim().toLowerCase() || wl === me.username.trim().toLowerCase();
}

export type FinishedLeaveDialogText = { title: string; message: string };

/**
 * Same copy structure as Android `RoomFinishedOnLeaveDialog`: title + primary line + muted reason line.
 */
export function buildFinishedLeaveDialogText(
  status: RoomStatusResponse,
  me: UserAccountResponse | null,
  t: (key: string) => string,
): FinishedLeaveDialogText | null {
  if (!isRoomTerminalWithWinner(status)) return null;

  const won = isWinnerCurrentUser(status.winner, me);
  const isWinner = won === true;

  const title = t(isWinner ? 'room_leave_finished_won_title' : 'room_leave_finished_lost_title');
  const primary = t(isWinner ? 'room_leave_finished_won_message' : 'room_leave_finished_lost_message');
  const reason = t(appStringKeyForWinnerReason(status.winnerReason, isWinner));
  return { title, message: `${primary}\n\n${reason}` };
}
