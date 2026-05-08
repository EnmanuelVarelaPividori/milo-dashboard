import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AuthUser } from '../lib/auth.js';

const execFileAsync = promisify(execFile);

export type ChatReply = {
  reply: string;
  meta?: {
    sessionId?: string;
    durationMs?: number;
    model?: string;
    provider?: string;
  };
};

export type ChatService = {
  sendMessage(input: { user: AuthUser; message: string; conversationId?: string }): Promise<ChatReply>;
};

type OpenClawAgentResponse = {
  status?: string;
  result?: {
    payloads?: Array<{ text?: string | null; mediaUrl?: string | null }>;
    meta?: {
      durationMs?: number;
      agentMeta?: {
        sessionId?: string;
        model?: string;
        provider?: string;
      };
    };
    finalAssistantVisibleText?: string;
  };
};

export function buildSessionId(userId: string, conversationId?: string) {
  const base = `webchat-discord-${userId}`;
  if (!conversationId) return base;

  const safeConversationId = conversationId.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64);
  return safeConversationId ? `${base}-${safeConversationId}` : base;
}

function extractReply(payload: OpenClawAgentResponse): ChatReply {
  const result = payload.result;
  const reply =
    result?.finalAssistantVisibleText?.trim() ||
    result?.payloads
      ?.map((item) => item.text?.trim())
      .filter((value): value is string => Boolean(value))
      .join('\n\n') ||
    'Milo no devolvió texto.';

  return {
    reply,
    meta: {
      sessionId: result?.meta?.agentMeta?.sessionId,
      durationMs: result?.meta?.durationMs,
      model: result?.meta?.agentMeta?.model,
      provider: result?.meta?.agentMeta?.provider,
    },
  };
}

export function createOpenClawChatService(): ChatService {
  return {
    async sendMessage({ user, message, conversationId }) {
      const args = [
        'agent',
        '--agent',
        'milo',
        '--session-id',
        buildSessionId(user.id, conversationId),
        '--thinking',
        'off',
        '--timeout',
        '90',
        '--message',
        message,
        '--json',
      ];

      try {
        const { stdout } = await execFileAsync('openclaw', args, {
          cwd: '/home/manu/.openclaw/workspace-milo',
          timeout: 95_000,
          maxBuffer: 10 * 1024 * 1024,
          env: process.env,
        });

        const payload = JSON.parse(stdout) as OpenClawAgentResponse;
        return extractReply(payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown_chat_error';
        throw new Error(`chat_service_failed:${message}`);
      }
    },
  };
}
