const { test, expect } = require('@playwright/test');

const BASE = 'https://lumnstudio.online';

test.describe('POS System', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE + '/login');
    await page.fill('input[name="username"], input[type="text"]', 'admin');
    await page.fill('input[name="password"], input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(kasir|admin|pos)/, { timeout: 10000 });
    await page.goto(BASE + '/pos');
    await page.waitForLoadState('networkidle');
  });

  test('halaman POS terbuka dengan benar', async ({ page }) => {
    await expect(page.locator('.pos-store')).toContainText("LUMEN'S STUDIO");
    await expect(page.locator('.pos-beta')).toBeVisible();
    await expect(page.locator('#pos-locked')).toBeVisible();
  });

  test('pilih stylist membuka grid produk', async ({ page }) => {
    const firstBarber = page.locator('.barber-chip').first();
    await expect(firstBarber).toBeVisible({ timeout: 10000 });
    await firstBarber.click();
    await expect(page.locator('#pos-locked')).toBeHidden({ timeout: 5000 });
    await expect(page.locator('#pos-main')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.pos-item').first()).toBeVisible({ timeout: 5000 });
  });

  test('tap layanan masuk ke cart', async ({ page }) => {
    await page.locator('.barber-chip').first().click();
    await expect(page.locator('#pos-main')).toBeVisible({ timeout: 5000 });

    const item = page.locator('.pos-item').first();
    await expect(item).toBeVisible({ timeout: 5000 });
    const itemName = await item.locator('.pos-item-name').textContent();
    await item.click();

    await expect(page.locator('#cart-list')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.cart-row-name').first()).toContainText(itemName);
    await expect(page.locator('#cart-total-val')).not.toContainText('Rp 0');
  });

  test('qty + dan - berfungsi', async ({ page }) => {
    await page.locator('.barber-chip').first().click();
    await expect(page.locator('#pos-main')).toBeVisible({ timeout: 5000 });
    await page.locator('.pos-item').first().click();
    await expect(page.locator('.cart-qty-val').first()).toBeVisible({ timeout: 3000 });

    await page.locator('.cart-qty-btn:not(.minus)').first().click();
    await expect(page.locator('.cart-qty-val').first()).toContainText('2');

    await page.locator('.cart-qty-btn.minus').first().click();
    await expect(page.locator('.cart-qty-val').first()).toContainText('1');
  });

  test('filter kategori berfungsi', async ({ page }) => {
    await page.locator('.barber-chip').first().click();
    await expect(page.locator('#pos-main')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.pos-cat').first()).toBeVisible({ timeout: 5000 });

    const allItems = await page.locator('.pos-item').count();
    expect(allItems).toBeGreaterThan(0);

    const secondCat = page.locator('.pos-cat').nth(1);
    if (await secondCat.isVisible()) {
      await secondCat.click();
      await expect(secondCat).toHaveClass(/active/);
    }
  });

  test('search filter berfungsi', async ({ page }) => {
    await page.locator('.barber-chip').first().click();
    await expect(page.locator('#pos-main')).toBeVisible({ timeout: 5000 });

    await page.fill('#search-input', 'zzzznotfound');
    await page.waitForTimeout(300);
    const visible = await page.locator('.pos-item >> visible=true').count();
    expect(visible).toBe(0);

    await page.fill('#search-input', '');
    await page.waitForTimeout(300);
    const afterClear = await page.locator('.pos-item >> visible=true').count();
    expect(afterClear).toBeGreaterThan(0);
  });

  test('flow pembayaran - modal terbuka', async ({ page }) => {
    await page.locator('.barber-chip').first().click();
    await expect(page.locator('#pos-main')).toBeVisible({ timeout: 5000 });
    await page.locator('.pos-item').first().click();
    await expect(page.locator('.btn-bayar')).toBeVisible({ timeout: 3000 });

    await page.locator('.btn-bayar').click();
    await expect(page.locator('#pay-overlay')).toHaveClass(/show/, { timeout: 3000 });
    await expect(page.locator('.pay-method.m-cash')).toHaveClass(/active/);
    await expect(page.locator('#cash-box')).toHaveClass(/show/);
  });

  test('metode transfer/qris hide cash input', async ({ page }) => {
    await page.locator('.barber-chip').first().click();
    await expect(page.locator('#pos-main')).toBeVisible({ timeout: 5000 });
    await page.locator('.pos-item').first().click();
    await page.locator('.btn-bayar').click();
    await expect(page.locator('#pay-overlay')).toHaveClass(/show/, { timeout: 3000 });

    await page.locator('.pay-method.m-transfer').click();
    await expect(page.locator('#cash-box')).not.toHaveClass(/show/);

    await page.locator('.pay-method.m-qris').click();
    await expect(page.locator('#cash-box')).not.toHaveClass(/show/);

    await page.locator('.pay-method.m-cash').click();
    await expect(page.locator('#cash-box')).toHaveClass(/show/);
  });

  test('tab riwayat terbuka', async ({ page }) => {
    await page.locator('#nav-riwayat').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#riwayat-page')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.omset-card.total')).toBeVisible({ timeout: 5000 });
  });

  test('tombol kembali ke kasir ada', async ({ page }) => {
    const backBtn = page.locator('.pos-back');
    await expect(backBtn).toBeVisible();
    const href = await backBtn.getAttribute('href');
    expect(href).toBe('/kasir');
  });

});
