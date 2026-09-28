export type Message =
  | { type: 'syncLinks'; sourceIds?: string[] }
  | { type: 'refreshCardDb' }
  | { type: 'registerGenericScripts' }
  | { type: 'dev'; action: string };

export interface MessageResult {
  ok: boolean;
  error?: string;
  /** Dev-bridge replies only. */
  data?: unknown;
}

export function sendMessage(message: Message): Promise<MessageResult> {
  return chrome.runtime.sendMessage(message);
}
