import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { enterFolio, openFolioPage, performFolioAction, folioHome } from './folio-navigation.mjs';

const out = path.resolve('artifacts/story-replay-sample');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const manifest = await json(path.join(out, 'samples.json'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors = [], network = [], results = [];
let serial = 0;
const materialOf = state => state.player.body.parts.find(p => p.instanceId === 'leg.left').overrides?.materialId;
try {
  for (const sample of manifest.samples) {
    const paths = sample.stamina ? ['pull'] : ['withdraw', 'skip'];
    const settled = [];
    let checkpoint;
    for (const route of paths) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
      try {
        const page = await context.newPage(); page.setDefaultTimeout(12000);
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
        await page.goto(pathToFileURL(path.join(out, sample.file)).href);
        await page.locator('#location-name').filter({ hasText: sample.binding.fills.place }).waitFor({ state: 'attached' });
        await enterFolio(page);
        await page.waitForFunction(text => document.querySelector('#scene-text')?.textContent.replace(/\s+/g, '') === text.replace(/\s+/g, ''), sample.initialScene);
        const act = async suffix => {
          await folioHome(page); await performFolioAction(page, 'stories:action.mire-trap.' + suffix);
          assert.ok(!await page.locator('#feedback').evaluate(n => n.classList.contains('error')), await page.locator('#feedback').innerText());
        };
        let lastExport;
        const snapshot = async () => {
          await folioHome(page); await openFolioPage(page, 'save');
          const downloaded = page.waitForEvent('download'); await page.locator('#save-export').click();
          const file = path.join(out, 'verified-save-' + ++serial + '.json');
          await (await downloaded).saveAs(file); await folioHome(page);
          lastExport = file;
          return (await json(file)).payload.state;
        };
        const initial = await snapshot();
        assert.equal(initial.player.variables['core:stamina'], sample.stamina);
        assert.equal(initial.district.profile.adultOptional, false);
        assert.deepEqual(initial.eventInstances.find(e => e.status === 'active').context, sample.binding);
        if (sample.stamina) {
          await act('pull'); await act('leave');
          const end = await snapshot();
          assert.equal(end.clock.totalMinutes - initial.clock.totalMinutes, 10);
          assert.equal(end.player.variables['core:stamina'], 55);
          assert.equal(end.activeEventStack.length, 0);
          assert.equal(end.player.flags['progression:flag.aftermath.mark'], false);
          assert.equal(materialOf(end), undefined);
        } else {
          assert.match(sample.initialScene, /疲乏的双腿/);
          if (checkpoint) {
            await openFolioPage(page, 'save'); await page.locator('#save-import').setInputFiles(checkpoint);
            await page.locator('#save-message').filter({ hasText: '已导入到当前游戏' }).waitFor();
            await folioHome(page);
          } else {
            await act('sink'); await act('endure');
          }
          const defeated = await snapshot();
          checkpoint ??= lastExport;
          const material = sample.material === 'M5' ? 'progression:material.living-latex' : 'progression:material.slime-mucus';
          assert.equal(materialOf(defeated), material);
          assert.equal(defeated.player.flags['progression:flag.aftermath.mark'], true);
          await act(route);
          const edge = await snapshot(); settled.push(edge);
          assert.equal(edge.eventInstances.find(e => e.status === 'active').nodeId, 'edge');
          assert.equal(edge.clock.totalMinutes - initial.clock.totalMinutes, 20);
          assert.equal(materialOf(edge), material);
          if (route === 'skip') {
            await page.setViewportSize({ width: 390, height: 844 });
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.screenshot({ path: path.join(out, sample.key + '-mobile.png'), fullPage: true });
            await act('clean'); const cleaned = await snapshot();
            assert.equal(materialOf(cleaned), undefined);
            assert.equal(cleaned.player.flags['progression:flag.aftermath.mark'], false);
            assert.equal(cleaned.clock.totalMinutes - initial.clock.totalMinutes, 30);
            assert.equal(cleaned.activeEventStack.length, 0);
          } else {
            await act('leave'); const kept = await snapshot();
            assert.equal(materialOf(kept), material);
            assert.equal(kept.player.flags['progression:flag.aftermath.mark'], true);
            assert.equal(kept.activeEventStack.length, 0);
          }
        }
      } finally { await context.close(); }
    }
    if (settled.length === 2) for (const key of ['clock', 'player', 'rng', 'eventInstances', 'tfQueues']) assert.deepEqual(settled[0][key], settled[1][key], `${sample.key}: ${key}`);
    results.push({ key: sample.key, seed: sample.seed, passed: true, routes: paths });
    console.log('PASS ' + sample.title + '：实际界面与导出存档一致');
  }
  assert.deepEqual(errors, []); assert.deepEqual(network, []);
  await writeFile(path.join(out, 'browser-results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), results, errors, network, note: '正常/跳过分别在独立真实浏览器会话中，从同一份受困存档继续，再按导出存档逐项比较；两种低资源材质均完成移动端清理。' }, null, 2) + '\n');
} finally { await browser.close(); }
