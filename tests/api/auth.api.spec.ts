import { expect, test } from '@playwright/test';
import { ENV } from '../../config/env';
import { authRequest, rpcCore, tokenHeader } from '../../api/rpc';

test.describe('API: контракты авторизации', () => {
  test('@api POST /auth корректные учётные данные — 200, токен и профиль', async ({ request }) => {
    const response = await authRequest(request, ENV.mainLogin, ENV.mainPassword);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);
    expect(body.user.login).toBe(ENV.mainLogin);
    expect(typeof body.user.profile).toBe('string');
  });

  test('@api POST /auth неверный пароль — 401 и сообщение', async ({ request }) => {
    const response = await authRequest(request, ENV.mainLogin, 'AT_wrong_pass_123');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.meta.success).toBe(false);
    expect(body.meta.msg).toBe('Пользователь не авторизован.');
  });

  test('@api POST /auth пустые UserName/Password — 401 и success=false', async ({ request }) => {
    const response = await authRequest(request, '', '');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.meta.success).toBe(false);
  });

  test('@api rpc/core of_users с валидным токеном — 200 и записи пользователей', async ({ request }) => {
    const response = await rpcCore(
      request,
      { action: 'of_users', method: 'Select', data: [{ params: [null], limit: 10, sort: [], filter: [] }] },
      tokenHeader(ENV.mainLogin, ENV.mainPassword),
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body[0].meta.success).toBe(true);

    const records: Record<string, unknown>[] = body[0].result.records;
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeGreaterThan(0);
    expect(records[0]).toHaveProperty('c_login');
    expect(records[0]).toHaveProperty('c_profile_const');
  });

  test('@api rpc/core без токена — 401', async ({ request }) => {
    const response = await rpcCore(request, {
      action: 'of_users',
      method: 'Select',
      data: [{ params: [null], limit: 1, sort: [], filter: [] }],
    });

    expect(response.status()).toBe(401);
    // Ошибка авторизации приходит объектом (успешный ответ — массивом)
    const body = await response.json();
    expect(body.meta.success).toBe(false);
  });
});
