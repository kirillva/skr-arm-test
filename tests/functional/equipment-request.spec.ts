import { expect, test } from '@playwright/test';
import { attachRpcTokenCapture } from '../../api/armSession';
import { ENV } from '../../config/env';
import { AT_MARKER, DISPATCHER, MARKET_USER, MIN_AVAILABLE_SERIALS, WAREHOUSE_WORKER } from '../../config/functional.testdata';
import { impersonateWithToken } from '../../fixtures/session';
import {
  buildRequestCsv,
  createEquipmentRequestViaUI,
  executeResolve,
  openResolveForm,
  planRequestProduct,
  rpcFindRequestByNumber,
  rpcRequestPositions,
  uploadRequestCsv,
  uploadRequestCsvUntil,
} from '../../fixtures/equipmentRequest';

/**
 * Функциональные тесты заявки на склад (запрос оборудования).
 * Роль основная (manager) не умеет создавать/исполнять заявки — используем маскировку:
 * диспетчер создаёт, склад исполняет (в т.ч. загрузкой CSV по серийным номерам).
 * ТестЫ пишут данные на dev-стенд (заявки + выдача оборудования).
 */
test.describe('Заявка на склад: запрос оборудования', () => {
  test.describe.configure({ timeout: 420_000 });

  test('@functional @requestForm Форма создания заявки: состав, валидация, автономер, строки оборудования', async ({
    page,
  }) => {
    await impersonateWithToken(page, DISPATCHER);

    await page.goto(`${ENV.baseUrl}#/purchase/applications/create`);
    await expect(page.getByRole('heading', { name: 'Создание заявки' })).toBeVisible({ timeout: 20_000 });

    // Обязательные поля подсвечены валидацией сразу (validateOnMount)
    await expect(page.getByText('Не заполнено обязательное поле').first()).toBeVisible();

    // Тип заявки -> автономер DDMMYYYY-N
    await page.getByRole('combobox', { name: 'Тип заявки' }).click();
    await page.getByRole('option', { name: 'Запрос оборудования' }).click();
    await expect
      .poll(() => page.getByLabel('Номер заявки').inputValue(), { timeout: 20_000 })
      .toMatch(/^\d{8}-\d+$/);

    // Отправитель/получатель только из допустимых профилей
    await page.getByRole('combobox', { name: 'Отправитель' }).click();
    const senderOption = page.getByRole('option', { name: new RegExp(MARKET_USER.login) });
    await expect(senderOption, 'склад-отправитель должен быть в списке').toBeVisible();
    await senderOption.click();

    await page.getByRole('combobox', { name: 'Получатель' }).click();
    await page.getByRole('option', { name: new RegExp(DISPATCHER.login) }).first().click();

    // Строка запрашиваемого оборудования: добавить -> категория доступна -> удалить
    await page.getByRole('button', { name: /добавить/i }).click();
    const categorySelect = page
      .locator('.MuiFormControl-root:has(label:text-is("Категория оборудования")) .MuiSelect-select')
      .first();
    await expect(categorySelect, 'селект категории в строке оборудования').toBeVisible({ timeout: 30_000 });
    await categorySelect.click();
    await expect(page.getByRole('option').first(), 'справочник категорий').toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /удалить/i }).click();
    await expect(
      page.locator('.MuiFormControl-root:has(label:text-is("Категория оборудования"))'),
      'строка оборудования должна удалиться',
    ).toHaveCount(0);

    // Без отправки формы — ничего не создали
    expect(await page.evaluate(() => location.hash)).toContain('/purchase/applications/create');
  });

  test('@functional @requestE2E Диспетчер создаёт заявку, склад исполняет загрузкой CSV', async ({ page, request }) => {
    // --- Фаза 1: диспетчер создаёт заявку
    const dispatcherToken = await impersonateWithToken(page, DISPATCHER);
    const plan = await planRequestProduct(request, dispatcherToken, MIN_AVAILABLE_SERIALS);
    const number = await createEquipmentRequestViaUI(page, {
      senderLogin: MARKET_USER.login,
      receiverLogin: DISPATCHER.login,
      comment: `${AT_MARKER} E2E ${new Date().toISOString()}`,
      plan,
      count: plan.serials.length,
    });

    const created = await rpcFindRequestByNumber(request, dispatcherToken, number);
    if (!created) throw new Error(`заявка ${number} не найдена после создания`);
    expect(created.c_request_status).toBe('CREATED');

    const positions = await rpcRequestPositions(request, dispatcherToken, created.id);
    expect(positions.length, 'у заявки должна быть позиция оборудования').toBeGreaterThan(0);
    expect(positions[0].c_tags, 'категория позиции заявки').toContain(`.${plan.tag}.`);
    expect(Number(positions[0].n_count)).toBe(plan.serials.length);

    // --- Фаза 2: склад исполняет заявку через CSV
    const warehouseToken = await impersonateWithToken(page, WAREHOUSE_WORKER);
    const reopenResolveForm = () => openResolveForm(page, created.id);
    await reopenResolveForm();

    await uploadRequestCsvUntil(page, buildRequestCsv(plan, plan.serials), page.getByText(plan.serials[0]), {
      reopen: reopenResolveForm,
    });
    await expect(
      page.getByText(plan.serials[0]),
      'серийный номер из CSV должен подставиться в строку оборудования',
    ).toBeVisible({ timeout: 30_000 });

    await executeResolve(page);

    const resolved = await rpcFindRequestByNumber(request, warehouseToken, number);
    expect(resolved?.c_request_status, 'заявка должна стать исполненной').toBe('DONE');
  });

  test('@functional @requestCsvNegative CSV: неверный формат файла и несуществующий серийный номер', async ({
    page,
    request,
  }) => {
    // Готовим CREATED-заявку (негативные загрузки не меняют её состояние)
    const dispatcherToken = await impersonateWithToken(page, DISPATCHER);
    const plan = await planRequestProduct(request, dispatcherToken, MIN_AVAILABLE_SERIALS);
    const number = await createEquipmentRequestViaUI(page, {
      senderLogin: MARKET_USER.login,
      receiverLogin: DISPATCHER.login,
      comment: `${AT_MARKER} negative ${new Date().toISOString()}`,
      plan,
      count: plan.serials.length,
    });
    const created = await rpcFindRequestByNumber(request, dispatcherToken, number);
    if (!created) throw new Error(`заявка ${number} не найдена`);

    await impersonateWithToken(page, WAREHOUSE_WORKER);
    const reopenResolveForm = () => openResolveForm(page, created.id);
    await reopenResolveForm();

    // 1) не CSV
    await uploadRequestCsv(page, 'привет, это не csv', 'at-bad.txt');
    await expect(page.getByText('Неправильный формат файла.'), 'ошибка неверного формата').toBeVisible({
      timeout: 15_000,
    });

    // 2) CSV с несуществующим серийным номером
    const notFoundToast = page.getByText('не найдено');
    await uploadRequestCsvUntil(page, buildRequestCsv(plan, ['AT-NET-TAKOGO-001']), notFoundToast, {
      reopen: reopenResolveForm,
    });
    await expect(notFoundToast, 'ошибка «не найдено» для несуществующего серийника').toBeVisible({
      timeout: 30_000,
    });

    // Заявка осталась в статусе CREATED (негативные загрузки ничего не исполняют)
    const stillCreated = await rpcFindRequestByNumber(request, await currentWarehouseToken(page), number);
    expect(stillCreated?.c_request_status).toBe('CREATED');
  });
});

// Вспомогательный: токен текущей (складской) сессии для перечитывания заявки
async function currentWarehouseToken(page: import('@playwright/test').Page): Promise<string> {
  const getToken = attachRpcTokenCapture(page);
  await page.reload({ waitUntil: 'load' }).catch(() => undefined);
  await page.waitForTimeout(4_000);
  const token = getToken();
  if (!token) throw new Error('Не удалось захватить токен складской сессии');
  return token;
}
