import { assertDisposableEventDb } from './event-db-guard';

describe('assertDisposableEventDb', () => {
  it('accepts a local nimbus_event_ database', () => {
    expect(() =>
      assertDisposableEventDb('postgresql://u:p@localhost:55471/nimbus_event_h1'),
    ).not.toThrow();
    expect(() =>
      assertDisposableEventDb('postgresql://u:p@127.0.0.1:55471/nimbus_event_x'),
    ).not.toThrow();
  });

  it('refuses a remote host and never echoes credentials', () => {
    let message = '';
    try {
      assertDisposableEventDb(
        'postgresql://someuser:s3cretpw@db.example.invalid:5432/nimbus_event_h1',
      );
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/not localhost/);
    expect(message).not.toMatch(/s3cretpw|someuser/);
  });

  it('refuses a local database whose name is not nimbus_event_*', () => {
    expect(() => assertDisposableEventDb('postgresql://u:p@localhost:5432/nimbus_pos')).toThrow(
      /nimbus_event_/,
    );
  });

  it('refuses a missing or unparseable URL', () => {
    expect(() => assertDisposableEventDb('')).toThrow(/not set/);
    expect(() => assertDisposableEventDb('not a url')).toThrow(/parseable/);
  });
});
