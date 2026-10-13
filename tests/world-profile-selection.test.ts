import test from 'node:test';
import assert from 'node:assert/strict';
import { worldProfileSelectionTag } from '../src/world/profiles.ts';
test('historical world selection IDs remain compatible without shadowing installed taxonomy tags',()=>{
  for(const [old,name]of Object.entries({cyberpunk:'cyberpunk',fantasy:'fantasy',sky:'floating',snowfield:'polar',lava:'volcanic',ship:'harbor',gobi:'desert',grave:'dungeon'}))assert.equal(worldProfileSelectionTag(`general-taxonomy:setting.${old}`),`worlds:setting.${name}`);
  assert.equal(worldProfileSelectionTag('worlds:setting.fantasy'),'worlds:setting.fantasy');
  assert.equal(worldProfileSelectionTag('general-taxonomy:body.tail'),'general-taxonomy:body.tail');
});
