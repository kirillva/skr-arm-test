import { expect, test } from '@playwright/test';
import { MASKABLE_ROLES } from '../../config/rbac.matrix';
import { ENV } from '../../config/env';
import { impersonate, loginAsManager } from '../../fixtures/session';

/**
 * Тесты-характеризации известных дефектов стенда.
 * Каждый тест описывает КОРЕКТНОЕ поведение и помечен test.fixme — в отчёте видно
 * список известных багов. После фикса на стенде достаточно снять fixme.
 */
test.describe('Известные дефекты', () => {
  test.setTimeout(240_000);

  test('@known-bug boss: #/tu_planning должен быть закрыт для роли (раздел скрыт в навигации)', async ({ page }) => {
    test.fixme(
      true,
      'Дефект RBAC (зафиксирован 01.11.2026, АРМ 1.1.290): у роли boss раздел «ТУ подрядчиков» ' +
        'скрыт в навигации, но маршрут #/tu_planning открывается напрямую — страница ' +
        '«Формирование плана для подрядчиков» с таблицей и кнопкой «Добавить в план». ' +
        'Для administrator тот же маршрут закрыт (404). После закрытия маршрута снять fixme.',
    );

    const boss = MASKABLE_ROLES.find((r) => r.key === 'boss');
    if (!boss) throw new Error('роль boss отсутствует в матрице');

    await loginAsManager(page);
    await impersonate(page, boss);

    await page.goto(`${ENV.baseUrl}#/tu_planning`);
    await expect(page.getByText('Страница не найдена')).toBeVisible({ timeout: 15_000 });
  });
});
