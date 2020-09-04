import * as puppeteer from 'puppeteer';

const LOGIN_URL = 'https://tm.cmlviz.com/login.php';
const EMAIL_TEXTBOX = '#main_container > form > div.login_frame > a > table > tbody > tr:nth-child(2) > td:nth-child(2) > input[type="text"]';
const PASSWORD_TEXTBOX = '#main_container > form > div.login_frame > a > table > tbody > tr:nth-child(3) > td:nth-child(2) > input[type="password"]';
const SUBMIT_BUTTON = '#main_container > form > div.login_frame > a > table > tbody > tr:nth-child(4) > td > input';

export interface AuthInfo {
  email : string;
  password : string;
}

export async function login(page : puppeteer.Page, auth : AuthInfo) {
  await page.goto(LOGIN_URL);
  await page.click(EMAIL_TEXTBOX);
  await page.keyboard.type(auth.email);

  await page.click(PASSWORD_TEXTBOX);
  await page.keyboard.type(auth.password);

  await page.click(SUBMIT_BUTTON);

  await page.waitForSelector('#mode_backtest', { visible: true });
}
