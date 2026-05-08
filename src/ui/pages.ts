import type { AuthUser } from '../lib/auth.js';
import type { DashboardSummary } from '../lib/store.js';
import { renderDocument, escapeHtml } from './html.js';
import {
  renderDropdownScript,
  renderJobsRows,
  renderMetrics,
  renderNotifications,
  renderTicketRows,
  renderTopbar,
} from './components.js';

export function renderDashboardPage(summary: DashboardSummary, user: AuthUser) {
  return renderDocument({
    title: 'Milo Dashboard',
    scripts: renderDropdownScript(),
    body: `
      ${renderTopbar(user, 'dashboard')}
      <main class="shell">
        <section class="hero">
          <div>
            <h1>Milo Dashboard</h1>
            <p>Vista principal con métricas de tickets tomados, resultados, jobs activos y alertas para revisar rápido cómo viene la operación.</p>
          </div>
        </section>

        ${renderMetrics(summary)}

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
                <tbody>${renderTicketRows(summary.recentTicketRuns)}</tbody>
              </table>
            </article>
          </div>

          <aside class="stack">
            <article class="panel">
              <h3>Notificaciones</h3>
              <p class="lead">Errores o cosas que merecen una mirada manual.</p>
              <ul class="notifications">${renderNotifications(summary.recentNotifications)}</ul>
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
            <tbody>${renderJobsRows(summary.recentJobs)}</tbody>
          </table>
        </section>

        <p class="footer">APIs disponibles: <code>/api/dashboard</code>, <code>/api/jobs</code>, <code>/api/job-runs</code>, <code>/api/ticket-runs</code>, <code>/api/chat</code>, <code>/api/me</code>, <code>/health</code>, <code>/ready</code>.</p>
      </main>
    `,
  });
}

export function renderLoginPage({ authEnabled, error }: { authEnabled: boolean; error?: string }) {
  const errorText =
    error === 'not_allowed'
      ? 'Tu usuario de Discord no está en la whitelist de Milo Dashboard.'
      : error === 'oauth_failed'
        ? 'Falló el login con Discord. Revisá configuración o credenciales.'
        : error === 'invalid_state'
          ? 'La validación de seguridad del login expiró o no coincide.'
          : undefined;

  return renderDocument({
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

export function renderChatPage(user: AuthUser) {
  return renderDocument({
    title: 'Chat | Milo Dashboard',
    scripts: `${renderDropdownScript()}
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
      </script>`,
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
                  <p>${escapeHtml(user.displayName)} · rol ${escapeHtml(user.role)}</p>
                </div>
                ${user.avatarUrl ? `<img class="avatar" src="${escapeHtml(user.avatarUrl)}" alt="avatar" />` : '<span>🦉</span>'}
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
    `,
  });
}
