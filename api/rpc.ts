import { APIRequestContext } from '@playwright/test';
import { ENV } from '../config/env';

/** Заголовок авторизации АРМ: Token base64(логин:пароль) */
export function tokenHeader(login: string, password: string): string {
  return `Token ${Buffer.from(`${login}:${password}`).toString('base64')}`;
}

export interface RpcBody {
  action: string;
  method: string;
  data: unknown[];
  type?: string;
}

/** POST /rpc/core; authHeader не передан — запрос без авторизации (негативные проверки) */
export function rpcCore(request: APIRequestContext, body: RpcBody, authHeader?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['rpc-authorization'] = authHeader;
  return request.post(`${ENV.apiBaseUrl}/rpc/core`, {
    headers,
    data: { type: 'rpc', ...body },
  });
}

/** POST /auth (multipart UserName/Password) */
export function authRequest(request: APIRequestContext, userName: string, password: string) {
  return request.post(`${ENV.apiBaseUrl}/auth`, {
    multipart: { UserName: userName, Password: password },
  });
}
