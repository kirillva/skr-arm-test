import { APIRequestContext, Page } from '@playwright/test';
import { ENV } from '../config/env';

/**
 * Захватывает токен текущей сессии приложения из заголовков rpc-authorization его же запросов.
 * Нужен потому, что после маскировки токен выдаётся сервером по ключу устройства
 * и недоступен расчётом из логина/пароля.
 * Возвращает геттер: строку токена ("Token ...") или null, пока запросов не было.
 */
export function attachRpcTokenCapture(page: Page): () => string | null {
  let token: string | null = null;
  page.on('request', (req) => {
    const value = req.headers()['rpc-authorization'];
    if (value && value.startsWith('Token ')) token = value;
  });
  return () => token;
}

/** RPC к бэкенду АРМ с указанным заголовком авторизации. Возвращает result.records. */
export async function rpcRecords(
  request: APIRequestContext,
  authHeader: string,
  schema: 'core' | 'dbo' | 'mrkt',
  body: { action: string; method: string; data: unknown[] },
): Promise<Record<string, any>[]> {
  const response = await request.post(`${ENV.apiBaseUrl}/rpc/${schema}`, {
    headers: { 'Content-Type': 'application/json', 'rpc-authorization': authHeader },
    data: { type: 'rpc', ...body },
  });
  if (!response.ok()) {
    throw new Error(`RPC ${body.action} -> HTTP ${response.status()}: ${(await response.text()).slice(0, 300)}`);
  }
  const json = await response.json();
  const item = Array.isArray(json) ? json[0] : json;
  if (item?.meta && item.meta.success === false) {
    throw new Error(`RPC ${body.action} вернул success=false: ${item.meta.msg}`);
  }
  return item?.result?.records || [];
}
