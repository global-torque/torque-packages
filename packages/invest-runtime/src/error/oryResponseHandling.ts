import { toast } from 'vue-sonner';
import type { IAuthFlow } from '@webdevelop-pro/domain-types/authTypes';
import { h } from 'vue';

/** Ory UI message (API may return this on flow response). */
interface OryUIMessage {
  type?: string;
  text?: string;
  context?: Record<string, unknown>;
}

/** Response shape with optional ui.messages (Ory can return messages at top level). */
type AuthFlowWithMessages = IAuthFlow & { ui?: IAuthFlow['ui'] & { messages?: OryUIMessage[] } };

/** Escape for safe use in HTML (XSS). */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Handles successful Ory auth flow responses that contain UI messages or special states.
 * Call from ViewModel/guard after successful auth flow fetch — not from repository.
 */
export const oryResponseHandling = (response: IAuthFlow) => {
  const ui = (response as AuthFlowWithMessages).ui;
  const messages = ui?.messages ?? [];

  const duplicateMessage = messages.find((m: OryUIMessage) =>
    m.text?.includes('already used by another account')
    || m.context?.duplicate_identifier
  );

  if (duplicateMessage) {
    const duplicateIdentifier = duplicateMessage.context?.duplicate_identifier
      ?? duplicateMessage.context?.duplicateIdentifier;
    if (!duplicateIdentifier) return;

    const raw = String(duplicateIdentifier);
    const safe = escapeHtml(raw);
    const emailParam = encodeURIComponent(raw);

    toast.info('Account Already Exists', {
      description: () => h('div', {
        innerHTML: `Sorry, your email ${safe} already used, do you want to <a href="/signin?email=${emailParam}">log in</a>?`,
      }),
      duration: 8000,
    });
    return;
  }

  const infoMessages = messages.filter((m: OryUIMessage) => m.type === 'info');
  if (infoMessages.length > 0) {
    const text = infoMessages[0]?.text;
    if (text) {
      toast.info('Authentication Information', {
        description: escapeHtml(text),
      });
    }
  }
};
