import type { ChatMessage } from '../data/models/ApiModels';

export type ChatGreetingOverlay =
  | { type: 'FromOpponent'; from: string; text: string }
  | { type: 'YouSent'; text: string };

/** Floating incoming line (UNO-style): opponent overlay or last chat message with sender. */
export function formatIncomingFloatingGreeting(
  overlay: ChatGreetingOverlay | null | undefined,
  lastMsg: ChatMessage | null | undefined,
): string {
  if (overlay?.type === 'FromOpponent') {
    return `${overlay.from}: ${overlay.text}`;
  }
  const text = lastMsg?.text?.trim();
  if (!text) return '';
  const from = (lastMsg?.from ?? '').trim();
  return from ? `${from}: ${text}` : text;
}

export type ParsedChatEnvelope =
  | { type: 'Incoming'; from: string; text: string }
  | { type: 'Sent'; text: string }
  | { type: 'Failure'; message: string; refreshGreetings: boolean }
  | { type: 'Ignored' };

export const parseChatEnvelope = (json: any): ParsedChatEnvelope => {
  if (json.success === false) {
    const msg = (json.messages && json.messages[0]) || json.message || "";
    const refresh = msg.toLowerCase().includes("greetingnotfound");
    return {
      type: 'Failure',
      message: msg || "chat_error",
      refreshGreetings: refresh,
    };
  }
  const data = json.data;
  if (!data) return { type: 'Ignored' };

  switch (data.type) {
    case "greeting": {
      const text = (data.text || "").toString().trim();
      if (!text) return { type: 'Ignored' };
      return { type: 'Incoming', from: data.from || "", text };
    }
    case "greeting_sent": {
      const text = (data.text || "").toString().trim();
      if (!text) return { type: 'Ignored' };
      return { type: 'Sent', text };
    }
    default:
      return { type: 'Ignored' };
  }
};
