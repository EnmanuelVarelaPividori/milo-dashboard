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
  .nav-group.primary { margin-right: auto; }
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
  .profile-menu { position: relative; }
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
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 18px;
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
  .notification p { margin: 6px 0 0; color: var(--muted); }
  .notification span { color: var(--muted); font-size: 0.85rem; white-space: nowrap; }
  .integration-card {
    border: 1px solid var(--line);
    background: rgba(15, 23, 42, 0.7);
    border-radius: 999px;
    padding: 8px 12px;
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
  .message strong { display: block; margin-bottom: 6px; }
  .chat-form { display: grid; gap: 12px; margin-top: 16px; }
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
  .chat-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
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
    .nav, .nav-group { align-items: flex-start; }
    .grid, .layout, .chat-layout { grid-template-columns: 1fr; }
    .notification { flex-direction: column; }
    .notification span { white-space: normal; }
    .chat-actions { flex-direction: column; align-items: stretch; }
  }
`;
