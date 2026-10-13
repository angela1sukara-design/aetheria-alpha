export async function enterFolio(page) {
  await page.locator('#location-name').filter({hasText:/./}).waitFor({state:'attached'});
  if(await page.locator('#cover-enter').isVisible())await page.locator('#cover-enter').click();
}
export async function openFolioPage(page,name) {
  await enterFolio(page);
  const direct=page.locator(`#${name}-open`);
  if(await direct.isVisible()){await direct.click();return;}
  await page.locator('#menu-open').click();
  const mobile=page.locator(`#folio-menu [data-dialog-open="${name}"]`);
  if(await mobile.count())await mobile.first().click();else await direct.click();
}
export async function folioHome(page) {
  await enterFolio(page);
  if(await page.locator('#subpage-host').isVisible())await page.locator('#page-home').click();
  if(await page.locator('#scene-return').isVisible())await page.locator('#scene-return').click();
}
export async function chooseFolioCard(page,id) {
  await folioHome(page);
  let card=page.locator(`#actions [data-card-action="${id}"]`).first();
  if(!await card.count())return;
  const category=await card.evaluate(node=>node.closest('.action-group').dataset.group);
  if(!await card.isVisible()){
    if(await page.locator('#cards-back').isVisible())await page.locator('#cards-back').click();
    if(await page.locator('#card-back').isVisible())await page.locator('#card-back').click();
    if(await page.locator('#cards-back').isVisible())await page.locator('#cards-back').click();
    await page.locator(`[data-folio-category="${category}"]`).click();
    const locked=card.locator('xpath=ancestor::details[1]');
    if(await locked.count()&&!await locked.evaluate(node=>node.open))await locked.locator('summary').click();
    for(let i=0;!await card.isVisible()&&i<80;i++){
      const group=page.locator(`#actions .action-group[data-group="${category}"]`),next=group.getByRole('button',{name:'下一页 →',exact:true});
      if(await next.isEnabled())await next.click();else {
        const previous=group.getByRole('button',{name:'← 上一页',exact:true});
        while(await previous.isEnabled())await previous.click();
      }
    }
  }
  await card.click();
}
export async function performFolioAction(page,id) {
  await enterFolio(page);
  const direct=page.locator(`button[data-action="${id}"]`).filter({visible:true}).first();
  if(await direct.count())await direct.click();else {await chooseFolioCard(page,id);await page.locator(`#card-controls [data-action="${id}"]`).click();}
  await page.waitForTimeout(300);
}
