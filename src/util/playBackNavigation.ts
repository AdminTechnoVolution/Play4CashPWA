type PlayBackConsumer = () => boolean;

const consumers: PlayBackConsumer[] = [];

export function registerPlayBackConsumer(fn: PlayBackConsumer): () => void {
  consumers.push(fn);
  return () => {
    const i = consumers.lastIndexOf(fn);
    if (i >= 0) consumers.splice(i, 1);
  };
}

/** @returns true if a child screen handled back (e.g. closed a modal). */
export function tryConsumePlayBack(): boolean {
  for (let i = consumers.length - 1; i >= 0; i--) {
    try {
      if (consumers[i]()) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/** History state key for the synthetic entry that lets the first OS/gesture "back" stay on /play. */
export const PLAY_BACK_TRAP_KEY = 'play4cashBackTrap';

/** After {@link clearPlayContext}, pop the trap entry (if any) then navigate back once. */
export function consumePlayBackTrapThenNavigate(navigateBack: () => void): void {
  if ((window.history.state as Record<string, unknown> | null)?.[PLAY_BACK_TRAP_KEY]) {
    window.history.go(-1);
    setTimeout(navigateBack, 0);
  } else {
    navigateBack();
  }
}
