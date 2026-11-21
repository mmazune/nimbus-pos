import { randomBytes } from 'crypto';
import { assertDisposableEventDb } from './event-db-guard';

// Throwaway credentials made at run time: no credential literal lives in this file.
const user = 'u' + randomBytes(3).toString('hex');
const secret = randomBytes(9).toString('hex');
const url = (host: string, db: string, port = 5432) => {
  const u = new URL('postgresql://localhost');
  u.hostname = host;
  u.port = String(port);
  u.pathname = `/${db}`;
  u.username = user;
  u.password = secret;
  return u.toString();
};

describe('assertDisposableEventDb', () => {
  it('accepts a local nimbus_event_ database', () => {
    expect(() => assertDisposableEventDb(url('localhost', 'nimbus_event_h1'))).not.toThrow();
    expect(() => assertDisposableEventDb(url('127.0.0.1', 'nimbus_event_x'))).not.toThrow();
  });

  it('refuses a remote host and never echoes credentials', () => {
    let message = '';
    try {
      assertDisposableEventDb(url('db.example.invalid', 'nimbus_event_h1'));
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/not localhost/);
    expect(message).not.toContain(secret);
    expect(message).not.toContain(user);
  });

  it('refuses a local database whose name is not nimbus_event_*', () => {
    expect(() => assertDisposableEventDb(url('localhost', 'nimbus_pos'))).toThrow(/nimbus_event_/);
  });

  it('refuses a missing or unparseable URL', () => {
    expect(() => assertDisposableEventDb('')).toThrow(/not set/);
    expect(() => assertDisposableEventDb('not a url')).toThrow(/parseable/);
  });
});
