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
    scripts: `${renderDropdownScript()}
      <script>
        let activeJobKey = null;
        let activeTicketKey = null;
        let activityRefreshTimer = null;
        function isTicketModalOpen() {
          const modal = document.getElementById('ticket-activity-modal');
          return Boolean(modal && !modal.hidden);
        }
        function formatDateTime(value) {
          if (!value) return '—';
          try {
            return new Date(value).toLocaleString('es-AR');
          } catch {
            return value;
          }
        }
        function getJobStatusMeta(job) {
          const raw = job.runningAt ? 'Corriendo' : (job.lastStatus || 'Sin datos');
          const value = String(raw || 'Sin datos');
          const normalized = value.toLowerCase();
          const css = job.runningAt
            ? 'running'
            : ['ok', 'success', 'completed', 'done'].includes(normalized)
              ? 'ok'
              : ['error', 'failed', 'cancelled'].includes(normalized)
                ? 'error'
                : 'idle';
          return { value, css };
        }
        function updateJobRows(jobs) {
          jobs.forEach((job) => {
            const row = document.querySelector('tr[data-job-key="' + CSS.escape(job.key) + '"]');
            if (!row) return;
            const statusMeta = getJobStatusMeta(job);
            const enabledCell = row.querySelector('.job-enabled-cell');
            const statusCell = row.querySelector('.job-status-cell');
            const nextRunCell = row.querySelector('.job-next-run-cell');
            if (enabledCell) enabledCell.textContent = job.enabled ? 'Activo' : 'Pausado';
            if (statusCell) statusCell.innerHTML = '<span class="job-status-badge ' + statusMeta.css + '">' + statusMeta.value + '</span>';
            if (nextRunCell) nextRunCell.textContent = job.nextRunAt ? formatDateTime(job.nextRunAt) : '—';
          });
        }
        function renderLiveRuns(items) {
          if (!items.length) return '<div class="activity-empty">Todavía no hay corridas registradas.</div>';
          return items.map((item) => {
            const detail = item.error || item.summary || 'Sin detalle';
            return '<article class="activity-item">'
              + '<div class="activity-item-head"><strong>' + item.status + '</strong><span>' + formatDateTime(item.runAt || item.finishedAt) + '</span></div>'
              + '<p>' + detail + '</p>'
              + '<div class="activity-item-meta">'
              + '<span>duración: ' + (item.durationMs != null ? item.durationMs + 'ms' : '—') + '</span>'
              + '<span>entregado: ' + (item.delivered == null ? '—' : (item.delivered ? 'sí' : 'no')) + '</span>'
              + '</div>'
              + '</article>';
          }).join('');
        }
        function renderTicketRuns(items) {
          if (!items.length) return '<div class="activity-empty">Todavía no hay actividad guardada de tickets para este job.</div>';
          return items.map((item) => {
            const detail = item.note || item.testSummary || item.jiraSummary || 'Sin nota';
            return '<article class="activity-item">'
              + '<div class="activity-item-head"><strong>' + item.jiraKey + ' · ' + item.dispatchStatus + '</strong><span>' + formatDateTime(item.startedAt) + '</span></div>'
              + '<p>' + detail + '</p>'
              + '<div class="activity-item-meta">'
              + '<span>estado Jira: ' + (item.jiraStatus || '—') + '</span>'
              + '<span>score: ' + (item.score == null ? '—' : item.score) + '</span>'
              + '<span>branch: ' + (item.branchName || '—') + '</span>'
              + '</div>'
              + '</article>';
          }).join('');
        }
        function renderRelatedJobRuns(items) {
          if (!items.length) return '<div class="activity-empty">No hay runs de job vinculados en la base del dashboard.</div>';
          return items.map((item) => {
            const detail = item.error || item.summary || JSON.stringify(item.data || {});
            return '<article class="activity-item">'
              + '<div class="activity-item-head"><strong>' + item.status + '</strong><span>' + formatDateTime(item.startedAt) + '</span></div>'
              + '<p>' + detail + '</p>'
              + '<div class="activity-item-meta"><span>terminó: ' + formatDateTime(item.finishedAt) + '</span></div>'
              + '</article>';
          }).join('');
        }
        async function refreshJobs() {
          const response = await fetch('/api/jobs/sync', { method: 'POST' });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'jobs_sync_failed');
          updateJobRows(payload.data || []);
        }
        async function loadJobActivity(key) {
          activeJobKey = key;
          const title = document.getElementById('job-activity-title');
          const lead = document.getElementById('job-activity-lead');
          const liveRuns = document.getElementById('job-live-runs');
          const ticketRuns = document.getElementById('job-ticket-runs');
          const status = document.getElementById('job-activity-status');
          const panel = document.getElementById('job-activity-panel');
          const empty = document.getElementById('job-activity-empty');

          status.textContent = 'Cargando actividad…';
          panel.hidden = false;
          empty.hidden = true;
          openJobModal();

          const response = await fetch('/api/jobs/activity?key=' + encodeURIComponent(key));
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'job_activity_failed');

          const data = payload.data;
          const statusMeta = getJobStatusMeta(data.job);
          title.textContent = data.job.name;
          lead.textContent = 'Estado actual: ' + statusMeta.value + ' · próxima corrida: ' + (data.job.nextRunAt ? formatDateTime(data.job.nextRunAt) : '—');
          liveRuns.innerHTML = renderLiveRuns(data.liveRuns || []);
          ticketRuns.innerHTML = renderTicketRuns(data.ticketRuns || []);
          status.textContent = 'Actualizado ' + formatDateTime(new Date().toISOString());
        }
        function isJobModalOpen() {
          const modal = document.getElementById('job-activity-modal');
          return Boolean(modal && !modal.hidden);
        }
        function openJobModal() {
          const modal = document.getElementById('job-activity-modal');
          if (!modal) return;
          modal.hidden = false;
          modal.setAttribute('aria-hidden', 'false');
          document.body.classList.add('modal-open');
        }
        function closeJobModal() {
          const modal = document.getElementById('job-activity-modal');
          if (!modal) return;
          modal.hidden = true;
          modal.setAttribute('aria-hidden', 'true');
          document.body.classList.remove('modal-open');
          activeJobKey = null;
        }
        function openTicketModal() {
          const modal = document.getElementById('ticket-activity-modal');
          if (!modal) return;
          modal.hidden = false;
          modal.setAttribute('aria-hidden', 'false');
          document.body.classList.add('modal-open');
        }
        function closeTicketModal() {
          const modal = document.getElementById('ticket-activity-modal');
          if (!modal) return;
          modal.hidden = true;
          modal.setAttribute('aria-hidden', 'true');
          document.body.classList.remove('modal-open');
          activeTicketKey = null;
        }
        async function loadTicketActivity(jiraKey, options = {}) {
          const shouldOpenModal = options.openModal !== false;
          activeTicketKey = jiraKey;
          const title = document.getElementById('ticket-activity-title');
          const lead = document.getElementById('ticket-activity-lead');
          const ticketRuns = document.getElementById('ticket-activity-runs');
          const jobRuns = document.getElementById('ticket-activity-job-runs');
          const panel = document.getElementById('ticket-activity-panel');
          const empty = document.getElementById('ticket-activity-empty');
          const status = document.getElementById('ticket-activity-status');

          status.textContent = 'Cargando detalle del ticket…';
          panel.hidden = false;
          empty.hidden = true;
          if (shouldOpenModal) openTicketModal();

          const response = await fetch('/api/ticket-runs/activity?jiraKey=' + encodeURIComponent(jiraKey));
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'ticket_activity_failed');

          title.textContent = 'Detalle de ' + jiraKey;
          lead.textContent = 'Historial del ticket, con todos los runs relacionados guardados por el dashboard.';
          ticketRuns.innerHTML = renderTicketRuns(payload.data.ticketRuns || []);
          jobRuns.innerHTML = renderRelatedJobRuns(payload.data.jobRuns || []);
          status.textContent = 'Actualizado ' + formatDateTime(new Date().toISOString());
        }
        function scheduleActivityRefresh() {
          if (activityRefreshTimer) window.clearInterval(activityRefreshTimer);
          activityRefreshTimer = window.setInterval(async () => {
            try {
              await refreshJobs();
              if (activeJobKey && isJobModalOpen()) await loadJobActivity(activeJobKey);
              if (activeTicketKey && isTicketModalOpen()) {
                await loadTicketActivity(activeTicketKey, { openModal: false });
              }
            } catch (error) {
              const status = document.getElementById('job-activity-status');
              if (status) status.textContent = 'No pude refrescar en vivo.';
            }
          }, 8000);
        }
        document.querySelectorAll('.job-run-button').forEach((button) => {
          button.addEventListener('click', async () => {
            const key = button.dataset.jobKey;
            if (!key) return;

            const previous = button.textContent;
            button.disabled = true;
            button.textContent = 'Corriendo…';

            try {
              const response = await fetch('/api/jobs/run', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ key }),
              });

              const payload = await response.json();
              if (!response.ok) throw new Error(payload.error || 'job_run_failed');

              button.textContent = 'Lanzado';
              await refreshJobs();
              await loadJobActivity(key);
              window.setTimeout(() => {
                button.textContent = previous;
                button.disabled = false;
              }, 2200);
            } catch (error) {
              button.textContent = 'Falló';
              window.setTimeout(() => {
                button.textContent = previous;
                button.disabled = false;
              }, 2600);
            }
          });
        });
        document.querySelectorAll('.job-activity-button').forEach((button) => {
          button.addEventListener('click', async () => {
            const key = button.dataset.jobKey;
            if (!key) return;
            try {
              await loadJobActivity(key);
            } catch (error) {
              const status = document.getElementById('job-activity-status');
              const panel = document.getElementById('job-activity-panel');
              const empty = document.getElementById('job-activity-empty');
              if (panel) panel.hidden = true;
              if (empty) empty.hidden = false;
              if (status) status.textContent = 'No pude cargar la actividad de ese job.';
              openJobModal();
            }
          });
        });
        closeJobModal();
        document.getElementById('job-activity-close')?.addEventListener('click', closeJobModal);
        document.getElementById('job-activity-modal')?.addEventListener('click', (event) => {
          if (event.target?.id === 'job-activity-modal') closeJobModal();
        });
        document.querySelectorAll('.ticket-detail-button').forEach((button) => {
          button.addEventListener('click', async () => {
            const key = button.dataset.ticketKey;
            if (!key) return;
            try {
              await loadTicketActivity(key);
            } catch (error) {
              const status = document.getElementById('ticket-activity-status');
              const panel = document.getElementById('ticket-activity-panel');
              const empty = document.getElementById('ticket-activity-empty');
              if (panel) panel.hidden = true;
              if (empty) empty.hidden = false;
              if (status) status.textContent = 'No pude cargar el detalle de ese ticket.';
              openTicketModal();
            }
          });
        });
        document.querySelectorAll('.notification[data-ticket-key]').forEach((item) => {
          item.addEventListener('click', async () => {
            const key = item.dataset.ticketKey;
            if (!key) return;
            try {
              await loadTicketActivity(key);
            } catch (error) {
              const status = document.getElementById('ticket-activity-status');
              const panel = document.getElementById('ticket-activity-panel');
              const empty = document.getElementById('ticket-activity-empty');
              if (panel) panel.hidden = true;
              if (empty) empty.hidden = false;
              if (status) status.textContent = 'No pude cargar el detalle de ese ticket.';
              openTicketModal();
            }
          });
        });
        closeTicketModal();
        document.getElementById('ticket-activity-close')?.addEventListener('click', closeTicketModal);
        document.getElementById('ticket-activity-modal')?.addEventListener('click', (event) => {
          if (event.target?.id === 'ticket-activity-modal') closeTicketModal();
        });
        document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            closeTicketModal();
            closeJobModal();
          }
        });
        scheduleActivityRefresh();
      </script>`,
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
                <th>Estado job</th>
                <th>Próxima corrida</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>${renderJobsRows(summary.recentJobs)}</tbody>
          </table>
        </section>

        <p class="footer">APIs disponibles: <code>/api/dashboard</code>, <code>/api/jobs</code>, <code>/api/jobs/run</code>, <code>/api/job-runs</code>, <code>/api/ticket-runs</code>, <code>/api/chat</code>, <code>/api/me</code>, <code>/health</code>, <code>/ready</code>.</p>
      </main>
      <div id="job-activity-modal" class="modal-overlay" hidden aria-hidden="true">
        <div class="modal-card">
          <div class="modal-header">
            <div>
              <h3 id="job-activity-title">Actividad del job</h3>
              <p id="job-activity-lead" class="muted-note">Corridas live, tickets tocados y notas como <code>needs_human</code>.</p>
              <p id="job-activity-status" class="muted-note">Sin job seleccionado.</p>
            </div>
            <button id="job-activity-close" class="ghost-button" type="button">Cerrar</button>
          </div>
          <div id="job-activity-empty" class="activity-empty">Todavía no seleccionaste ningún job.</div>
          <div id="job-activity-panel" class="activity-grid" hidden>
            <article class="activity-column">
              <h4>Corridas live</h4>
              <div id="job-live-runs" class="activity-list"></div>
            </article>
            <article class="activity-column">
              <h4>Tickets trabajados</h4>
              <div id="job-ticket-runs" class="activity-list"></div>
            </article>
          </div>
        </div>
      </div>
      <div id="ticket-activity-modal" class="modal-overlay" hidden aria-hidden="true">
        <div class="modal-card">
          <div class="modal-header">
            <div>
              <h3 id="ticket-activity-title">Detalle del ticket</h3>
              <p id="ticket-activity-lead" class="muted-note">Runs relacionados, notas y detalle.</p>
              <p id="ticket-activity-status" class="muted-note">Sin ticket seleccionado.</p>
            </div>
            <button id="ticket-activity-close" class="ghost-button" type="button">Cerrar</button>
          </div>
          <div id="ticket-activity-empty" class="activity-empty">Todavía no seleccionaste ningún ticket.</div>
          <div id="ticket-activity-panel" class="activity-grid" hidden>
            <article class="activity-column">
              <h4>Runs del ticket</h4>
              <div id="ticket-activity-runs" class="activity-list"></div>
            </article>
            <article class="activity-column">
              <h4>Runs relacionados del job</h4>
              <div id="ticket-activity-job-runs" class="activity-list"></div>
            </article>
          </div>
        </div>
      </div>
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

