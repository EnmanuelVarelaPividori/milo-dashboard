import Fastify from 'fastify';
import { z } from 'zod';
import { checkDbConnection } from './lib/db.js';
import {
  buildDiscordOauthUrl,
  createOauthState,
  createSignedToken,
  exchangeDiscordCode,
  fetchDiscordUser,
  getDiscordAuthConfig,
  getOauthStateCookieName,
  getSessionCookieName,
  parseCookieHeader,
  serializeCookie,
  toAuthUser,
  verifySignedToken,
  type AuthUser,
} from './lib/auth.js';
import { createPostgresStore, type DashboardStore, type DashboardSummary } from './lib/store.js';

type BuildAppOptions = {
  store?: DashboardStore;
  dbHealthcheck?: () => Promise<void>;
};

const createJobSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  schedule: z.string().min(1),
  enabled: z.boolean().optional(),
  nextRunAt: z.string().datetime().nullable().optional(),
});

const createJobRunSchema = z.object({
  jobKey: z.string().min(1),
  status: z.string().min(1),
  summary: z.string().optional(),
  error: z.string().optional(),
  finishedAt: z.string().datetime().nullable().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

const limitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const chatBodySchema = z.object({
  message: z.string().min(1).max(4000),
});

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderLayout({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #07111f;
        --panel: rgba(15, 23, 42, 0.92);
        --panel-2: rgba(30, 41, 59, 0.72);
        --line: rgba(148, 163, 184, 0.18);
        --text: #e2e8f0;
        --muted: #94a3b8;
        --ok: #22c55e;
        --warn: #f59e0b;
        --error: #ef4444;
        --accent: #60a5fa;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        background: radial-gradient(circle at top, rgba(96, 165, 250, 0.22), transparent 35%), var(--bg);
        color: var(--text);
      }
      a { color: inherit; }
      .shell {
        width: min(1200px, calc(100% - 32px));
        margin: 0 auto;
        padding: 16px 0 56px;
      }
      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 8px;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
        text-decoration: none;
      }
      .brand-badge {
        width: 32px;
        height: 32px;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #2563eb, #7c3aed);
      }
      .nav {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        width: 100%;
        justify-content: flex-end;
      }
      .nav-group {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .nav-group.primary {
        margin-right: auto;
      }
      .nav-link, .ghost-button, .login-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: 999px;
        padding: 10px 14px;
        border: 1px solid var(--line);
        background: rgba(15, 23, 42, 0.55);
        color: var(--text);
        text-decoration: none;
        font: inherit;
        cursor: pointer;
      }
      .nav-link.active {
        border-color: rgba(96, 165, 250, 0.45);
        color: #bfdbfe;
      }
      .role-badge {
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: rgba(96, 165, 250, 0.14);
        color: #bfdbfe;
        border: 1px solid rgba(96, 165, 250, 0.32);
      }
      .profile-menu {
        position: relative;
      }
      .profile-summary {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        border-radius: 999px;
        padding: 8px 12px;
        border: 1px solid var(--line);
        background: rgba(15, 23, 42, 0.55);
        cursor: pointer;
        user-select: none;
      }
      .profile-summary::after {
        content: '▾';
        color: var(--muted);
        font-size: 0.8rem;
      }
      .profile-name {
        font-weight: 600;
      }
      .profile-dropdown {
        position: absolute;
        right: 0;
        top: calc(100% + 10px);
        min-width: 180px;
        padding: 8px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(2, 6, 23, 0.97);
        box-shadow: 0 18px 40px rgba(2, 6, 23, 0.42);
        display: none;
        z-index: 20;
      }
      .profile-menu.open .profile-dropdown {
        display: block;
      }
      .dropdown-link {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 10px 12px;
        border-radius: 12px;
        color: var(--text);
        text-decoration: none;
      }
      .dropdown-link:hover {
        background: rgba(30, 41, 59, 0.75);
      }
      .dropdown-button {
        all: unset;
        cursor: pointer;
      }
      .panel, .card {
        border: 1px solid var(--line);
        background: var(--panel);
        border-radius: 20px;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.24);
      }
      .card {
        padding: 20px;
        display: block;
        color: inherit;
        text-decoration: none;
      }
      .hero {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
        margin-bottom: 18px;
      }
      .hero h1 {
        margin: 0 0 8px;
        font-size: clamp(2rem, 5vw, 3rem);
      }
      .hero p { margin: 0; color: var(--muted); max-width: 720px; }
      .hero-side {
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: flex-end;
        min-width: 220px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
        margin-bottom: 16px;
      }
      .card h2 {
        margin: 0 0 10px;
        font-size: 0.95rem;
        color: var(--muted);
        font-weight: 600;
      }
      .metric {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }
      .metric strong {
        font-size: clamp(2rem, 3vw, 2.8rem);
      }
      .metric span { color: var(--muted); }
      .layout {
        display: grid;
        grid-template-columns: 1.3fr 0.9fr;
        gap: 16px;
      }
      .stack { display: grid; gap: 16px; }
      .panel { padding: 20px; }
      .panel h3 { margin: 0 0 6px; font-size: 1.05rem; }
      .panel p.lead { margin: 0 0 18px; color: var(--muted); }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.95rem;
      }
      th, td {
        padding: 12px 10px;
        text-align: left;
        border-top: 1px solid var(--line);
        vertical-align: top;
      }
      th {
        color: var(--muted);
        font-weight: 600;
        border-top: 0;
        padding-top: 0;
      }
      .notifications {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 12px;
      }
      .notification {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        padding: 14px;
        border-radius: 16px;
        background: var(--panel-2);
        border: 1px solid transparent;
      }
      .notification.error { border-color: rgba(239, 68, 68, 0.35); }
      .notification.warning { border-color: rgba(245, 158, 11, 0.35); }
      .notification.ok { border-color: rgba(34, 197, 94, 0.35); }
      .notification p {
        margin: 6px 0 0;
        color: var(--muted);
      }
      .notification span {
        color: var(--muted);
        font-size: 0.85rem;
        white-space: nowrap;
      }
      .integration-card {
        border: 1px solid var(--line);
        background: rgba(15, 23, 42, 0.7);
        border-radius: 999px;
        padding: 8px 12px;
      }
      .integration-list {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .integration-item {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .integration-label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
        font-weight: 600;
      }
      .integration-logo {
        width: 18px;
        height: 18px;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.72rem;
        font-weight: 700;
        color: white;
      }
      .integration-logo.jira { background: linear-gradient(135deg, #2563eb, #60a5fa); }
      .integration-logo.github { background: linear-gradient(135deg, #111827, #374151); }
      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        display: inline-block;
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.04);
      }
      .status-dot.green { background: var(--ok); }
      .status-dot.yellow { background: var(--warn); }
      .status-dot.red { background: var(--error); }
      .integration-tooltip {
        position: absolute;
        top: calc(100% + 10px);
        right: 0;
        width: 220px;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: rgba(2, 6, 23, 0.96);
        color: var(--text);
        opacity: 0;
        transform: translateY(-4px);
        pointer-events: none;
        transition: opacity 140ms ease, transform 140ms ease;
        box-shadow: 0 18px 40px rgba(2, 6, 23, 0.42);
        z-index: 10;
      }
      .integration-tooltip strong {
        display: block;
        margin-bottom: 6px;
        font-size: 0.85rem;
      }
      .integration-tooltip ul {
        margin: 0;
        padding-left: 16px;
        color: var(--muted);
        font-size: 0.82rem;
      }
      .integration-item.github:hover .integration-tooltip {
        opacity: 1;
        transform: translateY(0);
      }
      .footer {
        margin-top: 20px;
        color: var(--muted);
        font-size: 0.9rem;
      }
      .jobs-section { margin-top: 16px; }
      .section-link { scroll-margin-top: 24px; }
      .empty {
        color: var(--muted);
        text-align: center;
      }
      .login-shell, .chat-shell {
        width: min(960px, calc(100% - 32px));
        margin: 0 auto;
      }
      .login-panel {
        max-width: 520px;
        margin: 80px auto 0;
        padding: 28px;
      }
      .login-panel p {
        color: var(--muted);
        line-height: 1.5;
      }
      .login-button {
        margin-top: 14px;
        background: linear-gradient(135deg, #5865f2, #7289da);
        border: 0;
        color: white;
      }
      .muted-note {
        margin-top: 12px;
        color: var(--muted);
        font-size: 0.92rem;
      }
      .error-banner {
        margin-top: 16px;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid rgba(239, 68, 68, 0.4);
        background: rgba(127, 29, 29, 0.22);
        color: #fecaca;
      }
      .chat-layout {
        display: grid;
        grid-template-columns: 280px 1fr;
        gap: 16px;
      }
      .chat-feed {
        display: grid;
        gap: 12px;
        min-height: 420px;
        max-height: 60vh;
        overflow: auto;
        padding-right: 6px;
      }
      .message {
        padding: 14px 16px;
        border-radius: 16px;
        background: var(--panel-2);
        border: 1px solid var(--line);
      }
      .message.user {
        background: rgba(37, 99, 235, 0.18);
        border-color: rgba(96, 165, 250, 0.24);
      }
      .message strong {
        display: block;
        margin-bottom: 6px;
      }
      .chat-form {
        display: grid;
        gap: 12px;
        margin-top: 16px;
      }
      textarea {
        width: 100%;
        min-height: 100px;
        resize: vertical;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(2, 6, 23, 0.75);
        color: var(--text);
        padding: 14px 16px;
        font: inherit;
      }
      .chat-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      .avatar {
        width: 36px;
        height: 36px;
        border-radius: 999px;
        object-fit: cover;
        border: 1px solid var(--line);
      }
      code {
        font-family: 'SFMono-Regular', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.88em;
      }
      @media (max-width: 960px) {
        .grid, .layout, .chat-layout { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 720px) {
        .topbar, .hero { flex-direction: column; align-items: flex-start; }
        .hero-side { align-items: flex-start; }
        .nav, .nav-group { align-items: flex-start; }
        .grid, .layout, .chat-layout { grid-template-columns: 1fr; }
        .notification { flex-direction: column; }
        .notification span { white-space: normal; }
        .chat-actions { flex-direction: column; align-items: stretch; }
      }
    </style>
  </head>
  <body>${body}
    <script>
      document.querySelectorAll('.profile-menu').forEach((menu) => {
        const trigger = menu.querySelector('.profile-summary');
        if (!trigger) return;

        trigger.addEventListener('click', (event) => {
          event.stopPropagation();
          const isOpen = menu.classList.contains('open');
          document.querySelectorAll('.profile-menu.open').forEach((item) => {
            item.classList.remove('open');
            const btn = item.querySelector('.profile-summary');
            if (btn) btn.setAttribute('aria-expanded', 'false');
          });
          if (!isOpen) {
            menu.classList.add('open');
            trigger.setAttribute('aria-expanded', 'true');
          }
        });
      });

      document.addEventListener('click', () => {
        document.querySelectorAll('.profile-menu.open').forEach((menu) => {
          menu.classList.remove('open');
          const btn = menu.querySelector('.profile-summary');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        });
      });
    </script>
  </body>
</html>`;
}

function renderTopbar(user: AuthUser | null, current: 'dashboard' | 'chat' | 'login') {
  const navLinks = user
    ? `
      <div class="nav-group primary">
        <a class="nav-link ${current === 'dashboard' ? 'active' : ''}" href="/">Dashboard</a>
        <a class="nav-link ${current === 'chat' ? 'active' : ''}" href="/chat">Chat</a>
      </div>
      <div class="nav-group">
        ${renderIntegrationPanel()}
        <div class="profile-menu">
          <button class="profile-summary dropdown-button" type="button" aria-haspopup="menu" aria-expanded="false">
            <span class="profile-name">${escapeHtml(user.displayName)}</span>
            <span class="role-badge">${escapeHtml(user.role)}</span>
          </button>
          <div class="profile-dropdown">
            <a class="dropdown-link" href="/auth/logout">Salir</a>
          </div>
        </div>
      </div>
    `
    : current === 'login'
      ? ''
      : '<a class="nav-link" href="/login">Entrar</a>';

  return `
    <header class="shell topbar">
      <a class="brand" href="/">
        <span class="brand-badge">🦉</span>
        <span>Milo Dashboard</span>
      </a>
      <nav class="nav">${navLinks}</nav>
    </header>
  `;
}

function renderIntegrationPanel() {
  return `
    <div class="integration-card">
      <div class="integration-list">
        <div class="integration-item">
          <div class="integration-label">
            <span class="integration-logo jira">J</span>
            <span>Jira</span>
          </div>
          <span class="status-dot yellow" title="Pendiente"></span>
        </div>
        <div class="integration-item github">
          <div class="integration-label">
            <span class="integration-logo github">GH</span>
            <span>GitHub</span>
          </div>
          <span class="status-dot yellow" title="Pendiente"></span>
          <div class="integration-tooltip">
            <strong>Repos conectados</strong>
            <ul>
              <li>LUN-FastAPI</li>
              <li>milo-dashboard</li>
              <li>otro-repo-placeholder</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderDashboardPage(summary: DashboardSummary, user: AuthUser | null) {
  const jobsRows = summary.recentJobs.length
    ? summary.recentJobs
        .map(
          (job) => `
            <tr>
              <td>${escapeHtml(job.name)}</td>
              <td><code>${escapeHtml(job.key)}</code></td>
              <td>${job.enabled ? 'Activo' : 'Pausado'}</td>
              <td>${job.nextRunAt ? escapeHtml(new Date(job.nextRunAt).toLocaleString('es-AR')) : '—'}</td>
            </tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="empty">Todavía no hay jobs cargados.</td></tr>';

  const ticketRows = summary.recentTicketRuns.length
    ? summary.recentTicketRuns
        .map(
          (ticket) => `
            <tr>
              <td>${escapeHtml(ticket.jiraKey)}</td>
              <td>${escapeHtml(ticket.jiraSummary ?? 'Sin resumen')}</td>
              <td>${escapeHtml(ticket.dispatchStatus)}</td>
              <td>${ticket.branchName ? `<code>${escapeHtml(ticket.branchName)}</code>` : '—'}</td>
            </tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="empty">Todavía no hay tickets procesados.</td></tr>';

  const notifications = summary.recentNotifications.length
    ? summary.recentNotifications
        .map(
          (notification) => `
            <li class="notification ${escapeHtml(notification.severity)}">
              <div>
                <strong>${escapeHtml(notification.title)}</strong>
                <p>${escapeHtml(notification.detail)}</p>
              </div>
              <span>${escapeHtml(new Date(notification.occurredAt).toLocaleString('es-AR'))}</span>
            </li>`,
        )
        .join('')
    : '<li class="notification ok"><div><strong>Todo tranquilo</strong><p>No hay errores recientes.</p></div><span>—</span></li>';

  return renderLayout({
    title: 'Milo Dashboard',
    body: `
      ${renderTopbar(user, 'dashboard')}
      <main class="shell">
        <section class="hero">
          <div>
            <h1>Milo Dashboard</h1>
            <p>Vista principal con métricas de tickets tomados, resultados, jobs activos y alertas para revisar rápido cómo viene la operación.</p>
          </div>
        </section>

        <section class="grid">
          <article class="card">
            <h2>Tickets agarrados</h2>
            <div class="metric"><strong>${summary.totals.ticketsTaken}</strong><span>Total histórico</span></div>
          </article>
          <article class="card">
            <h2>Salieron bien</h2>
            <div class="metric"><strong>${summary.totals.ticketsSucceeded}</strong><span>${summary.totals.successRate}% success rate</span></div>
          </article>
          <article class="card">
            <h2>Con error</h2>
            <div class="metric"><strong>${summary.totals.ticketsFailed}</strong><span>${summary.totals.failedJobRuns} job runs fallidos</span></div>
          </article>
          <a class="card" href="#jobs-configurados">
            <h2>Jobs</h2>
            <div class="metric"><strong>${summary.totals.activeJobs}/${summary.totals.jobs}</strong><span>${summary.totals.jobRuns} ejecuciones</span></div>
          </a>
        </section>

        <section class="layout">
          <div class="stack">
            <article class="panel">
              <h3>Actividad reciente de tickets</h3>
              <p class="lead">Últimos tickets que agarró el flujo y cómo quedaron.</p>
              <table>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Resumen</th>
                    <th>Estado</th>
                    <th>Branch</th>
                  </tr>
                </thead>
                <tbody>${ticketRows}</tbody>
              </table>
            </article>
          </div>

          <aside class="stack">
            <article class="panel">
              <h3>Notificaciones</h3>
              <p class="lead">Errores o cosas que merecen una mirada manual.</p>
              <ul class="notifications">${notifications}</ul>
            </article>
          </aside>
        </section>

        <section id="jobs-configurados" class="panel jobs-section section-link">
          <h3>Jobs configurados</h3>
          <p class="lead">Qué jobs están activos y cuándo deberían volver a correr.</p>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Key</th>
                <th>Estado</th>
                <th>Próxima corrida</th>
              </tr>
            </thead>
            <tbody>${jobsRows}</tbody>
          </table>
        </section>

        <p class="footer">APIs disponibles: <code>/api/dashboard</code>, <code>/api/jobs</code>, <code>/api/job-runs</code>, <code>/api/ticket-runs</code>, <code>/api/chat</code>, <code>/api/me</code>, <code>/health</code>, <code>/ready</code>.</p>
      </main>
    `,
  });
}

function renderLoginPage({ authEnabled, error }: { authEnabled: boolean; error?: string }) {
  const errorText =
    error === 'not_allowed'
      ? 'Tu usuario de Discord no está en la whitelist de Milo Dashboard.'
      : error === 'oauth_failed'
        ? 'Falló el login con Discord. Revisá configuración o credenciales.'
        : error === 'invalid_state'
          ? 'La validación de seguridad del login expiró o no coincide.'
          : undefined;

  return renderLayout({
    title: 'Login | Milo Dashboard',
    body: `
      ${renderTopbar(null, 'login')}
      <main class="login-shell">
        <section class="panel login-panel">
          <h1>Entrar al panel</h1>
          <p>Login con Discord + roles internos. Solo pueden entrar usuarios que estén en la whitelist como <strong>admin</strong> o <strong>developer</strong>.</p>
          ${
            authEnabled
              ? '<a class="login-button" href="/auth/discord/login">Entrar con Discord</a>'
              : '<div class="error-banner">OAuth de Discord todavía no está configurado. Faltan variables en <code>.env</code>.</div>'
          }
          <p class="muted-note">Roles previstos: <strong>admin</strong> y <strong>developer</strong>. Vos podés quedar como admin por whitelist de tu Discord ID.</p>
          ${errorText ? `<div class="error-banner">${escapeHtml(errorText)}</div>` : ''}
        </section>
      </main>
    `,
  });
}

function renderChatPage(user: AuthUser | null) {
  return renderLayout({
    title: 'Chat | Milo Dashboard',
    body: `
      ${renderTopbar(user, 'chat')}
      <main class="shell chat-shell">
        <section class="chat-layout">
          <aside class="panel">
            <h3>Chat web de Milo</h3>
            <p class="lead">Base para hablar con Milo desde la web autenticándote con Discord.</p>
            <div class="notifications">
              <div class="notification ok">
                <div>
                  <strong>Sesión actual</strong>
                  <p>${user ? `${escapeHtml(user.displayName)} · rol ${escapeHtml(user.role)}` : 'Modo sin login'}</p>
                </div>
                ${user?.avatarUrl ? `<img class="avatar" src="${escapeHtml(user.avatarUrl)}" alt="avatar" />` : '<span>🦉</span>'}
              </div>
              <div class="notification warning">
                <div>
                  <strong>Estado</strong>
                  <p>La UI de chat ya está. La respuesta del backend está en modo placeholder hasta conectarla con Milo real.</p>
                </div>
                <span>beta</span>
              </div>
            </div>
          </aside>

          <section class="panel">
            <h3>Conversación</h3>
            <p class="lead">Podés usar esto como base de chat web propio. Más adelante lo conectamos al runtime real de Milo.</p>
            <div id="chat-feed" class="chat-feed">
              <div class="message">
                <strong>Milo</strong>
                <div>Hola. Esta es la primera base del chat web con login de Discord.</div>
              </div>
            </div>
            <form id="chat-form" class="chat-form">
              <textarea id="message" name="message" placeholder="Escribime algo..."></textarea>
              <div class="chat-actions">
                <span class="muted-note">Por ahora responde un placeholder desde <code>/api/chat</code>.</span>
                <button class="ghost-button" type="submit">Enviar</button>
              </div>
            </form>
          </section>
        </section>
      </main>
      <script>
        const form = document.getElementById('chat-form');
        const feed = document.getElementById('chat-feed');
        const input = document.getElementById('message');

        function addMessage(author, text, className = '') {
          const wrapper = document.createElement('div');
          wrapper.className = 'message ' + className;
          wrapper.innerHTML = '<strong>' + author + '</strong><div></div>';
          wrapper.querySelector('div').textContent = text;
          feed.appendChild(wrapper);
          feed.scrollTop = feed.scrollHeight;
        }

        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const message = input.value.trim();
          if (!message) return;

          addMessage('Vos', message, 'user');
          input.value = '';

          try {
            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ message }),
            });

            const payload = await response.json();
            if (!response.ok) {
              addMessage('Milo', payload.error || 'No se pudo responder.');
              return;
            }

            addMessage('Milo', payload.data.reply);
          } catch (error) {
            addMessage('Milo', 'Se cortó la comunicación con el backend.');
          }
        });
      </script>
    `,
  });
}

function getRequestUser(cookieHeader: string | undefined, sessionSecret: string) {
  const cookies = parseCookieHeader(cookieHeader);
  const token = cookies[getSessionCookieName()];
  if (!token) return null;
  return verifySignedToken<AuthUser>(token, sessionSecret);
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: true });
  const store = options.store ?? createPostgresStore();
  const dbHealthcheck = options.dbHealthcheck ?? checkDbConnection;
  const auth = getDiscordAuthConfig();

  function setSessionCookie(reply: { header: (name: string, value: string | string[]) => void }, user: AuthUser) {
    const token = createSignedToken(user, auth.sessionSecret);
    reply.header(
      'set-cookie',
      serializeCookie(getSessionCookieName(), token, {
        maxAge: 60 * 60 * 24 * 14,
        sameSite: 'Lax',
        secure: auth.secureCookies,
      }),
    );
  }

  function clearSessionCookie(reply: { header: (name: string, value: string | string[]) => void }) {
    reply.header(
      'set-cookie',
      serializeCookie(getSessionCookieName(), '', {
        maxAge: 0,
        sameSite: 'Lax',
        secure: auth.secureCookies,
      }),
    );
  }

  function setOauthStateCookie(reply: { header: (name: string, value: string | string[]) => void }, state: string) {
    reply.header(
      'set-cookie',
      serializeCookie(getOauthStateCookieName(), state, {
        maxAge: 60 * 10,
        sameSite: 'Lax',
        secure: auth.secureCookies,
      }),
    );
  }

  function clearOauthStateCookie(reply: { header: (name: string, value: string | string[]) => void }) {
    reply.header(
      'set-cookie',
      serializeCookie(getOauthStateCookieName(), '', {
        maxAge: 0,
        sameSite: 'Lax',
        secure: auth.secureCookies,
      }),
    );
  }

  async function ensurePageUser(request: { headers: { cookie?: string } }, reply: { redirect: (location: string) => unknown }) {
    const user = auth.sessionSecret ? getRequestUser(request.headers.cookie, auth.sessionSecret) : null;
    if (!user) {
      await reply.redirect('/login');
      return undefined;
    }
    return user;
  }

  async function ensureApiUser(request: { headers: { cookie?: string } }, reply: { status: (code: number) => { send: (payload: unknown) => unknown } }) {
    const user = auth.sessionSecret ? getRequestUser(request.headers.cookie, auth.sessionSecret) : null;
    if (!user) {
      reply.status(401).send({ error: 'unauthorized' });
      return undefined;
    }
    return user;
  }

  app.get('/', async (request, reply) => {
    const requiredUser = await ensurePageUser(request, reply);
    if (requiredUser === undefined) return reply;

    const summary = await store.getDashboardSummary();
    return reply.type('text/html; charset=utf-8').send(renderDashboardPage(summary, requiredUser));
  });

  app.get('/login', async (request, reply) => {
    const currentUser = auth.enabled ? getRequestUser(request.headers.cookie, auth.sessionSecret) : null;
    if (currentUser) {
      return reply.redirect('/');
    }

    const query = request.query as { error?: string };
    return reply.type('text/html; charset=utf-8').send(renderLoginPage({ authEnabled: auth.enabled, error: query?.error }));
  });

  app.get('/chat', async (request, reply) => {
    const requiredUser = await ensurePageUser(request, reply);
    if (requiredUser === undefined) return reply;

    return reply.type('text/html; charset=utf-8').send(renderChatPage(requiredUser));
  });

  app.get('/auth/discord/login', async (_request, reply) => {
    if (!auth.enabled) {
      return reply.redirect('/login?error=oauth_failed');
    }

    const state = createOauthState();
    setOauthStateCookie(reply, state);
    return reply.redirect(buildDiscordOauthUrl(auth, state));
  });

  app.get('/auth/discord/callback', async (request, reply) => {
    if (!auth.enabled) {
      return reply.redirect('/login?error=oauth_failed');
    }

    const query = request.query as { code?: string; state?: string };
    const cookies = parseCookieHeader(request.headers.cookie);
    const cookieState = cookies[getOauthStateCookieName()];

    if (!query.state || !cookieState || query.state !== cookieState || !query.code) {
      clearOauthStateCookie(reply);
      return reply.redirect('/login?error=invalid_state');
    }

    try {
      const token = await exchangeDiscordCode(auth, query.code);
      const discordUser = await fetchDiscordUser(token.access_token);
      const user = toAuthUser(auth, discordUser);

      clearOauthStateCookie(reply);

      if (!user) {
        clearSessionCookie(reply);
        return reply.redirect('/login?error=not_allowed');
      }

      setSessionCookie(reply, user);
      return reply.redirect('/');
    } catch (error) {
      app.log.error({ error }, 'discord oauth failed');
      clearOauthStateCookie(reply);
      clearSessionCookie(reply);
      return reply.redirect('/login?error=oauth_failed');
    }
  });

  app.get('/auth/logout', async (_request, reply) => {
    clearSessionCookie(reply);
    clearOauthStateCookie(reply);
    return reply.redirect('/login');
  });

  app.get('/api', async () => ({
    service: 'milo-dashboard',
    status: 'ok',
    auth: {
      discordOauthEnabled: auth.enabled,
      roles: ['admin', 'developer'],
    },
    endpoints: ['/', '/login', '/chat', '/auth/discord/login', '/api/dashboard', '/api/chat', '/api/me'],
  }));

  app.get('/api/me', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    return { data: { user, authEnabled: auth.enabled } };
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (_request, reply) => {
    try {
      await dbHealthcheck();
      return { status: 'ready' };
    } catch (error) {
      app.log.error({ error }, 'readiness check failed');
      return reply.status(503).send({ status: 'not_ready' });
    }
  });

  app.get('/api/dashboard', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const summary = await store.getDashboardSummary();
    return { data: summary };
  });

  app.get('/api/jobs', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const jobs = await store.listJobs();
    return { data: jobs };
  });

  app.post('/api/jobs', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const parsed = createJobSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }

    try {
      const job = await store.createJob(parsed.data);
      return reply.status(201).send({ data: job });
    } catch (error) {
      app.log.error({ error }, 'failed to create job');
      return reply.status(500).send({ error: 'failed_to_create_job' });
    }
  });

  app.get('/api/job-runs', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const parsed = limitQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    }

    const runs = await store.listJobRuns(parsed.data.limit);
    return { data: runs };
  });

  app.post('/api/job-runs', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const parsed = createJobRunSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }

    try {
      const run = await store.createJobRun(parsed.data);
      return reply.status(201).send({ data: run });
    } catch (error) {
      app.log.error({ error }, 'failed to create job run');
      const message = error instanceof Error ? error.message : 'unknown_error';
      const statusCode = message.includes('Job not found') ? 404 : 500;
      return reply.status(statusCode).send({ error: 'failed_to_create_job_run', message });
    }
  });

  app.get('/api/ticket-runs', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const parsed = limitQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    }

    const runs = await store.listTicketRuns(parsed.data.limit);
    return { data: runs };
  });

  app.post('/api/chat', async (request, reply) => {
    const user = await ensureApiUser(request, reply);
    if (user === undefined) return reply;

    const parsed = chatBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }

    const viewer = user ?? null;
    const replyText = viewer
      ? `Recibido, ${viewer.displayName}. Este chat web ya está protegido con Discord OAuth y tu rol es ${viewer.role}. Por ahora la respuesta es placeholder hasta conectarlo con Milo real. Tu mensaje fue: "${parsed.data.message}".`
      : `Recibido. Este chat web ya tiene la UI y el endpoint base. Falta conectarlo con Milo real. Tu mensaje fue: "${parsed.data.message}".`;

    return { data: { reply: replyText } };
  });

  return app;
}
