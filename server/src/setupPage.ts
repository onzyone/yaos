interface SetupPageOptions {
	host: string;
}

interface RunningPageOptions {
	host: string;
	authMode: "env" | "claim";
	attachments: boolean;
	snapshots: boolean;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function renderSetupPage(options: SetupPageOptions): string {
	const safeHost = escapeHtml(options.host);
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Claim YAOS server</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: radial-gradient(circle at top, #16324f, #08111d 60%);
      color: #f4f7fb;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .card {
      width: min(560px, 100%);
      background: rgba(8, 17, 29, 0.92);
      border: 1px solid rgba(161, 205, 255, 0.22);
      border-radius: 18px;
      padding: 28px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
    }
    h1 { margin: 0 0 12px; font-size: 28px; }
    p { margin: 0 0 14px; line-height: 1.5; color: #d9e6f4; }
    .hint { font-size: 13px; color: #a9c0d8; }
    button, a.cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 999px;
      padding: 12px 18px;
      background: #7bdff6;
      color: #08111d;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      margin-top: 8px;
    }
    button[disabled] { opacity: 0.6; cursor: wait; }
    .stack { display: grid; gap: 12px; margin-top: 18px; }
    .panel {
      display: none;
      background: rgba(123, 223, 246, 0.08);
      border: 1px solid rgba(123, 223, 246, 0.18);
      border-radius: 14px;
      padding: 14px;
    }
    .panel.show { display: block; }
    code, textarea {
      width: 100%;
      box-sizing: border-box;
      border-radius: 10px;
      border: 1px solid rgba(161, 205, 255, 0.22);
      background: rgba(4, 10, 18, 0.9);
      color: #f4f7fb;
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 12px;
      padding: 10px;
    }
    textarea { min-height: 78px; resize: vertical; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; }
    .ghost {
      background: transparent;
      color: #d9e6f4;
      border: 1px solid rgba(161, 205, 255, 0.22);
    }
    #status { min-height: 22px; color: #ffd8a8; }
  </style>
</head>
<body>
  <main class="card">
    <h1>Claim your YAOS server</h1>
    <p>This Worker is ready for markdown sync. Claim it once, then open Obsidian with a one-tap setup link.</p>
    <p class="hint">Server: ${safeHost}</p>
    <div id="status" aria-live="polite"></div>
    <button id="claim">Claim server</button>
    <div id="success" class="panel stack">
      <p><strong>Saved.</strong> This token is shown only here. Keep it somewhere safe.</p>
      <label>
        <span class="hint">Token</span>
        <textarea id="token" readonly></textarea>
      </label>
      <label>
        <span class="hint">Obsidian setup link</span>
        <textarea id="pair" readonly></textarea>
      </label>
      <div class="row">
        <a id="open" class="cta" href="#">Open in Obsidian</a>
        <button id="copy-token" class="ghost" type="button">Copy token</button>
        <button id="copy-link" class="ghost" type="button">Copy link</button>
      </div>
    </div>
  </main>
  <script>
    const claimButton = document.getElementById("claim");
    const statusEl = document.getElementById("status");
    const successEl = document.getElementById("success");
    const tokenEl = document.getElementById("token");
    const pairEl = document.getElementById("pair");
    const openEl = document.getElementById("open");
    const copyTokenEl = document.getElementById("copy-token");
    const copyLinkEl = document.getElementById("copy-link");

    function randomToken() {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
    }

    async function copy(text) {
      await navigator.clipboard.writeText(text);
      statusEl.textContent = "Copied to clipboard.";
    }

    claimButton.addEventListener("click", async () => {
      claimButton.disabled = true;
      statusEl.textContent = "Claiming server...";
      const token = randomToken();

      try {
        const res = await fetch("/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data && data.error ? data.error : "claim failed");
        }

        tokenEl.value = token;
        pairEl.value = data.obsidianUrl || "";
        openEl.href = data.obsidianUrl || "#";
        successEl.classList.add("show");
        statusEl.textContent = "Server claimed. Open the link on the device you want to connect.";
      } catch (error) {
        statusEl.textContent = "Claim failed: " + (error && error.message ? error.message : String(error));
        claimButton.disabled = false;
      }
    });

    copyTokenEl.addEventListener("click", () => copy(tokenEl.value));
    copyLinkEl.addEventListener("click", () => copy(pairEl.value));
  </script>
</body>
</html>`;
}

export function renderRunningPage(options: RunningPageOptions): string {
	const safeHost = escapeHtml(options.host);
	const authLabel = options.authMode === "env"
		? "This deployment is locked by an environment token."
		: "This deployment has already been claimed.";
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>YAOS server</title>
  <style>
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: #09111b;
      color: #eef5fb;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .card {
      width: min(520px, 100%);
      background: #101b29;
      border: 1px solid #23384f;
      border-radius: 18px;
      padding: 24px;
    }
    h1 { margin: 0 0 12px; font-size: 28px; }
    p { margin: 0 0 10px; line-height: 1.5; }
    ul { margin: 14px 0 0; padding-left: 18px; color: #c8d8e8; }
    code { color: #9fe3f6; }
  </style>
</head>
<body>
  <main class="card">
    <h1>YAOS server is running</h1>
    <p>${authLabel}</p>
    <p>Host: <code>${safeHost}</code></p>
    <ul>
      <li>Attachments: ${options.attachments ? "enabled" : "disabled"}</li>
      <li>Snapshots: ${options.snapshots ? "enabled" : "disabled"}</li>
    </ul>
  </main>
</body>
</html>`;
}
