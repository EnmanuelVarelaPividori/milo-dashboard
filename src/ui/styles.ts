export const appStyles = `
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
    padding: 0 0 56px;
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 4px;
    padding: 0;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;
  }
  .brand-text {
    display: inline-flex;
    align-items: center;
    font-size: 1.35rem;
    font-weight: 800;
    letter-spacing: 0.01em;
    color: #f8fafc;
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
  .nav-group.primary { margin-right: auto; }
  .nav-link, .ghost-button, .login-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 999px;
    padding: 8px 12px;
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
  .ghost-button.danger {
    border-color: rgba(239, 68, 68, 0.35);
    color: #fecaca;
  }
  .ghost-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
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
  .profile-menu { position: relative; }
  .profile-summary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border-radius: 999px;
    padding: 6px 10px;
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
  .profile-name { font-weight: 600; }
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
  .profile-menu.open .profile-dropdown { display: block; }
  .dropdown-link {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 10px 12px;
    border-radius: 12px;
    color: var(--text);
    text-decoration: none;
  }
  .dropdown-link:hover { background: rgba(30, 41, 59, 0.75); }
  .dropdown-button { all: unset; cursor: pointer; }
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
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 14px;
  }
  .hero h1 {
    margin: 0 0 8px;
    font-size: clamp(2rem, 5vw, 3rem);
  }
  .hero p { margin: 0; color: var(--muted); max-width: 720px; }
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
  .metric strong { font-size: clamp(2rem, 3vw, 2.8rem); }
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
  table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
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
  .notification.clickable { cursor: pointer; }
  .notification.clickable:hover {
    border-color: rgba(96, 165, 250, 0.42);
    transform: translateY(-1px);
  }
  .notification p { margin: 6px 0 0; color: var(--muted); }
  .notification span { color: var(--muted); font-size: 0.85rem; white-space: nowrap; }
  .integration-card {
    border: 1px solid var(--line);
    background: rgba(15, 23, 42, 0.7);
    border-radius: 999px;
    padding: 6px 10px;
  }
  .integration-list { display: flex; align-items: center; gap: 14px; }
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
  .integration-tooltip strong { display: block; margin-bottom: 6px; font-size: 0.85rem; }
  .integration-tooltip ul { margin: 0; padding-left: 16px; color: var(--muted); font-size: 0.82rem; }
  .integration-item.github:hover .integration-tooltip { opacity: 1; transform: translateY(0); }
  .footer { margin-top: 20px; color: var(--muted); font-size: 0.9rem; }
  .jobs-section { margin-top: 16px; }
  .section-link { scroll-margin-top: 24px; }
  .empty { color: var(--muted); text-align: center; }
  .login-shell, .chat-shell {
    width: min(960px, calc(100% - 32px));
    margin: 0 auto;
  }
  .login-panel { max-width: 520px; margin: 80px auto 0; padding: 28px; }
  .login-panel p { color: var(--muted); line-height: 1.5; }
  .login-button {
    margin-top: 14px;
    background: linear-gradient(135deg, #5865f2, #7289da);
    border: 0;
    color: white;
  }
  .muted-note { margin-top: 12px; color: var(--muted); font-size: 0.92rem; }
  .error-banner {
    margin-top: 16px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(239, 68, 68, 0.4);
    background: rgba(127, 29, 29, 0.22);
    color: #fecaca;
  }
  .chat-layout { display: grid; grid-template-columns: 280px 1fr; gap: 16px; }
  .chat-sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 14px;
  }
  .notification.compact {
    margin-bottom: 14px;
  }
  .chat-session-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 56vh;
    overflow-y: auto;
  }
  .chat-session-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: rgba(15, 23, 42, 0.45);
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }
  .chat-session-item.active {
    border-color: rgba(96, 165, 250, 0.4);
    background: rgba(30, 41, 59, 0.82);
  }
  .chat-session-item strong {
    font-size: 0.95rem;
  }
  .chat-session-preview,
  .chat-session-meta {
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chat-session-preview {
    color: var(--muted);
    font-size: 0.88rem;
  }
  .chat-session-meta {
    color: rgba(148, 163, 184, 0.8);
    font-size: 0.78rem;
  }
  .chat-panel {
    display: flex;
    flex-direction: column;
    min-height: 72vh;
    max-height: 72vh;
    overflow: hidden;
    padding: 0;
  }
  .chat-panel-header {
    padding: 18px 20px 12px;
    border-bottom: 1px solid var(--line);
  }
  .chat-panel-heading {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .chat-panel-controls {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .chat-panel-header h3 { margin: 0 0 6px; }
  .chat-feed {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    background: rgba(2, 6, 23, 0.38);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .message-row {
    display: flex;
    width: 100%;
  }
  .message-row.user {
    justify-content: flex-end;
  }
  .message-row.assistant {
    justify-content: flex-start;
  }
  .message-bubble {
    display: inline-block;
    width: fit-content;
    max-width: min(78%, 680px);
    padding: 12px 14px;
    border-radius: 18px;
    border: 1px solid var(--line);
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.18);
  }
  .message-row.assistant .message-bubble {
    background: rgba(51, 65, 85, 0.92);
    border-color: rgba(148, 163, 184, 0.18);
  }
  .message-row.user .message-bubble {
    background: rgba(37, 99, 235, 0.9);
    border-color: rgba(96, 165, 250, 0.35);
  }
  .message-author {
    display: block;
    margin-bottom: 6px;
    font-size: 0.82rem;
    color: rgba(226, 232, 240, 0.72);
  }
  .message-text {
    white-space: pre-wrap;
    line-height: 1.45;
  }
  .message-text strong { font-weight: 700; }
  .message-text em { font-style: italic; }
  .message-code-inline {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 8px;
    background: rgba(2, 6, 23, 0.45);
    border: 1px solid rgba(148, 163, 184, 0.18);
    font-family: 'SFMono-Regular', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.92em;
  }
  .message-code-block {
    margin: 8px 0 0;
    padding: 12px 14px;
    border-radius: 12px;
    overflow-x: auto;
    background: rgba(2, 6, 23, 0.58);
    border: 1px solid rgba(148, 163, 184, 0.18);
  }
  .message-code-block code {
    font-family: 'SFMono-Regular', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.92em;
  }
  .message-row.user .message-author {
    color: rgba(219, 234, 254, 0.8);
  }
  .typing-indicator {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    min-height: 18px;
  }
  .typing-indicator span {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: rgba(226, 232, 240, 0.8);
    animation: miloTyping 1.1s infinite ease-in-out;
  }
  .typing-indicator span:nth-child(2) { animation-delay: 0.15s; }
  .typing-indicator span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes miloTyping {
    0%, 80%, 100% { transform: scale(0.7); opacity: 0.55; }
    40% { transform: scale(1); opacity: 1; }
  }
  .chat-form {
    display: grid;
    gap: 12px;
    padding: 16px 20px 20px;
    border-top: 1px solid var(--line);
    background: rgba(15, 23, 42, 0.94);
  }
  textarea {
    width: 100%;
    min-height: 88px;
    resize: vertical;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: rgba(2, 6, 23, 0.75);
    color: var(--text);
    padding: 14px 16px;
    font: inherit;
  }
  textarea:disabled {
    opacity: 0.75;
    cursor: wait;
  }
  .chat-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .job-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .job-status-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    color: rgba(226, 232, 240, 0.82);
    font-size: 0.82rem;
    white-space: nowrap;
  }
  .job-status-badge.idle {
    background: rgba(51, 65, 85, 0.45);
  }
  .job-status-badge.running {
    background: rgba(59, 130, 246, 0.18);
    border-color: rgba(96, 165, 250, 0.38);
    color: #bfdbfe;
  }
  .job-status-badge.ok {
    background: rgba(34, 197, 94, 0.14);
    border-color: rgba(74, 222, 128, 0.35);
    color: #bbf7d0;
  }
  .job-status-badge.error {
    background: rgba(239, 68, 68, 0.14);
    border-color: rgba(248, 113, 113, 0.35);
    color: #fecaca;
  }
  .activity-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .activity-column h4 {
    margin: 0 0 12px;
    font-size: 0.95rem;
    color: var(--muted);
  }
  .activity-list {
    display: grid;
    gap: 12px;
  }
  .activity-item {
    padding: 14px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: var(--panel-2);
  }
  .activity-item-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }
  .activity-item-head strong {
    font-size: 0.92rem;
  }
  .activity-item-head span,
  .activity-item-meta,
  .activity-empty {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .activity-item p {
    margin: 0;
    line-height: 1.45;
  }
  .activity-item-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 10px;
  }
  .ticket-row { cursor: pointer; }
  .link-button {
    border: 0;
    background: transparent;
    color: #93c5fd;
    padding: 0;
    font: inherit;
    cursor: pointer;
    text-align: left;
  }
  .link-button:hover { text-decoration: underline; }
  .ticket-activity {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid var(--line);
  }
  .ticket-activity-header h4 {
    margin: 0 0 8px;
  }
  body.modal-open {
    overflow: hidden;
  }
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(2, 6, 23, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 50;
  }
  .modal-overlay[hidden] {
    display: none !important;
  }
  .modal-card {
    width: min(1100px, 100%);
    max-height: calc(100vh - 48px);
    overflow: auto;
    border-radius: 22px;
    border: 1px solid var(--line);
    background: rgba(15, 23, 42, 0.98);
    box-shadow: 0 24px 80px rgba(2, 6, 23, 0.45);
    padding: 20px;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
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
    .message-bubble { max-width: 88%; }
  }
  @media (max-width: 720px) {
    .topbar, .hero { flex-direction: column; align-items: flex-start; }
    .nav, .nav-group { align-items: flex-start; }
    .grid, .layout, .chat-layout, .activity-grid { grid-template-columns: 1fr; }
    .notification { flex-direction: column; }
    .notification span { white-space: normal; }
    .chat-sidebar-header,
    .chat-panel-heading { flex-direction: column; align-items: stretch; }
    .chat-panel-controls { justify-content: stretch; }
    .chat-actions { flex-direction: column; align-items: stretch; }
    .chat-panel { min-height: 78vh; max-height: none; }
    .message-bubble { max-width: 92%; }
  }
`;
