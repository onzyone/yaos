# YAOS (Yet Another Obsidian Sync)

**YAOS makes Obsidian sync feel like Apple Notes or Google Docs.** It is a free, self-hosted, and local-first sync engine that updates your notes instantly across all your devices.

Under the hood, it is a real-time CRDT engine running on Cloudflare Durable Objects. For the average user, hosting it yourself costs exactly $0/month on Cloudflare's free tier.

### Features

- **Instant Sync:** Changes update in milliseconds.
- **Zero Conflicts:** You never see a "File modified externally" error again.
- **Offline-First:** Go offline, edit for days, and everything merges perfectly when you reconnect.
- **Zero-Config Setup:** Deploy with one click. Claim your server in the browser. Scan a link to pair your devices. *No terminal required.*
- **Attachments & Backups (Optional):** Sync your images/PDFs and automatic daily backups, allowing you to selectively restore files if you accidentally delete something.

If you want the absolute best, zero-effort experience, you should pay for the official Obsidian Sync. If you want a free, instant, local-first alternative that you fully control, this is YAOS.

### Quick Start (5 Minutes)

YAOS requires two things: a free Cloudflare edge server, and the Obsidian plugin. 

**Step 1: Deploy your Server**
Click this button to deploy your personal sync server. It costs $0 and requires no terminal.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kavinsood/yaos/tree/main/server)

**Step 2: Claim your Server**
Open the URL Cloudflare generates for you. Click "Claim" to generate your secure token and lock the server to you. **Keep this page open.**

**Step 3: Install the Plugin (Beta)**
*YAOS is currently in the Obsidian Marketplace review queue. To use it today:*
1. Install **BRAT** from the Obsidian Community Plugins.
2. Open BRAT settings, click "Add Beta plugin", and paste: `kavinsood/yaos`
3. Go back to Community Plugins and **enable YAOS**.

**Step 4: Connect**
Go back to your Claim page and check the box confirming you installed the plugin. Click the "Auto-Configure" button. Obsidian will open, and your vault is now syncing.

### How is this different from iCloud or Remotely Save?

*Most free ways to sync Obsidian (like Dropbox, iCloud, or community plugins) are just moving files back and forth on a timer.
- If you edit on your phone and quickly close the app, the file might not upload. 
- If you edit the same note on your laptop and your phone, you get an annoying "Conflicted Copy".

**YAOS syncs keystrokes, not files.** If you edit on two devices at once, the text merges flawlessly. Go offline for days, and everything reconciles mathematically when you reconnect.

If you want the design rationale and internals, read these:

This repository keeps deep architecture notes under [`engineering/`](./engineering), with diagrams and operational limits documented alongside implementation details

- **[Monolithic vault CRDT](./engineering/monolith.md):** Why YAOS keeps one vault-level `Y.Doc`, what we gain (cross-file transactional behavior), and what we consciously trade off.
- **[Filesystem bridge](./engineering/filesystem-bridge.md):** How noisy Obsidian file events are converted into safe CRDT updates with dirty-set draining and content-acknowledged suppression.
- **[Attachment sync and R2 proxy model](./engineering/attachment-sync.md):** Native Worker proxy uploads, capability negotiation, and bounded fan-out under Cloudflare connection limits.
- **[Checkpoint + journal persistence](./engineering/checkpoint-journal.md):** The storage-engine rewrite that removed full-state rewrites and introduced state-vector-anchored delta journaling.
- **[Zero-config auth and claim flow](./engineering/zero-config-auth.md):** Browser claim UX, `obsidian://yaos` deep-link pairing, and env-token override behavior.
- **[Warts and limits](./engineering/warts-and-limits.md):** Canonical limits, safety invariants, and the pragmatic compromises currently in production.
- **[Queue pool behavior](./engineering/queue-pool.md):** Why attachment transfer queues currently favor deterministic behavior over maximal throughput.


### Configuration

After enabling, go to **Settings → YAOS**:

