/** The local Backend, used when the build does not name another one. */
const LOCAL_API_ORIGIN = 'http://localhost:3000';

/**
 * Where the Backend lives, without a trailing slash. A deployed build sets `VITE_API_ORIGIN`
 * (for example `https://api.example.co.nz`); an `https` origin also makes dictation use `wss`.
 */
export const resolveApiOrigin = (configured: string | undefined): string =>
  (configured?.trim() || LOCAL_API_ORIGIN).replace(/\/+$/, '');

export const API_ORIGIN = resolveApiOrigin(import.meta.env.VITE_API_ORIGIN);

export const API_BASE_URL = `${API_ORIGIN}/api`;

/** `http(s)://` becomes `ws(s)://`; the path and host are the API's own. */
export const toWebSocketUrl = (httpUrl: string): string => httpUrl.replace(/^http/i, 'ws');

/** Live dictation socket, served by the Backend next to the REST routes. */
export const SPEECH_STREAM_URL = toWebSocketUrl(`${API_BASE_URL}/speech/stream`);