export function renderChatPage(user: AuthUser, options: { prefill?: string } = {}) {
  const prefill = options.prefill ?? '';
  return renderDocument({
    title: 'Chat | Milo Dashboard',
    scripts: `${renderDropdownScript()}
      <script>
        const form = document.getElementById('chat-form');
        const feed = document.getElementById('chat-feed');
        const input = document.getElementById('message');
        const submit = document.getElementById('chat-submit');
        const status = document.getElementById('chat-status');
        const newChatButton = document.getElementById('chat-new');
        const renameButton = document.getElementById('chat-rename');
        const deleteButton = document.getElementById('chat-delete');
        const sessionList = document.getElementById('chat-session-list');
        const sessionEmpty = document.getElementById('chat-session-empty');
        const sessionTitle = document.getElementById('chat-session-title');
        const storageKey = 'milo-chat-history:${escapeHtml(user.id)}';
        const conversationKey = 'milo-chat-conversation:${escapeHtml(user.id)}';
        let pendingNode = null;
        let messages = [];
        let sessions = [];
        let conversationId = null;
        const initialPrefill = ${JSON.stringify(prefill)};
        function createConversationId() {
          return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        }
        function buildSessionKey(id) {
          return 'webchat-discord-${escapeHtml(user.id)}-' + id;
        }
        function extractConversationId(sessionKey) {
          const prefix = 'webchat-discord-${escapeHtml(user.id)}-';
          return sessionKey.startsWith(prefix) ? sessionKey.slice(prefix.length) : null;
        }
        function ensureConversationId() {
          if (!conversationId) {
            conversationId = createConversationId();
            window.localStorage.setItem(conversationKey, conversationId);
          }
          return conversationId;
        }
        function getActiveSession() {
          return sessions.find((item) => item.conversationId === conversationId) || null;
        }
        function updateSessionTitle() {
          const active = getActiveSession();
          sessionTitle.textContent = active?.title || 'Nueva conversación';
        }
        function persistConversationId() {
          if (conversationId) {
            window.localStorage.setItem(conversationKey, conversationId);
          }
        }
        function resetConversation() {
          conversationId = createConversationId();
          persistConversationId();
          setMessages([{ role: 'assistant', content: 'Nueva conversación lista. Decime nomás.' }]);
          updateSessionTitle();
          renderSessions();
          if (initialPrefill && !input.value.trim()) input.value = initialPrefill;
          input.focus();
        }
        function scrollFeed() {
          feed.scrollTop = feed.scrollHeight;
        }
        function persistMessages() {
          try {
            window.localStorage.setItem(storageKey, JSON.stringify(messages));
          } catch (error) {
            console.warn('chat_persist_failed', error);
          }
        }
        function escapeHtml(value) {
          return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
        }
        function formatMessageHtml(content) {
          const placeholders = [];
          const stash = (html) => {
            const token = '@@MILO_FMT_' + placeholders.length + '@@';
            placeholders.push(html);
            return token;
          };

          let html = escapeHtml(content).replace(/\\r\\n/g, '\\n');

          html = html.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, (_, code) => {
            return stash('<pre class="message-code-block"><code>' + code.trim() + '</code></pre>');
          });

          html = html.replace(/\`([^\`\\n]+)\`/g, (_, code) => {
            return stash('<code class="message-code-inline">' + code + '</code>');
          });

          html = html.replace(/(^|[\\s(\\[{>])([*_]{1,4})(\\S(?:[\\s\\S]*?\\S)?)([*_]{1,4})(?=($|[\\s)\\]}<.,!?;:]))/gm, (match, prefix, left, inner, right) => {
            if (left[0] !== right[0]) return match;
            const level = Math.min(left.length, right.length, 3);
            if (level < 1) return match;

            let formatted = inner;
            if (level === 3) formatted = '<strong><em>' + inner + '</em></strong>';
            else if (level === 2) formatted = '<strong>' + inner + '</strong>';
            else formatted = '<em>' + inner + '</em>';

            return prefix + formatted;
          });

          html = html.replace(/\\n/g, '<br>');

          return html.replace(/@@MILO_FMT_(\\d+)@@/g, (_, index) => placeholders[Number(index)] || '');
        }
        function formatSessionTime(value) {
          if (!value) return 'Sin mensajes';
          try {
            return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
          } catch {
            return value;
          }
        }
        function renderMessage(message) {
          const row = document.createElement('div');
          row.className = 'message-row ' + message.role;
          const bubble = document.createElement('div');
          bubble.className = 'message-bubble';
          bubble.innerHTML = '<span class="message-author"></span><div class="message-text"></div>';
          bubble.querySelector('.message-author').textContent = message.role === 'assistant' ? 'Milo' : 'Vos';
          bubble.querySelector('.message-text').innerHTML = formatMessageHtml(message.content);
          row.appendChild(bubble);
          feed.appendChild(row);
          return row;
        }
        function redrawMessages() {
          feed.innerHTML = '';
          for (const message of messages) {
            renderMessage(message);
          }
          scrollFeed();
        }
        function renderSessions() {
          sessionList.innerHTML = '';
          sessionEmpty.hidden = sessions.length > 0;
          for (const session of sessions) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'chat-session-item' + (session.conversationId === conversationId ? ' active' : '');
            button.dataset.conversationId = session.conversationId;
            button.innerHTML = '<strong></strong><span class="chat-session-preview"></span><span class="chat-session-meta"></span>';
            button.querySelector('strong').textContent = session.title || 'Nueva conversación';
            button.querySelector('.chat-session-preview').textContent = session.preview || 'Sin mensajes todavía';
            button.querySelector('.chat-session-meta').textContent = formatSessionTime(session.lastMessageAt);
            button.addEventListener('click', () => {
              openConversation(session.conversationId);
            });
            sessionList.appendChild(button);
          }
          updateSessionTitle();
        }
        function normalizeSessions(items) {
          sessions = items
            .map((item) => ({
              ...item,
              conversationId: extractConversationId(item.sessionKey),
            }))
            .filter((item) => item.conversationId);
          renderSessions();
        }
        function setMessages(nextMessages) {
          messages = nextMessages.map((item) => ({
            role: item.role === 'user' ? 'user' : 'assistant',
            content: String(item.content || ''),
          }));
          persistMessages();
          redrawMessages();
        }
        function addMessage(role, content) {
          messages.push({ role: role === 'user' ? 'user' : 'assistant', content });
          persistMessages();
          renderMessage(messages[messages.length - 1]);
          scrollFeed();
        }
        function loadLocalHistory() {
          try {
            conversationId = window.localStorage.getItem(conversationKey) || null;
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed) || !parsed.length) return false;
            setMessages(parsed);
            return true;
          } catch (error) {
            console.warn('chat_restore_failed', error);
            return false;
          }
        }
        function showTyping() {
          hideTyping();
          const row = document.createElement('div');
          row.className = 'message-row assistant';
          const bubble = document.createElement('div');
          bubble.className = 'message-bubble';
          bubble.innerHTML = '<span class="message-author">Milo</span><div class="typing-indicator"><span></span><span></span><span></span></div>';
          row.appendChild(bubble);
          feed.appendChild(row);
          pendingNode = row;
          scrollFeed();
        }
        function hideTyping() {
          if (pendingNode) {
            pendingNode.remove();
            pendingNode = null;
          }
        }
        function setBusy(isBusy) {
          submit.disabled = isBusy;
          input.disabled = isBusy;
          renameButton.disabled = isBusy;
          deleteButton.disabled = isBusy;
          newChatButton.disabled = isBusy;
          status.textContent = isBusy ? 'Milo está escribiendo…' : 'Este chat habla con Milo real vía openclaw agent.';
        }
        async function loadSessions() {
          const response = await fetch('/api/chat/sessions');
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'chat_sessions_failed');
          normalizeSessions(payload.data.sessions);
        }
        async function loadMessagesForConversation(id) {
          conversationId = id;
          persistConversationId();
          const response = await fetch('/api/chat/history?conversationId=' + encodeURIComponent(id));
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'chat_history_failed');
          if (payload.data.messages.length) {
            setMessages(payload.data.messages);
          } else {
            setMessages([{ role: 'assistant', content: 'Nueva conversación lista. Decime nomás.' }]);
          }
          renderSessions();
        }
        async function openConversation(id) {
          hideTyping();
          setBusy(true);
          try {
            await loadMessagesForConversation(id);
          } catch (error) {
            setMessages([{ role: 'assistant', content: 'No pude abrir esa conversación.' }]);
          } finally {
            setBusy(false);
            input.focus();
          }
        }
        async function loadHistory() {
          const restoredFromLocal = loadLocalHistory();
          try {
            const currentConversationId = conversationId || ensureConversationId();
            const response = await fetch('/api/chat/bootstrap?conversationId=' + encodeURIComponent(currentConversationId));
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'chat_bootstrap_failed');

            normalizeSessions(payload.data.sessions);

            const fallbackConversationId = conversationId || sessions[0]?.conversationId || currentConversationId;
            if (fallbackConversationId !== currentConversationId) {
              await loadMessagesForConversation(fallbackConversationId);
              return;
            }

            if (payload.data.messages.length) {
              conversationId = currentConversationId;
              persistConversationId();
              setMessages(payload.data.messages);
              renderSessions();
              return;
            }

            if (!restoredFromLocal) {
              setMessages([{ role: 'assistant', content: 'Nueva conversación lista. Decime nomás.' }]);
            }
            renderSessions();
          } catch (error) {
            if (!restoredFromLocal) {
              setMessages([{ role: 'assistant', content: 'No pude cargar el historial todavía.' }]);
            }
          }
          if (initialPrefill && !input.value.trim()) input.value = initialPrefill;
          if (initialPrefill) input.focus();
        }
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const message = input.value.trim();
          if (!message) return;
          addMessage('user', message);
          input.value = '';
          setBusy(true);
          showTyping();
          try {
            const currentConversationId = ensureConversationId();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 100000);
            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ message, conversationId: currentConversationId }),
              signal: controller.signal,
            });
            clearTimeout(timeout);
            const payload = await response.json();
            hideTyping();
            if (!response.ok) {
              addMessage('assistant', payload.error === 'chat_backend_failed' ? 'No pude responder esta vez. Probá de nuevo en unos segundos.' : (payload.error || 'No se pudo responder.'));
              return;
            }
            addMessage('assistant', payload.data.reply);
            await loadSessions();
            renderSessions();
          } catch (error) {
            hideTyping();
            addMessage('assistant', 'La respuesta tardó demasiado o se cortó la comunicación.');
          } finally {
            setBusy(false);
            input.focus();
          }
        });
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
          }
        });
        newChatButton.addEventListener('click', () => {
          hideTyping();
          setBusy(false);
          resetConversation();
        });
        renameButton.addEventListener('click', async () => {
          const active = getActiveSession();
          if (!active) return;
          const nextTitle = window.prompt('Nuevo nombre para la conversación:', active.title || '');
          if (!nextTitle || !nextTitle.trim()) return;
          setBusy(true);
          try {
            const response = await fetch('/api/chat/sessions/' + encodeURIComponent(active.conversationId), {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ title: nextTitle.trim() }),
            });
            if (!response.ok) throw new Error('rename_failed');
            await loadSessions();
          } catch (error) {
            window.alert('No pude renombrar esa conversación.');
          } finally {
            setBusy(false);
          }
        });
        deleteButton.addEventListener('click', async () => {
          const active = getActiveSession();
          if (!active) return;
          const confirmed = window.confirm('¿Borrar esta conversación? Esta acción elimina su historial guardado.');
          if (!confirmed) return;
          setBusy(true);
          try {
            const response = await fetch('/api/chat/sessions/' + encodeURIComponent(active.conversationId), {
              method: 'DELETE',
            });
            if (!response.ok) throw new Error('delete_failed');
            await loadSessions();
            const fallbackConversationId = sessions[0]?.conversationId || null;
            if (fallbackConversationId) {
              await loadMessagesForConversation(fallbackConversationId);
            } else {
              resetConversation();
            }
          } catch (error) {
            window.alert('No pude borrar esa conversación.');
          } finally {
            setBusy(false);
          }
        });
        loadHistory();
      </script>`,
    body: `
      ${renderTopbar(user, 'chat')}
      <main class="shell chat-shell">
        <section class="chat-layout">
          <aside class="panel">
            <div class="chat-sidebar-header">
              <div>
                <h3>Conversaciones</h3>
                <p class="lead">Abrí chats viejos, seguí uno anterior o arrancá otro.</p>
              </div>
              <button id="chat-new" class="ghost-button" type="button">Nuevo chat</button>
            </div>
            <div class="notification ok compact">
              <div>
                <strong>${escapeHtml(user.displayName)}</strong>
                <p>rol ${escapeHtml(user.role)}</p>
              </div>
              ${user.avatarUrl ? `<img class="avatar" src="${escapeHtml(user.avatarUrl)}" alt="avatar" />` : '<span>🦉</span>'}
            </div>
            <div id="chat-session-empty" class="muted-note">Todavía no hay sesiones guardadas.</div>
            <div id="chat-session-list" class="chat-session-list"></div>
          </aside>

          <section class="panel chat-panel">
            <div class="chat-panel-header">
              <div class="chat-panel-heading">
                <div>
                  <h3 id="chat-session-title">Conversación</h3>
                  <p class="lead">Chat web real con Milo, usando tu sesión autenticada.</p>
                </div>
                <div class="chat-panel-controls">
                  <button id="chat-rename" class="ghost-button" type="button">Renombrar</button>
                  <button id="chat-delete" class="ghost-button danger" type="button">Borrar</button>
                </div>
              </div>
            </div>
            <div id="chat-feed" class="chat-feed"></div>
            <form id="chat-form" class="chat-form">
              <textarea id="message" name="message" placeholder="Escribime algo...">${escapeHtml(prefill)}</textarea>
              <div class="chat-actions">
                <span id="chat-status" class="muted-note">Este chat habla con Milo real vía <code>openclaw agent</code>.</span>
                <button id="chat-submit" class="ghost-button" type="submit">Enviar</button>
              </div>
            </form>
          </section>
        </section>
      </main>
    `,
  });
}
