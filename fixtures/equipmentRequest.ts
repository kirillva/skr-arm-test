import { APIRequestContext, expect, Locator, Page } from '@playwright/test';
import { rpcRecords } from '../api/armSession';
import { ENV } from '../config/env';
import { MARKET_USER } from '../config/functional.testdata';

/** План для заявки/CSV: категория, продукт и реальные серийные номера со склада */
export interface RequestProductPlan {
  tag: string;
  tagDesc: string;
  /** Значение для колонки «Наименование оборудования» (уникальное подстрокой в title товара) */
  productTitle: string;
  productName: string;
  serials: string[];
}

const CAT_SELECT_SELECTOR =
  '.MuiFormControl-root:has(label:text-is("Категория оборудования")) .MuiSelect-select';

/**
 * Подбирает с баланса склада продукт с >= minCount свободными серийными номерами.
 * Данные на dev потребляются тестами, поэтому подбор динамический (self-healing).
 */
export async function planRequestProduct(
  request: APIRequestContext,
  token: string,
  minCount: number,
  marketUserId: number = MARKET_USER.id,
): Promise<RequestProductPlan> {
  const tags = await rpcRecords(request, token, 'dbo', {
    action: 'of_arm_product_tags',
    method: 'Query',
    data: [{ params: [{ f_user: marketUserId }] }],
  });

  for (const tag of tags) {
    const products = await rpcRecords(request, token, 'mrkt', {
      action: 'of_arm_market_products',
      method: 'Select',
      data: [
        {
          params: [{ f_user: marketUserId, b_actual: true, c_tags: [tag.c_tag] }],
          limit: 50,
          filter: [{ property: 'f_document', operator: 'isnot', value: null }],
        },
      ],
    });

    for (const product of products) {
      if (!product.n_count || product.n_count < minCount) continue;
      const balance = await rpcRecords(request, token, 'mrkt', {
        action: 'of_arm_market_balance',
        method: 'Select',
        data: [
          {
            params: [{ f_user: marketUserId, f_document: product.f_document, b_sim_card_with_relation: false }],
            filter: [
              { property: 'f_product', value: product.id, operator: '=' },
              { property: 'c_category', value: product.c_category_const, operator: '=' },
            ],
            limit: minCount,
          },
        ],
      });
      if (balance.length < minCount) continue;

      const name = String(product.c_name || '').trim();
      // Загрузка в CSV сопоставляет «Наименование оборудования» как подстроку title — проверяем уникальность
      const titleLike = (p: Record<string, any>) =>
        `${p.c_name || ''} ${p.c_modification || ''}`.includes(name);
      const collisions = products.filter(titleLike).length;
      const productTitle = collisions > 1 ? `${name} ${String(product.c_modification || '').trim()}`.trim() : name;

      return {
        tag: tag.c_tag,
        tagDesc: tag.c_description,
        productTitle,
        productName: name,
        serials: balance.map((b) => String(b.c_serial_number)),
      };
    }
  }
  throw new Error(
    `На складе ${marketUserId} не найдено ни одного товара с ${minCount}+ свободными серийными номерами — нужно пополнить остатки dev-стенда`,
  );
}

