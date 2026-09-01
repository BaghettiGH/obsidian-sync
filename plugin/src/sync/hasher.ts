/**
 * Computes a SHA-256 hash of file content, used to detect real content
 * changes vs. metadata-only touches (e.g. Obsidian re-saving a file with
 * identical content after a plugin re-render).
 *
 * Uses the Web Crypto API (available in Obsidian's Electron/mobile runtime)
 * rather than Node's `crypto` module, since this needs to work on both
 * desktop and mobile without relying on Node-only APIs.
 */
export async function hashContent(content: ArrayBuffer | string): Promise<string> {
	const data =
		typeof content === 'string' ? new TextEncoder().encode(content) : content;

	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));

	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}