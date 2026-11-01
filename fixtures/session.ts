import { expect, Page } from '@playwright/test';
import { ENV } from '../config/env';
import { LoginPage } from '../pages/LoginPage';

export interface MaskTarget {
  login: string;
  id: number;
  profile: string;
}

/** Хеш текущего маршрута SPA (устойчив к перезагрузкам страницы) */
export async function currentHash(page: Page): Promise<string> {
  try {
    return await page.evaluate(() => location.hash);
  } catch {
    return '';
  }
}

/** Дождаться ухода со страницы авторизации (редирект после логина) */
async function waitLeftAuthPage(page: Page, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hash = await currentHash(page);
    if (hash && !hash.startsWith('#/auth')) return;
    await page.waitForTimeout(500);
  }
  throw new Error(`Страница авторизации не покинутась за ${timeoutMs} мс (hash=${await currentHash(page)})`);
}

/** Логин через UI. Новый контекст браузера на тест => чистая сессия, storageState не используется. */
export async function loginAs(page: Page, login: string, password: string): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.login(login, password);
  await waitLeftAuthPage(page);
}

/** Логин как основная учётка (manager/administrator) */
export async function loginAsManager(page: Page): Promise<void> {
  await loginAs(page, ENV.mainLogin, ENV.mainPassword);
}

/** Логин текущего пользователя (первая строка кнопки «Настройки аккаунта») */
export async function currentUser(page: Page): Promise<string> {
  const text = await page
    .getByRole('button', { name: 'Настройки аккаунта' })
    .innerText({ timeout: 5_000 });
  return text.split('\n')[0].trim();
}

/**
 * Маскировка под пользователя из-под manager:
 * страница пользователя → блок «Авторизованные устройства» → «Замаскироваться».
 * Требования: manager залогинен, у цели есть верифицированное устройство.
 * Виртуализированная таблица устройств даёт редкие промахи клика (открывается диалог
 * «Редактирование» устройства) — диалог закрывается, клик повторяется.
 */
export async function impersonate(page: Page, target: MaskTarget): Promise<void> {
  await page.goto(`${ENV.baseUrl}#/admin/userdetail?id=${target.id}&profile=${target.profile}`);
  const devicesAccordion = page.getByRole('button', { name: 'Авторизованные устройства' });
  await devicesAccordion.waitFor({ timeout: 20_000 });
  if ((await devicesAccordion.getAttribute('aria-expanded')) !== 'true') {
    await devicesAccordion.click();
  }
  const maskCell = page.getByRole('cell', { name: 'Замаскироваться' }).first();
  await maskCell.waitFor({ state: 'visible', timeout: 15_000 });
  const editDialog = page.getByRole('dialog').filter({ hasText: 'Редактирование' });

  for (let attempt = 1; attempt <= 3; attempt++) {
    await maskCell.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500); // дождаться окончания прокрутки виртуализированной таблицы
    // Клик перезапускает приложение — навигационные таймауты ожидаемы
    await maskCell.click({ timeout: 10_000 }).catch(() => undefined);

    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if ((await currentUser(page).catch(() => '')) === target.login) {
        expect(await currentUser(page), 'маскировка не применилась').toBe(target.login);
        return;
      }
      if (await editDialog.isVisible().catch(() => false)) break;
      await page.waitForTimeout(1_000);
    }
    if (await editDialog.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await editDialog.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
    }
  }
  throw new Error(`Не удалось замаскироваться под ${target.login} за 3 попытки`);
}

/** Имена кнопок основной навигации по порядку */
export async function navNames(page: Page): Promise<string[]> {
  const texts = await page.locator('nav').getByRole('button').allInnerTexts();
  return texts.map((t) => t.trim()).filter(Boolean);
}

/** Имена вкладок текущей секции по порядку */
export async function tabNames(page: Page): Promise<string[]> {
  const texts = await page.getByRole('tab').allInnerTexts();
  return texts.map((t) => t.trim()).filter(Boolean);
}

export function navButton(page: Page, name: string | RegExp) {
  return page.locator('nav').getByRole('button', { name });
}

/** Совпадение имени навигации с ожидаем (строка — без учёта регистра, RegExp — тест) */
export function navNameMatches(actual: string, expected: string | RegExp): boolean {
  return expected instanceof RegExp
    ? expected.test(actual)
    : actual.toLowerCase() === expected.toLowerCase();
}

/** Открыть меню аккаунта и выйти; вернуться на страницу авторизации */
export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Настройки аккаунта' }).click();
  await page.getByRole('menuitem', { name: 'Выход' }).click();
  await new LoginPage(page).waitOpened();
}
