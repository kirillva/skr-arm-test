import { expect, Page, test } from '@playwright/test';
import { CONTROLLER, MASKABLE_ROLES, NO_MASK_PROFILES, RoleSpec } from '../../config/rbac.matrix';
import { ENV } from '../../config/env';
import {
  currentUser,
  impersonate,
  loginAsManager,
  navButton,
  navNameMatches,
  navNames,
  tabNames,
} from '../../fixtures/session';

/** Раздел закрыт для роли: 404 приложения либо редирект на страницу авторизации */
async function expectRouteBlocked(page: Page, route: string): Promise<void> {
  await page.goto(`${ENV.baseUrl}${route}`);
  const blocked = page
    .getByText('Страница не найдена')
    .or(page.getByRole('heading', { name: 'Авторизация' }));
  await expect(blocked.first(), `маршрут ${route} должен быть закрыт`).toBeVisible({ timeout: 15_000 });
}

async function checkRoleUi(page: Page, role: RoleSpec): Promise<void> {
  // 1) Состав навигации
  const nav = await navNames(page);
  expect(nav, `состав навигации: ${nav.join(' | ')}`).toHaveLength(role.nav.length);
  role.nav.forEach((expected, index) => {
    expect(
      navNameMatches(nav[index], expected),
      `кнопка навигации ${index + 1}: получено "${nav[index]}", ожидалось "${String(expected)}"`,
    ).toBe(true);
  });

  // 2) Вкладки каждой секции
  for (const section of role.sections) {
    await navButton(page, section.name).first().click();
    if (section.heading) {
      await expect(
        page.getByRole('heading', { name: section.heading }).first(),
        `заголовок секции "${String(section.name)}"`,
      ).toBeVisible({ timeout: 20_000 });
    }
    await expect
      .poll(() => tabNames(page), {
        message: `вкладки секции "${String(section.name)}"`,
        timeout: 20_000,
      })
      .toEqual(section.tabs);
  }

  // 3) Закрытые маршруты
  for (const route of role.forbidden) {
    await expectRouteBlocked(page, route);
  }
}

test.describe('RBAC: состав интерфейса по ролям', () => {
  test.setTimeout(240_000);

  for (const role of MASKABLE_ROLES) {
    const smoke = role.key === 'administrator' ? ' @smoke' : '';
    test(`@rbac${smoke} Роль ${role.key} (${role.login})`, async ({ page }) => {
      await loginAsManager(page);
      expect(await currentUser(page)).toBe(ENV.mainLogin);

      await impersonate(page, role);
      await checkRoleUi(page, role);
    });
  }

  test('@rbac Роль user (Контролёр) — веб-АРМ недоступен, 404 на маршрутах', async ({ page }) => {
    await loginAsManager(page);
    await impersonate(page, CONTROLLER);

    for (const route of ['#/dispatching/map', '#/reports', '#/admin/users']) {
      await page.goto(`${ENV.baseUrl}${route}`);
      await expect(
        page.getByText('Страница не найдена'),
        `маршрут ${route} для Контролёра`,
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test('@rbac Профили без механизма маскировки (market, provider, brigade) — нет блока устройств', async ({ page }) => {
    await loginAsManager(page);

    for (const profile of NO_MASK_PROFILES) {
      await page.goto(`${ENV.baseUrl}#/admin/userdetail?id=${profile.id}&profile=${profile.key}`);
      await expect(
        page.getByRole('heading', { name: 'Изменение пользователя' }),
        `страница пользователя ${profile.key} не загрузилась`,
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByText('Авторизованные устройства'),
        `у профиля ${profile.key} не должно быть блока «Авторизованные устройства»`,
      ).toHaveCount(0);
    }
  });
});
