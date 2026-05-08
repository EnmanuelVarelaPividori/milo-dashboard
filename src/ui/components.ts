import type { AuthUser } from '../lib/auth.js';
import type { DashboardNotification, DashboardSummary, Job, TicketRun } from '../lib/store.js';
import { escapeHtml } from './html.js';

function truncateText(value: string, maxLength = 180) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3).trimEnd()}...` : value;
}

export function renderTopbar(user: AuthUser | null, current: 'dashboard' | 'chat' | 'login') {
  const navLinks = user
    ? `
      <div class="nav-group primary">
        ${renderIntegrationPanel()}
      </div>
      <div class="nav-group">
        <a class="nav-link ${current === 'dashboard' ? 'active' : ''}" href="/">Dashboard</a>
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
      <a class="brand" href="/" aria-label="Milo Dashboard">
        <span class="brand-text">Milo Dashboard</span>
      </a>
      <nav class="nav">${navLinks}</nav>
    </header>
  `;
}

export function renderIntegrationPanel() {
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

export function renderJobsRows(jobs: Job[]) {
  return jobs.length
    ? jobs
        .map(
          (job) => {
            const prefill = encodeURIComponent(`Quiero preguntarte por el job ${job.name} (${job.key}).`);
            const statusLabel = job.runningAt
              ? 'Corriendo'
              : job.lastStatus
                ? job.lastStatus
                : 'Sin datos';
            const statusClass = job.runningAt
              ? 'running'
              : job.lastStatus && ['ok', 'success', 'completed', 'done'].includes(job.lastStatus.toLowerCase())
                ? 'ok'
                : job.lastStatus && ['error', 'failed', 'cancelled'].includes(job.lastStatus.toLowerCase())
                  ? 'error'
                  : 'idle';
            return `
            <tr data-job-key="${escapeHtml(job.key)}">
              <td class="job-name-cell">${escapeHtml(job.name)}</td>
              <td><code>${escapeHtml(job.key)}</code></td>
              <td class="job-enabled-cell">${job.enabled ? 'Activo' : 'Pausado'}</td>
              <td class="job-status-cell"><span class="job-status-badge ${statusClass}">${escapeHtml(statusLabel)}</span></td>
              <td class="job-next-run-cell">${job.nextRunAt ? escapeHtml(new Date(job.nextRunAt).toLocaleString('es-AR')) : '—'}</td>
              <td>
                <div class="job-actions">
                  <button class="ghost-button job-run-button" type="button" data-job-key="${escapeHtml(job.key)}" ${job.key.startsWith('cron:') ? '' : 'disabled'}>Correr ahora</button>
                  <button class="ghost-button job-activity-button" type="button" data-job-key="${escapeHtml(job.key)}">Ver actividad</button>
                </div>
              </td>
            </tr>`;
          },
        )
        .join('')
    : '<tr><td colspan="6" class="empty">Todavía no hay jobs cargados.</td></tr>';
}

export function renderTicketRows(ticketRuns: TicketRun[]) {
  return ticketRuns.length
    ? ticketRuns
        .map(
          (ticket) => `
            <tr class="ticket-row" data-ticket-key="${escapeHtml(ticket.jiraKey)}">
              <td><button class="link-button ticket-detail-button" type="button" data-ticket-key="${escapeHtml(ticket.jiraKey)}">${escapeHtml(ticket.jiraKey)}</button></td>
              <td>${escapeHtml(ticket.jiraSummary ?? 'Sin resumen')}</td>
              <td>${escapeHtml(ticket.dispatchStatus)}</td>
              <td>${ticket.branchName ? `<code>${escapeHtml(ticket.branchName)}</code>` : '—'}</td>
            </tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="empty">Todavía no hay tickets procesados.</td></tr>';
}

export function renderNotifications(notifications: DashboardNotification[]) {
  return notifications.length
    ? notifications
        .map(
          (notification) => `
            <li class="notification ${escapeHtml(notification.severity)} ${notification.type === 'ticket_run' ? 'clickable' : ''}" ${notification.type === 'ticket_run' ? `data-ticket-key="${escapeHtml(notification.title)}"` : ''}>
              <div>
                <strong>${escapeHtml(notification.title)}</strong>
                <p>${escapeHtml(truncateText(notification.detail))}</p>
              </div>
              <span>${escapeHtml(new Date(notification.occurredAt).toLocaleString('es-AR'))}</span>
            </li>`,
        )
        .join('')
    : '<li class="notification ok"><div><strong>Todo tranquilo</strong><p>No hay errores recientes.</p></div><span>—</span></li>';
}

export function renderMetrics(summary: DashboardSummary) {
  return `
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
  `;
}

export function renderDropdownScript() {
  return `<script>
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
  </script>`;
}
