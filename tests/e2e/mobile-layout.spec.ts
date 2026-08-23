import { expect, test } from '@playwright/test';

const games = [
  { id: 'fishing', label: 'Ocean Hunter' },
  { id: 'whackattack', label: 'Whack Attack 3D' },
  { id: 'jetpilot', label: 'Jet Pilot Lander' },
  { id: 'plinko', label: 'Peg Plinko' },
  { id: 'slots', label: 'Volt Vault Slots' },
  { id: 'neonhopper', label: 'Neon Hopper' },
  { id: 'kongclimber', label: 'Kong Climber' },
  { id: 'blockdrop', label: 'Block Drop' },
  { id: 'mancala', label: 'Mancala 3D' },
  { id: 'chutes', label: 'Chutes & Ladders' },
];

for (const gameId of games) {
  test(`${gameId.label} stays inside the mobile viewport`, async ({ page }, testInfo) => {
    await page.goto(`./?game=${gameId.id}`);
    await page.getByRole('button', { name: gameId.label }).click();
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
    await stage.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.game-engine-stage button:focus')).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath(`${gameId.id}.png`), fullPage: true });
  });
}
