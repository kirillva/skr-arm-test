/**
 * Тестовые данные для функциональных тестов заявки на склад (dev-стенд).
 * Подобраны так, что склад-исполнитель и склад-отправитель связаны f_alias:
 * repo-пользователь resk_skr2 видит заявки склада sklad_resk_test (id 1190).
 */
export const DISPATCHER = { login: 'disp-isp_resk', id: 1192, profile: 'manageruser' };
export const WAREHOUSE_WORKER = { login: 'resk_skr2', id: 1333, profile: 'repo' };
export const MARKET_USER = { login: 'sklad_resk_test', id: 1190, profile: 'market' };

/** Минимальное число свободных серийных номеров, нужное для теста */
export const MIN_AVAILABLE_SERIALS = 2;

/** Маркер тестовых данных в поле «Основание» */
export const AT_MARKER = 'AT-функциональный тест';