/** CSV для кнопки «Загрузить Csv» (колонки соответствуют ожидаемым приложением) */
export function buildRequestCsv(plan: Pick<RequestProductPlan, 'tagDesc' | 'productTitle'>, serials: string[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = serials.map((s) => `${esc(plan.tagDesc)},${esc(plan.productTitle)},${s}`);
  return `\uFEFFКатегория оборудования,Наименование оборудования,Оборудование\n${rows.join('\n')}\n`;
}

/** Заполнить и отправить форму «Создание заявки»; вернуть номер заявки */
export async function createEquipmentRequestViaUI(
  page: Page,
  options: {
    senderLogin: string;
    receiverLogin: string;
    comment: string;
    plan: RequestProductPlan;
    count: number;
  },
): Promise<string> {
  await page.goto(`${ENV.baseUrl}#/purchase/applications/create`);
  await expect(page.getByRole('heading', { name: 'Создание заявки' })).toBeVisible({ timeout: 20_000 });

  await page.getByRole('combobox', { name: 'Тип заявки' }).click();
  await page.getByRole('option', { name: 'Запрос оборудования' }).click();

  await expect
    .poll(async () => page.getByLabel('Номер заявки').inputValue(), { timeout: 20_000 })
    .toMatch(/^\d{8}-\d+$/);
  const number = await page.getByLabel('Номер заявки').inputValue();

  await page.getByRole('combobox', { name: 'Отправитель' }).click();
  await page.getByRole('option', { name: new RegExp(options.senderLogin) }).click();

  await page.getByRole('combobox', { name: 'Получатель' }).click();
  await page.getByRole('option', { name: new RegExp(options.receiverLogin) }).first().click();

  await page.getByLabel('Основание').fill(options.comment);

  await page.getByRole('button', { name: /добавить/i }).click();
  const categorySelect = page.locator(CAT_SELECT_SELECTOR).first();
  await expect(categorySelect, 'строка «Запрашиваемое оборудование» не отрисовала селект категории').toBeVisible({
    timeout: 30_000,
  });
  await categorySelect.click();
  await page.getByRole('option', { name: options.plan.tagDesc, exact: true }).click();

  await page.locator('input[name="n_count"]').first().fill(String(options.count));

  await page.getByRole('button', { name: /создать/i }).click();
  await expect(page.getByText('Заявка успешно создана'), 'снэкбар создания заявки').toBeVisible({ timeout: 20_000 });
  return number;
}

/** Заявка по номеру (RPC, сессия диспетчера или склада) */
export async function rpcFindRequestByNumber(
  request: APIRequestContext,
  token: string,
  number: string,
): Promise<Record<string, any> | undefined> {
  const records = await rpcRecords(request, token, 'mrkt', {
    action: 'of_arm_dd_requests',
    method: 'Select',
    data: [
      {
        params: [null],
        limit: 5,
        sort: [{ property: 'd_created_date', direction: 'DESC' }],
        filter: [{ property: 'c_number', value: number, operator: '=' }],
      },
    ],
  });
  return records[0];
}

/** Позиции (категории/количество) заявки */
export async function rpcRequestPositions(
  request: APIRequestContext,
  token: string,
  requestId: string,
): Promise<Record<string, any>[]> {
  return rpcRecords(request, token, 'mrkt', {
    action: 'of_arm_dd_product_positions',
    method: 'Query',
    data: [{ params: [{ f_request: requestId }] }],
  });
}

/** Первая созданная (CREATED) заявка на запрос оборудования указанного склада */
export async function rpcFindCreatedRequest(
  request: APIRequestContext,
  token: string,
  marketUserId: number = MARKET_USER.id,
): Promise<Record<string, any> | undefined> {
  const records = await rpcRecords(request, token, 'mrkt', {
    action: 'of_arm_dd_requests',
    method: 'Select',
    data: [
      {
        params: [null],
        limit: 10,
        sort: [{ property: 'd_created_date', direction: 'DESC' }],
        filter: [
          { property: 'c_request_type', value: 'EQUIPMENT_REQUEST', operator: '=' },
          { property: 'c_request_status', value: 'CREATED', operator: '=' },
          { property: 'f_from', value: marketUserId, operator: '=' },
        ],
      },
    ],
  });
  return records[0];
}

/**
 * Открыть форму исполнения заявки складом.
 * Дополнительно ждём завершения обоих запросов of_arm_product_tags (справочник категорий
 * формы и загрузчика CSV): загрузка CSV до готовности справочника загрузчика приводит
 * к зависанию кнопки «Загрузить Csv».
 */
export async function openResolveForm(page: Page, requestId: string): Promise<void> {
  let tagsResponses = 0;
  const countTagResponses = (res: import('@playwright/test').Response) => {
    const post = res.request().postData() || '';
    if (res.url().includes('/rpc/dbo') && post.includes('of_arm_product_tags')) tagsResponses++;
  };
  page.on('response', countTagResponses);

  await page.goto(`${ENV.baseUrl}#/purchase/applications/edit?id=${requestId}`);
  await expect(
    page.getByRole('heading', { name: /Исполнение заявки на запрос оборудования/ }),
    'форма исполнения заявки не открылась (не та роль/статус?)',
  ).toBeVisible({ timeout: 30_000 });

  await expect
    .poll(() => tagsResponses, {
      message: 'справочник категорий (форма + CSV-загрузчик) не загрузился',
      timeout: 30_000,
    })
    .toBeGreaterThanOrEqual(2);
  page.off('response', countTagResponses);
}

/** Загрузить CSV в форму исполнения */
export async function uploadRequestCsv(page: Page, csv: string, fileName = 'at-request.csv'): Promise<void> {
  const uploadButton = page.getByRole('button', { name: /загрузить csv|файл успешно загружен/i }).first();
  await expect(uploadButton, 'кнопка загрузки CSV недоступна (загрузчик завис)').toBeEnabled({ timeout: 15_000 });
  await page.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: fileName.endsWith('.csv') ? 'text/csv' : 'text/plain',
    buffer: Buffer.from(csv, 'utf-8'),
  });
}

/**
 * Загрузить CSV и дождаться ожидаемого эффекта (снэкбар/попадание текста),
 * повторяя загрузку. Защита от найденной на dev нестабильности загрузчика:
 * «молчаливый» пустой результат или зависание в состоянии загрузки — при зависании
 * форма перезаоткрывается через opts.reopen и загрузка повторяется.
 */
export async function uploadRequestCsvUntil(
  page: Page,
  csv: string,
  expected: Locator,
  opts: { reopen?: () => Promise<void>; attempts?: number } = {},
): Promise<void> {
  const attempts = opts.attempts ?? 3;
  const uploadButton = page.getByRole('button', { name: /загрузить csv|файл успешно загружен/i }).first();
  for (let i = 0; i < attempts; i++) {
    if (await uploadButton.isHidden().catch(() => false)) {
      if (!opts.reopen) throw new Error('Кнопка загрузки CSV не найдена');
      await opts.reopen();
    }
    if ((await uploadButton.isDisabled().catch(() => false)) && opts.reopen) {
      // загрузчик завис в состоянии загрузки — перезаоткрыть форму
      await opts.reopen();
    }
    await uploadRequestCsv(page, csv, `at-request-${i}.csv`);
    const appeared = await expected
      .waitFor({ state: 'visible', timeout: 12_000 })
      .then(() => true)
      .catch(() => false);
    if (appeared) return;
  }
  // последний шанс — пусть строгая проверка тестера покажет состояние
}

/** Нажать «Исполнить» и дождаться успеха */
export async function executeResolve(page: Page): Promise<void> {
  await page.getByRole('button', { name: /исполнить/i }).click();
  await expect(page.getByText('Заявка успешно создана'), 'снэкбар исполнения заявки').toBeVisible({ timeout: 30_000 });
}
