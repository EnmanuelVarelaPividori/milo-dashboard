import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type AppRole = 'admin' | 'developer';

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: AppRole;
};

export type DiscordAuthConfig = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  sessionSecret: string;
  adminIds: Set<string>;
  developerIds: Set<string>;
  secureCookies: boolean;
};

const SESSION_COOKIE = 'milo_dashboard_session';
const OAUTH_STATE_COOKIE = 'milo_dashboard_oauth_state';

function parseIdList(value: string | undefined) {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function getDiscordAuthConfig(env = process.env): DiscordAuthConfig {
  const clientId = env.DISCORD_CLIENT_ID ?? '';
  const clientSecret = env.DISCORD_CLIENT_SECRET ?? '';
  const baseUrl = (env.BASE_URL ?? '').replace(/\/$/, '');
  const sessionSecret = env.SESSION_SECRET ?? '';
  const adminIds = parseIdList(env.DISCORD_ADMIN_IDS);
  const developerIds = parseIdList(env.DISCORD_DEVELOPER_IDS);
  const secureCookies = baseUrl.startsWith('https://');

  return {
    enabled: Boolean(clientId && clientSecret && baseUrl && sessionSecret),
    clientId,
    clientSecret,
    baseUrl,
    sessionSecret,
    adminIds,
    developerIds,
    secureCookies,
  };
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getOauthStateCookieName() {
  return OAUTH_STATE_COOKIE;
}

export function parseCookieHeader(cookieHeader?: string) {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (!name) continue;
    cookies[name] = decodeURIComponent(rest.join('='));
  }

  return cookies;
}

function signPayload(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function createSignedToken(payload: object, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signPayload(encoded, secret);
  return `${encoded}.${signature}`;
}

export function verifySignedToken<T>(token: string, secret: string): T | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = signPayload(encoded, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function serializeCookie(name: string, value: string, options: {
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
  path?: string;
} = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path ?? '/'}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly ?? true) parts.push('HttpOnly');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildDiscordOauthUrl(config: DiscordAuthConfig, state: string) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: getDiscordRedirectUri(config),
    scope: 'identify',
    state,
    prompt: 'consent',
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export function getDiscordRedirectUri(config: DiscordAuthConfig) {
  return `${config.baseUrl}/auth/discord/callback`;
}

export function createOauthState() {
  return randomBytes(24).toString('base64url');
}

export async function exchangeDiscordCode(config: DiscordAuthConfig, code: string) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: getDiscordRedirectUri(config),
  });

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`discord_token_exchange_failed:${response.status}`);
  }

  return (await response.json()) as { access_token: string };
}

export async function fetchDiscordUser(accessToken: string) {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`discord_user_fetch_failed:${response.status}`);
  }

  return (await response.json()) as {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
  };
}

export function resolveRole(config: DiscordAuthConfig, discordUserId: string): AppRole | null {
  if (config.adminIds.has(discordUserId)) return 'admin';
  if (config.developerIds.has(discordUserId)) return 'developer';
  return null;
}

export function toAuthUser(config: DiscordAuthConfig, discordUser: {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}): AuthUser | null {
  const role = resolveRole(config, discordUser.id);
  if (!role) return null;

  const avatarUrl = discordUser.avatar
    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
    : null;

  return {
    id: discordUser.id,
    username: discordUser.username,
    displayName: discordUser.global_name || discordUser.username,
    avatarUrl,
    role,
  };
}
