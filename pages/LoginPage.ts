import { Locator, Page } from '@playwright/test';
import { ENV } from '../config/env';

/** Страница авторизации #/auth */
export class LoginPage {
  constructor(private readonly page: Page) {}

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Авторизация', level: 2 });
  }

  get subtitle(): Locator {
    return this.page.getByRole('heading', { level: 5, name: /Введите логин и пароль/ });
  }

  get loginInput(): Locator {
    return this.page.getByRole('textbox', { name: 'Логин' });
  }

  get passwordInput(): Locator {
    return this.page.getByRole('textbox', { name: 'Пароль' });
  }

  get submitButton(): Locator {
    return this.page.getByRole('button', { name: /войти в систему/i });
  }

  get forgotButton(): Locator {
    return this.page.getByRole('button', { name: /забыли пароль/i });
  }

  /** Кнопка-«глазик» переключения видимости пароля (внутри обёртки поля пароля) */
  get passwordToggle(): Locator {
    return this.passwordInput.locator('xpath=../button');
  }

  get requiredFieldErrors(): Locator {
    return this.page.getByText('Не заполнено обязательное поле');
  }

  get errorDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  get forgotDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  get okButton(): Locator {
    return this.page.getByRole('button', { name: 'Ok' });
  }

  get versionInfo(): Locator {
    return this.page.getByText(/Версия Контейнера/);
  }

  async open(route = '#/auth'): Promise<void> {
    await this.page.goto(`${ENV.baseUrl}${route}`);
  }

  async waitOpened(): Promise<void> {
    await this.heading.waitFor({ timeout: 20_000 });
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async fill(login: string, password: string): Promise<void> {
    await this.loginInput.fill(login);
    await this.passwordInput.fill(password);
  }

  /** Открыть #/auth, заполнить и отправить форму */
  async login(login: string, password: string): Promise<void> {
    await this.open();
    await this.waitOpened();
    await this.fill(login, password);
    await this.submit();
  }
}
