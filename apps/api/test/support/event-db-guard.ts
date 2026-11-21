/**
 * Refuses to let an event integration test run against anything but a disposable local
 * database. The URL is parsed, never printed: the error names the host and database only.
 */
export function assertDisposableEventDb(rawUrl: string | undefined = process.env.DATABASE_URL): void {
  if (!rawUrl) {
    throw new Error('Refusing to run: DATABASE_URL is not set (pass the disposable URL inline).');
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Refusing to run: DATABASE_URL is not a parseable URL.');
  }
  const host = parsed.hostname;
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`Refusing to run: database host "${host}" is not localhost or 127.0.0.1.`);
  }
  if (!name.startsWith('nimbus_event_')) {
    throw new Error(`Refusing to run: database name "${name}" does not start with "nimbus_event_".`);
  }
}
