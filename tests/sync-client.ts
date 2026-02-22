/**
 * Test client: connects to the same PartyKit room as the Obsidian plugin
 * and appends a line to a file's Y.Text to verify real-time sync.
 *
 * Usage: bun run test-client.ts [path] [message]
 */
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";

const HOST = "http://127.0.0.1:1999";
const TOKEN = "zJ+NSVqXL1UdaNTZcDPwWMMXt/t+xFmbt5RDVC0Zbt4=";
const VAULT_ID = "Y_V6DTp2WL2ARQZuRPaXzQ";
const ROOM_ID = "v1:" + VAULT_ID;

const targetPath = process.argv[2] || "hi.md";
const message = process.argv[3] || "\n\nhello from the test client — if you see this, sync works";

console.log(`Connecting to ${HOST} room=${ROOM_ID}`);
console.log(`Target file: "${targetPath}"`);

const ydoc = new Y.Doc();
const pathToId = ydoc.getMap<string>("pathToId");
const idToText = ydoc.getMap<Y.Text>("idToText");

const provider = new YPartyKitProvider(HOST, ROOM_ID, ydoc, {
	params: { token: TOKEN },
	connect: true,
});

provider.on("status", (event: { status: string }) => {
	console.log(`Provider status: ${event.status}`);
});

// Wait for sync, then inject text
provider.on("sync", (synced: boolean) => {
	if (!synced) return;

	console.log(`Synced. pathToId has ${pathToId.size} entries.`);

	const fileId = pathToId.get(targetPath);
	if (!fileId) {
		console.error(`File "${targetPath}" not found in CRDT. Available paths:`);
		pathToId.forEach((_id, path) => console.log(`  - ${path}`));
		cleanup();
		return;
	}

	const ytext = idToText.get(fileId);
	if (!ytext) {
		console.error(`Y.Text not found for fileId=${fileId}`);
		cleanup();
		return;
	}

	console.log(`Found "${targetPath}" (id=${fileId}), current length: ${ytext.length}`);
	console.log(`Appending: "${message}"`);

	ytext.insert(ytext.length, message);

	console.log("Done. New length:", ytext.length);

	// Give it a moment to propagate, then exit
	setTimeout(() => cleanup(), 1000);
});

function cleanup() {
	provider.destroy();
	ydoc.destroy();
	process.exit(0);
}

// Timeout safety
setTimeout(() => {
	console.error("Timed out after 10s");
	cleanup();
}, 10_000);
