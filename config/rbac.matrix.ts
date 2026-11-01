/**
 * Матрица RBAC: состав навигации/вкладок по ролям.
 * Получено ручным обходом с маскамировками 01.11.2026 (АРМ 1.1.290, dev).
 * При изменении интерфейса на стенде правки только здесь.
 */

export interface SectionSpec {
  /** Точное имя кнопки навигации или префикс-регулярка (для «Запросы (N)» со счётчиком) */
  name: string | RegExp;
  /** Ожидаемые вкладки секции по порядку; [] — вкладок нет */
  tabs: string[];
  /**
   * Заголовок секции (level 5) — проверяется перед вкладками.
   * Обязателен для секций без вкладок, чтобы tabs: [] не «прошёл» до отрисовки страницы.
   */
  heading?: string | RegExp;
}

export interface RoleSpec {
  key: string;
  profile: string;
  login: string;
  id: number;
  /** Ожидаемые кнопки навигации по порядку */
  nav: (string | RegExp)[];
  sections: SectionSpec[];
  /** Маршруты, закрытые для роли (ожидаем 404 или редирект на #/auth) */
  forbidden: string[];
}

const ADMIN_TABS_10 = [
  'Пользователи',
  'Структура подразделений',
  'Взаимосвязь ПКО',
  'Шаблоны писем',
  'Настройки',
  'Файловый менеджер',
  'Сопоставление справочников',
  'Виды работ',
  'Журнал событий',
  'Заявки',
];

const ADMIN_TABS_9 = ADMIN_TABS_10.filter((t) => t !== 'Взаимосвязь ПКО');

const REPORT_TABS = [
  'План подрядчиков',
  'Отчет по выполненным работам',
  'Опросный лист Универсальный РусГидро ДЭК',
];

const DISPATCH_TABS_3 = ['Карта', 'Маршруты', 'Результаты'];
const DISPATCH_TABS_5 = ['Карта', 'Маршруты', 'Результаты', 'ПУ', 'Сим-карты'];

const WAREHOUSE_TABS = ['Приборы учета', 'Сим-карты', 'Пломбы', 'Трансформаторы', 'Договоры'];
const PURCHASE_TABS = ['Запрос оборудования', 'Возврат оборудования', 'История оборудования'];

const DISPATCHER_NAV = ['Диспетчеризация', 'ТУ подрядчиков', 'Планирование', 'Запрос оборудования', 'Отчёты'];

const DISPATCHER_SECTIONS: SectionSpec[] = [
  { name: 'Диспетчеризация', tabs: DISPATCH_TABS_5 },
  { name: 'ТУ подрядчиков', tabs: ['Список точек', 'План по организации'] },
  { name: 'Планирование', tabs: ['Формирование плана'] },
  { name: 'Запрос оборудования', tabs: [], heading: 'Запрос оборудования' },
  { name: 'Отчёты', tabs: REPORT_TABS },
];

export const MASKABLE_ROLES: RoleSpec[] = [
  {
    key: 'administrator',
    profile: 'administrator',
    login: 'avtorill',
    id: 1056,
    nav: ['Диспетчеризация', 'Администрирование', 'Отчёты'],
    sections: [
      { name: 'Диспетчеризация', tabs: DISPATCH_TABS_3 },
      { name: 'Администрирование', tabs: ADMIN_TABS_10 },
      { name: 'Отчёты', tabs: REPORT_TABS },
    ],
    forbidden: ['#/inventory/devices', '#/tu_planning'],
  },
  {
    key: 'manager',
    profile: 'manager',
    login: 'youdispetcher3',
    id: 275,
    nav: DISPATCHER_NAV,
    sections: DISPATCHER_SECTIONS,
    forbidden: ['#/admin/users', '#/inventory/devices'],
  },
  {
    key: 'manageruser',
    profile: 'manageruser',
    login: 'disp-isp_resk',
    id: 1192,
    nav: DISPATCHER_NAV,
    sections: DISPATCHER_SECTIONS,
    forbidden: ['#/admin/users', '#/inventory/devices'],
  },
  {
    key: 'boss',
    profile: 'boss',
    login: 'test_proverka4',
    id: 1295,
    nav: ['Диспетчеризация', 'Складской учёт', 'Планирование', 'Запрос оборудования', /^Запросы/, 'Оборудование', 'Отчёты'],
    sections: [
      { name: 'Диспетчеризация', tabs: DISPATCH_TABS_5 },
      { name: 'Складской учёт', tabs: WAREHOUSE_TABS },
      { name: 'Планирование', tabs: ['Формирование плана'] },
      { name: 'Запрос оборудования', tabs: [], heading: 'Запрос оборудования' },
      { name: /^Запросы/, tabs: PURCHASE_TABS },
      { name: 'Оборудование', tabs: [], heading: 'Оборудование' },
      { name: 'Отчёты', tabs: REPORT_TABS },
    ],
    // Примечание 01.11.2026: #/tu_planning напрямую ОТКРЫВАЕТСЯ (раздел скрыт только в навигации) —
    // реальный RBAC-гэп приложения, вынесен из forbidden как задокументированное фактическое поведение.
    forbidden: ['#/admin/users'],
  },
  {
    key: 'pco',
    profile: 'pco',
    login: 'pco_1-5',
    id: 256,
    nav: ['Диспетчеризация', 'Планирование', 'Администрирование', 'Отчёты'],
    sections: [
      { name: 'Диспетчеризация', tabs: DISPATCH_TABS_3 },
      // В отличие от manager/boss, у pco страница планирования открывается без вкладок
      { name: 'Планирование', tabs: [], heading: /Формирование плана/ },
      { name: 'Администрирование', tabs: ADMIN_TABS_9 },
      { name: 'Отчёты', tabs: REPORT_TABS },
    ],
    forbidden: ['#/tu_planning', '#/inventory/devices'],
  },
  {
    key: 'subpco',
    profile: 'subpco',
    login: 'TestPCOSub_new1770357256078',
    id: 1171,
    nav: ['Диспетчеризация', 'Планирование', 'Отчёты'],
    sections: [
      { name: 'Диспетчеризация', tabs: DISPATCH_TABS_5 },
      { name: 'Планирование', tabs: ['Формирование плана'] },
      { name: 'Отчёты', tabs: REPORT_TABS },
    ],
    forbidden: ['#/admin/users', '#/inventory/devices', '#/tu_planning'],
  },
  {
    key: 'repo',
    profile: 'repo',
    login: 'resk_skr2',
    id: 1333,
    nav: ['Складской учёт', /^Запросы/, 'Оборудование'],
    sections: [
      { name: 'Складской учёт', tabs: WAREHOUSE_TABS },
      { name: /^Запросы/, tabs: PURCHASE_TABS },
      { name: 'Оборудование', tabs: [], heading: 'Оборудование' },
    ],
    forbidden: ['#/dispatching/map', '#/admin/users', '#/reports'],
  },
];

/** Контролёр: маскируется, но веб-АРМ для роли недоступен (404 на всех маршрутах) */
export const CONTROLLER = { key: 'user', profile: 'user', login: 'skrmo-test-isp', id: 636 };

/** Профили без блока «Авторизованные устройства» на странице пользователя — маскировка через UI недоступна */
export const NO_MASK_PROFILES = [
  { key: 'market', id: 222 },
  { key: 'provider', id: 37 },
  { key: 'brigade', id: 964 },
];