| Setting | Description |
|---------|-------------|
| **Server host** | Your server URL (e.g., `https://sync.yourdomain.com`) |
| **Token** | Paste the token from the YAOS setup link (or from a manual `SYNC_TOKEN` override if you use one) |
| **Vault ID** | Unique ID for this vault (auto-generated if blank). Same ID = same vault across devices. |
| **Device name** | Shown in remote cursors |

### Optional settings

| Setting | Description |
|---------|-------------|
| **Exclude patterns** | Comma-separated prefixes to skip (e.g., `templates/, .trash/`) |
| **Max file size** | Skip files larger than this (default 2 MB) |
| **Max attachment size** | Skip attachments larger than this (default 10 MB) |
| **External edit policy** | How to handle edits from git/other tools: Always, Only when closed, Never |
| **Sync attachments** | Enable R2-based sync for non-markdown files |
| **Show remote cursors** | Display collaborator cursor positions |
| **Debug logging** | Verbose console output |

Changes to host/token/vault ID require reloading the plugin.

## Commands

Access via command palette (Ctrl/Cmd+P):

| Command | Description |
|---------|-------------|
| **Reconnect to sync server** | Force reconnect after network changes |
| **Force reconcile** | Re-merge disk state with CRDT |
| **Show sync debug info** | Connection state, file counts, queue status |
| **Take snapshot now** | Create an immediate backup to R2 |
| **Browse and restore snapshots** | View snapshots, diff against current state, selective restore |
| **Reset local cache** | Clear IndexedDB, re-sync from server |
| **Nuclear reset** | Wipe all CRDT state everywhere, re-seed from disk |

## Snapshots

Snapshots are point-in-time backups of your vault's CRDT state, stored in R2.

- **Daily automatic**: A snapshot is taken automatically once per day when Obsidian opens
- **On-demand**: Use "Take snapshot now" before risky operations (AI refactors, bulk edits)
- **Selective restore**: Browse snapshots, see a diff of what changed, restore individual files
- **Undelete**: Restore files that were deleted since the snapshot
- **Pre-restore backup**: Before restoring, current file content is saved to `.obsidian/plugins/yaos/restore-backups/`

Requires R2 to be configured on the server.

## How it works

1. Each markdown file gets a stable ID and a `Y.Text` CRDT for its content
2. Today, those per-file `Y.Text` values live inside one shared vault-level `Y.Doc`, which keeps collaboration simple and fast for normal-sized note vaults
3. Live editor edits flow through the Yjs binding to that shared document
4. One vault maps to one Durable Object-backed sync room, so the shared state survives server restarts
5. Offline edits are stored in IndexedDB and sync on reconnect
6. Attachments sync separately via content-addressed R2 storage instead of being forced through the text CRDT
7. Daily and on-demand snapshots exist as a safety net

In practice, that means:

- your vault still exists locally as normal files
- Obsidian keeps behaving like Obsidian
- YAOS keeps the disk mirror and the shared CRDT state aligned instead of asking devices to take polite turns uploading files later

## Limits and Tradeoffs

YAOS is optimized for personal or small-team note vaults, not for arbitrarily huge filesystem trees.

It currently keeps one shared `Y.Doc` for the vault, which keeps collaboration simple but gives the design a memory ceiling for large vaults.

If you're going to dump 100K line log files or scrape Wikipedia, a dumb sync platform like Google Drive or Syncthing is preferable.

YAOS trades infinite scalability for perfect real-time ergonomics.

A vault of upto 50 MB of raw text (not including attachments like images and PDFs) will work beautifully.

## Troubleshooting

**"Unauthorized" errors**: Token mismatch between plugin and server. Check both match exactly.

**"R2 not configured"**: The server does not have a `YAOS_BUCKET` binding yet. See the server README for setup.

**Sync stops on mobile**: Use "Reconnect to sync server" command. Check you have network connectivity.

**Files not syncing**: Check exclude patterns. Files over max size are skipped. Use debug logging to see what's happening, and then raise an issue on GitHub.

**Conflicts after offline edits**: CRDTs merge automatically but the result depends on operation order. Review merged content if needed.

## License

[0-BSD](LICENSE)
