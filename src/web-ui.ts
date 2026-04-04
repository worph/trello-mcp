export function getIndexHtml(baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trello MCP — Setup</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
    .container { max-width: 640px; margin: 40px auto; padding: 0 20px; }
    h1 { font-size: 1.5rem; margin-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 32px; }
    .card { background: #fff; border-radius: 8px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card h2 { font-size: 1.1rem; margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
    .step-num { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: #0079bf; color: #fff; font-size: 0.8rem; font-weight: 700; margin-right: 8px; flex-shrink: 0; }
    .step-num.done { background: #27ae60; }
    .step { margin-bottom: 20px; }
    .step-header { display: flex; align-items: center; font-weight: 600; margin-bottom: 8px; }
    .step-body { margin-left: 32px; }
    .step-body a { color: #0079bf; }
    label { display: block; font-weight: 600; margin-bottom: 4px; font-size: 0.9rem; }
    input[type="text"] {
      width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px;
      font-size: 0.95rem; font-family: monospace; margin-bottom: 4px;
    }
    input:focus { outline: none; border-color: #0079bf; box-shadow: 0 0 0 2px rgba(0,121,191,0.2); }
    .hint { font-size: 0.8rem; color: #999; margin-bottom: 16px; }
    .btn { background: #0079bf; color: #fff; border: none; padding: 10px 24px; border-radius: 4px; font-size: 0.95rem; cursor: pointer; display: inline-block; text-decoration: none; }
    .btn:hover { background: #026aa7; }
    .btn:disabled { background: #999; cursor: not-allowed; }
    .btn-secondary { background: #6c757d; }
    .btn-secondary:hover { background: #5a6268; }
    .btn-authorize { background: #27ae60; font-size: 1rem; padding: 12px 32px; }
    .btn-authorize:hover { background: #219a52; }
    .btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .status-bar { padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 0.9rem; }
    .status-bar.ok { background: #e6f9e6; color: #1a7a1a; border: 1px solid #b3e6b3; }
    .status-bar.no { background: #fff3cd; color: #856404; border: 1px solid #ffc107; }
    .status-bar .user { font-weight: 600; }
    .flash { margin-top: 16px; padding: 10px 12px; border-radius: 4px; display: none; font-size: 0.9rem; }
    .flash.success { display: block; background: #e6f9e6; color: #1a7a1a; border: 1px solid #b3e6b3; }
    .flash.error { display: block; background: #fce4e4; color: #c0392b; border: 1px solid #f5c6cb; }
    .flash.info { display: block; background: #e8f4fd; color: #2980b9; border: 1px solid #bee5eb; }
    .hidden { display: none; }
    .divider { border: none; border-top: 1px solid #eee; margin: 20px 0; }
    .token-saved { display: inline-flex; align-items: center; gap: 6px; color: #27ae60; font-size: 0.9rem; font-weight: 600; }
    .token-saved svg { width: 16px; height: 16px; fill: #27ae60; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Trello MCP Server</h1>
    <p class="subtitle">Connect your Trello account to enable board management tools.</p>

    <div class="card">
      <h2>Setup</h2>
      <div id="status-bar" class="status-bar no">Not connected</div>

      <!-- Step 1: API Key -->
      <div class="step">
        <div class="step-header"><span class="step-num" id="step1-num">1</span> Enter your API Key</div>
        <div class="step-body">
          <p style="font-size:0.9rem;color:#666;margin-bottom:8px">
            Go to <a href="https://trello.com/power-ups/admin" target="_blank">Power-Ups Admin</a>
            and click <strong>New</strong>, then fill in the form:
          </p>
          <ul style="font-size:0.85rem;color:#666;margin-bottom:8px;padding-left:18px">
            <li><strong>App name</strong> — anything you want (e.g. "Trello MCP")</li>
            <li><strong>Workspace</strong> — pick your workspace</li>
            <li><strong>Iframe connector URL</strong> — enter <strong id="iframeUrl"></strong></li>
            <li>Other fields — use your email, leave defaults</li>
          </ul>
          <p style="font-size:0.9rem;color:#666;margin-bottom:8px">
            After creating the app, scroll down to find your <strong>API Key</strong> on the app page.
            Then go to the <strong>API key</strong> section and add your allowed origin:
          </p>
          <div style="background:#f0f0f0;padding:8px 12px;border-radius:4px;font-family:monospace;font-size:0.85em;margin-bottom:12px;word-break:break-all" id="allowedOrigin"></div>
          <p style="font-size:0.9rem;color:#666;margin-bottom:8px">
            Copy the <strong>API Key</strong> and paste it below.
          </p>
          <p style="font-size:0.9rem;color:#666;margin-bottom:8px">
          </p>
          <input type="text" id="apiKey" placeholder="Your API key" autocomplete="off">
        </div>
      </div>

      <!-- Step 2: Authorize -->
      <div class="step">
        <div class="step-header"><span class="step-num" id="step2-num">2</span> Connect to Trello</div>
        <div class="step-body">
          <p style="font-size:0.9rem;color:#666;margin-bottom:12px">
            This opens Trello in a new tab. Click <strong>Allow</strong> and you'll be redirected back here automatically.
          </p>
          <div id="token-status"></div>
          <a id="authorizeBtn" class="btn btn-authorize" href="#" target="_blank" onclick="return startAuth()">
            Authorize with Trello
          </a>
          <p id="no-key-hint" class="hidden" style="color:#c0392b;font-size:0.85rem;margin-top:8px">
            Enter your API key first
          </p>
        </div>
      </div>

      <hr class="divider">

      <!-- Optional settings -->
      <details style="margin-bottom:16px">
        <summary style="cursor:pointer;font-weight:600;font-size:0.9rem;color:#666">Advanced settings (optional)</summary>
        <div style="margin-top:12px">
          <label for="boardId">Default Board ID</label>
          <input type="text" id="boardId" placeholder="e.g. 60a1b2c3d4e5f6...">
          <p class="hint">Found in board URL: trello.com/b/<strong>BOARD_ID</strong>/board-name</p>

          <label for="workspaceId">Default Workspace ID</label>
          <input type="text" id="workspaceId" placeholder="e.g. myworkspace">
        </div>
      </details>

      <div class="btn-row">
        <button class="btn" id="saveBtn" onclick="saveConfig()">Save Settings</button>
      </div>
      <div id="flash" class="flash"></div>
    </div>
  </div>

  <script>
    const BASE_URL = ${JSON.stringify(baseUrl)};
    const CALLBACK_URL = BASE_URL + '/callback';

    function getAuthorizeUrl() {
      const key = document.getElementById('apiKey').value.trim();
      if (!key) return null;
      return 'https://trello.com/1/authorize?response_type=token&key=' + encodeURIComponent(key)
        + '&scope=read,write&expiration=never&name=trello-mcp'
        + '&callback_method=fragment&return_url=' + encodeURIComponent(CALLBACK_URL);
    }

    function startAuth() {
      const apiKey = document.getElementById('apiKey').value.trim();
      if (!apiKey) {
        document.getElementById('no-key-hint').classList.remove('hidden');
        setTimeout(() => document.getElementById('no-key-hint').classList.add('hidden'), 3000);
        return false;
      }
      // Save the API key before redirecting so the callback can use it
      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      }).then(() => {
        window.open(getAuthorizeUrl(), '_blank');
      });
      return false;
    }

    // Listen for token from callback page via postMessage
    window.addEventListener('message', async (event) => {
      if (event.data && event.data.type === 'trello-token' && event.data.token) {
        showFlash('Token received! Connecting...', 'info');
        const apiKey = document.getElementById('apiKey').value.trim();
        const resp = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            token: event.data.token,
            boardId: document.getElementById('boardId').value.trim() || undefined,
            workspaceId: document.getElementById('workspaceId').value.trim() || undefined,
          }),
        });
        const data = await resp.json();
        if (resp.ok && data.connected) {
          showFlash('Connected to Trello!', 'success');
        } else {
          showFlash(data.error || data.message || 'Connection failed', 'error');
        }
        await loadConfig();
      }
    });

    async function loadConfig() {
      try {
        const resp = await fetch('/api/config');
        const data = await resp.json();
        if (data.apiKey) document.getElementById('apiKey').value = data.apiKey;
        if (data.boardId) document.getElementById('boardId').value = data.boardId;
        if (data.workspaceId) document.getElementById('workspaceId').value = data.workspaceId;
        updateStatusBar(data);
      } catch {}
    }

    function updateStatusBar(data) {
      const bar = document.getElementById('status-bar');
      const tokenEl = document.getElementById('token-status');
      const step1 = document.getElementById('step1-num');
      const step2 = document.getElementById('step2-num');

      if (data.connected && data.username) {
        bar.className = 'status-bar ok';
        bar.innerHTML = 'Connected as <span class="user">' + escapeHtml(data.username) + '</span>';
        step1.classList.add('done');
        step2.classList.add('done');
        tokenEl.innerHTML = '<p class="token-saved" style="margin-bottom:12px"><svg viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z"/></svg> Token saved</p>';
      } else if (data.apiKey && data.hasToken) {
        bar.className = 'status-bar no';
        bar.innerHTML = 'Credentials saved but could not verify connection';
        step1.classList.add('done');
        tokenEl.innerHTML = '<p class="token-saved" style="margin-bottom:12px"><svg viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z"/></svg> Token saved</p>';
      } else {
        bar.className = 'status-bar no';
        bar.innerHTML = 'Not connected — complete the steps below';
        step1.classList.remove('done');
        step2.classList.remove('done');
        tokenEl.innerHTML = '';
      }
    }

    function showFlash(msg, type) {
      const el = document.getElementById('flash');
      el.textContent = msg;
      el.className = 'flash ' + type;
    }

    function escapeHtml(s) {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    async function saveConfig() {
      const btn = document.getElementById('saveBtn');
      btn.disabled = true;
      btn.textContent = 'Saving...';
      try {
        const body = {
          apiKey: document.getElementById('apiKey').value.trim(),
          boardId: document.getElementById('boardId').value.trim() || undefined,
          workspaceId: document.getElementById('workspaceId').value.trim() || undefined,
        };
        const resp = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await resp.json();
        if (resp.ok) {
          showFlash(data.message || 'Saved!', 'success');
          await loadConfig();
        } else {
          showFlash(data.error || 'Save failed', 'error');
        }
      } catch (err) {
        showFlash('Network error: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save Settings';
      }
    }

    // Populate URLs from BASE_URL
    document.getElementById('iframeUrl').textContent = BASE_URL;
    document.getElementById('allowedOrigin').textContent = new URL(BASE_URL).origin;

    loadConfig();
  </script>
</body>
</html>`;
}

export function getCallbackHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trello MCP — Connecting...</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; color: #333; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 8px; padding: 32px; max-width: 440px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .spinner { width: 32px; height: 32px; border: 3px solid #eee; border-top-color: #0079bf; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { font-size: 1.2rem; margin-bottom: 8px; }
    p { color: #666; font-size: 0.9rem; }
    .success { color: #27ae60; }
    .error { color: #c0392b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner" id="spinner"></div>
    <h2 id="title">Connecting...</h2>
    <p id="message">Sending token back to Trello MCP</p>
  </div>
  <script>
    const hash = window.location.hash;
    const match = hash.match(/token=([^&]+)/);

    if (match && match[1]) {
      const token = decodeURIComponent(match[1]);

      // Send token to the opener window
      if (window.opener) {
        window.opener.postMessage({ type: 'trello-token', token: token }, '*');
        document.getElementById('spinner').style.display = 'none';
        document.getElementById('title').textContent = 'Connected!';
        document.getElementById('title').className = 'success';
        document.getElementById('message').textContent = 'You can close this tab.';
        setTimeout(() => window.close(), 1500);
      } else {
        // Opened in same tab or opener lost — save directly via API
        fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token }),
        }).then(r => r.json()).then(data => {
          document.getElementById('spinner').style.display = 'none';
          if (data.connected) {
            document.getElementById('title').textContent = 'Connected!';
            document.getElementById('title').className = 'success';
            document.getElementById('message').textContent = 'Redirecting...';
            setTimeout(() => window.location.href = '/', 1000);
          } else {
            document.getElementById('title').textContent = 'Connection failed';
            document.getElementById('title').className = 'error';
            document.getElementById('message').textContent = data.error || 'Check your API key and try again.';
          }
        }).catch(err => {
          document.getElementById('spinner').style.display = 'none';
          document.getElementById('title').textContent = 'Error';
          document.getElementById('title').className = 'error';
          document.getElementById('message').textContent = err.message;
        });
      }
    } else {
      document.getElementById('spinner').style.display = 'none';
      document.getElementById('title').textContent = 'Authorization failed';
      document.getElementById('title').className = 'error';
      document.getElementById('message').textContent = 'No token received. Please try again.';
    }
  </script>
</body>
</html>`;
}
