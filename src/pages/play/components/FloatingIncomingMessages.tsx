import { useEffect, useRef, useState } from 'react';
import './FloatingIncomingMessages.css';

type FloatingItem = { id: string; text: string };

interface Props {
  /** Latest incoming line to show; empty string ignores. */
  message: string;
  /** When false, clears the queue (e.g. left the game). */
  active?: boolean;
}

const LIFETIME_MS = 3600;

/**
 * Incoming chat/greeting lines that rise from the bottom and fade out — text only, no chip background.
 */
export default function FloatingIncomingMessages({ message, active = true }: Props) {
  const [items, setItems] = useState<FloatingItem[]>([]);
  const lastEnqueuedRef = useRef('');

  useEffect(() => {
    if (!active) {
      setItems([]);
      lastEnqueuedRef.current = '';
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const text = message.trim();
    if (!text || text === lastEnqueuedRef.current) return;
    lastEnqueuedRef.current = text;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((prev) => [...prev, { id, text }]);

    const remove = window.setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, LIFETIME_MS);

    const dedupe = window.setTimeout(() => {
      if (lastEnqueuedRef.current === text) lastEnqueuedRef.current = '';
    }, 400);

    return () => {
      window.clearTimeout(remove);
      window.clearTimeout(dedupe);
    };
  }, [message, active]);

  if (items.length === 0) return null;

  return (
    <div className="floating-incoming-messages" aria-live="polite">
      {items.map((item) => (
        <p key={item.id} className="floating-incoming-messages__line">
          {item.text}
        </p>
      ))}
    </div>
  );
}
