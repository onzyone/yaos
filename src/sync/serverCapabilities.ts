export interface ServerCapabilities {
	claimed: boolean;
	authMode: "env" | "claim" | "unclaimed";
	attachments: boolean;
	snapshots: boolean;
}

export async function fetchServerCapabilities(host: string): Promise<ServerCapabilities> {
	const base = host.replace(/\/$/, "");
	const res = await fetch(`${base}/api/capabilities`, {
		method: "GET",
	});
	if (!res.ok) {
		throw new Error(`capabilities request failed (${res.status})`);
	}
	return await res.json() as ServerCapabilities;
}
