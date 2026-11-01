import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Не задана переменная окружения ${name}. Скопируйте .env.example в .env и заполните.`);
  }
  return value;
}

export const ENV = {
  /** Базовый URL приложения со слэшем на конце, например https://skr.it-serv.ru/arm/dev/ */
  baseUrl: required('BASE_URL'),
  /** Базовый URL API без слэша на конце, например https://skr-dev.it-serv.ru/dev */
  apiBaseUrl: required('API_URL'),
  mainLogin: required('MAIN_LOGIN'),
  mainPassword: required('MAIN_PASSWORD'),
};
