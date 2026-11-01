import { expect, test } from '@playwright/test';
import { ENV } from '../../config/env';
import { LoginPage } from '../../pages/LoginPage';
import { currentHash, currentUser, logout } from '../../fixtures/session';

test.describe('Авторизация', () => {
  test('@auth @smoke Страница авторизации открывается и содержит элементы формы', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();
    await loginPage.waitOpened();

    await expect(loginPage.subtitle).toBeVisible();
    await expect(loginPage.loginInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
    await expect(loginPage.forgotButton).toBeVisible();
    await expect(loginPage.versionInfo).toBeVisible();
  });

  test('@auth Пустая форма — валидация обязательных полей', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();
    await loginPage.waitOpened();

    await loginPage.submit();

    await expect(loginPage.requiredFieldErrors).toHaveCount(2);
    expect(await currentHash(page)).toContain('#/auth');
  });

  test('@auth Неверные учётные данные — диалог ошибки', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();
    await loginPage.waitOpened();

    await loginPage.fill(ENV.mainLogin, 'AT_wrong_pass_123');
    await loginPage.submit();

    await expect(loginPage.errorDialog).toBeVisible({ timeout: 20_000 });
    await expect(loginPage.errorDialog.getByText('Неверный логин или пароль')).toBeVisible();

    await loginPage.okButton.click();
    await expect(loginPage.errorDialog).toBeHidden();
    expect(await currentHash(page)).toContain('#/auth');
  });

  test('@auth @smoke Успешный вход — редирект в диспетчеризацию', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(ENV.mainLogin, ENV.mainPassword);

    await expect
      .poll(() => currentHash(page), { timeout: 30_000 })
      .toBe('#/dispatching/map');
    expect(await currentUser(page)).toBe(ENV.mainLogin);
  });

  test('@auth Переключение видимости пароля', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();
    await loginPage.waitOpened();

    await loginPage.passwordInput.fill('secret123');
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');

    await loginPage.passwordToggle.click();
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'text');

    await loginPage.passwordToggle.click();
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
  });

  test('@auth Прямой заход на защищённый маршрут без сессии — редирект на #/auth', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.open('#/admin/users');

    await expect
      .poll(() => currentHash(page), { timeout: 20_000 })
      .toContain('#/auth');
    await expect(loginPage.heading).toBeVisible();
  });

  test('@auth Выход из системы — возврат на авторизацию и блокировка маршрутов', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(ENV.mainLogin, ENV.mainPassword);
    await expect.poll(() => currentHash(page), { timeout: 30_000 }).toBe('#/dispatching/map');

    await logout(page);
    await expect(loginPage.heading).toBeVisible();

    await loginPage.open('#/admin/users');
    await expect.poll(() => currentHash(page), { timeout: 20_000 }).toContain('#/auth');
  });

  test('@auth «Забыли пароль?» — диалог восстановления пароля', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();
    await loginPage.waitOpened();

    await loginPage.forgotButton.click();

    await expect(loginPage.forgotDialog.getByRole('heading', { name: 'Восстановление пароля' })).toBeVisible();
    await expect(loginPage.forgotDialog.getByRole('textbox')).toBeVisible();
    await expect(loginPage.forgotDialog.getByRole('button', { name: /отправить письмо/i })).toBeVisible();
  });
});
