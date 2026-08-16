import { expect, test } from '@playwright/test';

const games = ['connect4', 'rubikscube', 'crash', 'blackjack', 'poker', 'slots', 'fishing', 'coinpusher'];

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Play as Guest' }).click();
  await expect(page.getByRole('combobox', { name: 'Choose a game' })).toBeVisible();
});

for (const gameId of games) {
  test(`${gameId} stays inside the mobile viewport`, async ({ page }, testInfo) => {
    if (['crash', 'blackjack', 'poker', 'slots', 'fishing', 'coinpusher'].includes(gameId)) {
      await page.getByRole('button', { name: /Casino \(18\+\)/i }).click();
    }
    await page.getByRole('combobox', { name: 'Choose a game' }).selectOption(gameId);
    const stage = page.locator('.game-engine-stage');
    await expect(stage).toBeVisible();
    await page.waitForTimeout(500);

    const layout = await page.evaluate(() => {
      const element = document.querySelector('.game-engine-stage')?.getBoundingClientRect();
      return {
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        left: element?.left ?? -1,
        right: element?.right ?? Number.MAX_SAFE_INTEGER,
      };
    });
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.left).toBeGreaterThanOrEqual(-1);
    expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth + 1);

    const canvas = stage.locator('canvas').first();
    if (await canvas.count()) await expect(canvas).toHaveAttribute('aria-label', /interactive game surface/i);
    await page.screenshot({ path: testInfo.outputPath(`${gameId}.png`), fullPage: true });
  });
}
