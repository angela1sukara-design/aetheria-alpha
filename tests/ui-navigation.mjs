// Exercise the new menu → profile → game return paths in existing gameplay flows.
export async function clickUI(page, name, exact = false) {
  let target = page.getByRole('button', { name, exact }).first();
  if (!await target.count() && await page.locator('#subpage-host').isVisible()) {
    await page.locator('#page-home').click();
    target = page.getByRole('button', { name, exact }).first();
  }
  const closingProfile = (name === '关闭人物') && (await page.locator('#people-content').getAttribute('data-view')) === 'detail';
  await target.click(); await page.waitForTimeout(300);
  if (closingProfile) { await page.locator('#people-dialog [data-close]').click(); await page.waitForTimeout(300); }
  if (name === '人物' && await page.locator('#people-content .profile-open:visible').count()) {
    await page.locator('#people-content .profile-open:visible').first().click(); await page.waitForTimeout(300);
  }
  // These older gameplay checks inspect unavailable action reasons as well.
  const summary = page.locator('#actions .locked-actions:not([open]) > summary:visible').first();
  while (await summary.count()) await summary.click();
}
