import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * M2 Auth e2e tests.
 * These tests run against the real database (Neon).
 * Seed must have been run before executing these tests.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health — should still work', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body.status).toBe('ok');
      });
  });

  it('POST /api/auth/login — happy path', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('owner@demo.local');
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  }, 30000);

  it('POST /api/auth/login — invalid password → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'wrong' })
      .expect(401);
  }, 30000);

  it('POST /api/auth/login — invalid payload → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(400);
  });

  it('GET /api/auth/me — with valid token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.email).toBe('owner@demo.local');
    expect(res.body.roles).toBeDefined();
    expect(res.body.permissions).toBeDefined();
  });

  it('GET /api/auth/me — without token → 401', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('GET /api/auth/sessions — lists active sessions', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.sessions).toBeDefined();
    expect(Array.isArray(res.body.sessions)).toBe(true);
  });

  it('POST /api/auth/refresh — rotates token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    // Old refresh token should now be invalid
    refreshToken = res.body.refreshToken;
    accessToken = res.body.accessToken;
  }, 30000);

  it('POST /api/auth/pin-login — happy path', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/pin-login')
      .send({ email: 'owner@demo.local', pin: '1234' })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  }, 30000);

  it('POST /api/auth/pin-login — wrong pin → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/pin-login')
      .send({ email: 'owner@demo.local', pin: '0000' })
      .expect(401);
  }, 30000);

  it('GET /api/auth/_perm-test — owner should pass', async () => {
    // Login as owner first for fresh token
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/auth/_perm-test')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .expect(200);

    expect(res.body.message).toBe('Permission check passed');
  }, 30000);

  it('GET /api/auth/_perm-test — waiter should get 403 (insufficient perms)', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'waiter@demo.local', password: 'Waiter#123' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/auth/_perm-test')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .expect(403);
  }, 30000);

  it('GET /api/auth/_perm-test — waiter on WEB_BACKOFFICE → 403 (platform denied)', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'waiter@demo.local',
        password: 'Waiter#123',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/auth/_perm-test')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .set('X-Platform', 'WEB_BACKOFFICE')
      .expect(403);
  }, 30000);

  it('POST /api/auth/logout — revokes session', async () => {
    // Login fresh
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .expect(201);
  }, 30000);
});
