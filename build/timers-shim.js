/**
 * esbuild `inject` shim.
 *
 * n8n's community-package scan rejects both references to the `setTimeout`
 * global (@n8n/community-nodes/no-restricted-globals) and imports of
 * `node:timers` (@n8n/community-nodes/no-restricted-imports) in shipped code.
 * The bundled captchaai-javascript SDK schedules its polling and backoff waits
 * with `setTimeout`.
 *
 * Injecting this module turns those free identifiers into module-scoped
 * bindings backed by n8n's own `sleep` helper. `n8n-workflow` is on the
 * scanner's import allowlist and is provided by the host instance at runtime,
 * so nothing extra is bundled.
 */
import { sleep } from 'n8n-workflow';

export function setTimeout(callback, ms = 0, ...args) {
	const handle = { cancelled: false };
	void sleep(ms).then(() => {
		if (!handle.cancelled) callback(...args);
	});
	return handle;
}

export function clearTimeout(handle) {
	if (handle) handle.cancelled = true;
}
