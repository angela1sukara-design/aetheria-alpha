/**
 * 野外 4+1 战败 · 敌人 spec 工厂（供 wild-defeat-mount.mjs 合载）。
 */

function notCombo(comboCond, comboKey) {
  return { op: 'not', condition: comboCond(comboKey) };
}

export function salivaWolfSpec(_h) {
  return {
    slug: 'saliva_wolf',
    profileNs: 'beast',
    displayName: '兽径涎狼',
    stagePrefix: 'sw',
    defeatTag: 'defeat.beast.saliva_wolf',
    playerMarkTag: 'saliva.mark',
    flags: {
      defeatDone: 'defeat.beast.saliva_wolf.done',
      markUnwiped: 'saliva_wolf.neck_unwiped',
      corruption: 'corruption.beast.saliva_wolf',
    },
    tags: [
      {
        key: 'defeat.beast.saliva_wolf',
        label: '兽径涎狼战败',
        definition: '对手为兽径涎狼时的战败叙事入口；不等于物种 TF。',
      },
      {
        key: 'saliva.mark',
        label: '颈侧涎痕',
        definition: '战败结算：颈侧留有口涎接触事实（叙事用）。',
      },
      {
        key: 'beast.combo.saliva_neck',
        label: '兽口涎×脖颈×兽吻舔颈',
        definition: '涎狼自动组合行 1；词条≠玩法≠数值。',
      },
      {
        key: 'beast.combo.fur_waist',
        label: '潮湿绒毛×腰侧×爪按肩胛',
        definition: '涎狼自动组合行 2。',
      },
      {
        key: 'beast.combo.saliva_thigh',
        label: '口涎×大腿内侧×涂抹',
        definition: '涎狼自动组合行 3。',
      },
    ],
    combos: [
      { key: 'saliva_neck', tagKey: 'beast.combo.saliva_neck' },
      { key: 'fur_waist', tagKey: 'beast.combo.fur_waist' },
      { key: 'saliva_thigh', tagKey: 'beast.combo.saliva_thigh' },
    ],
    enemy: {
      hp: 52,
      reward: 14,
      tier: 'S',
      combat: {
        attack: 10,
        defense: 5,
        speed: 11,
        skillPower: 9,
        hit: 72,
        evasion: 10,
        crit: 6,
        actionsPerTurn: 1,
        skillResource: 0,
      },
      intents: [
        { label: '扑肩压制', damage: 6, guard: 1, drain: 0 },
        { label: '涎吻掠颈', damage: 4, guard: 2, drain: 0 },
        { label: '爪按钉地', damage: 9, guard: 0, drain: 1 },
      ],
    },
    env: {
      ruleId: 'saliva_wolf.wild',
      requiresTags: ['foundation:theme.exploration', 'foundation:theme.beast-form'],
      name: '兽径涎狼（林缘）',
      weight: 22,
      priority: 6,
      hp: 48,
      combat: { attack: 9, defense: 5, speed: 12 },
    },
    buildChoices(ctx) {
      const {
        comboCond,
        grasp,
        adultGate,
        flagSet,
        FLAG_DEFEAT_DONE,
        FLAG_MARK,
        FLAG_CORRUPTION,
        time,
        health,
        choice,
        px,
      } = ctx;
      return {
        titles: {
          capture: '兽径泥地',
          press: '泥里的拉锯',
          pressAdult: '衣摆被顶开',
          peak: '肩头的利齿',
          peakAdult: '布料湿透',
          resolve: '涎狼退去',
          corrSeed: '营地里的余味',
          corrSlip: '夜里的兽径',
          corrSink: '兽径转弯',
        },
        capture: [
          choice('挣肩胛上的爪', '你扭肩抽手，爪垫在肩胛上打滑半寸。', `${px}-press`, [time(5)], [grasp]),
          choice('护住脖颈侧滚', '你收颈翻滚，泥地蹭过脸颊。', `${px}-press`, [time(5)], [
            notCombo(comboCond, 'saliva_neck'),
          ]),
          choice('顺着兽吻舔颈的角度侧颈', '你把脖颈侧过去，方便它沿颈侧施力。', `${px}-press`, [time(5)], [
            comboCond('saliva_neck'),
          ]),
        ],
        press: [
          choice('把脸埋进臂弯少碰涎水', '你把脸埋进臂弯，涎水蹭在袖上。', `${px}-peak`, [time(5)], [
            notCombo(comboCond, 'saliva_thigh'),
          ]),
          choice('并拢腿根挡住大腿内侧', '你并拢腿根，挡住往腿根抹开的涎水。', `${px}-peak`, [time(5)], [
            comboCond('saliva_thigh'),
          ]),
          choice('腰塌下去换一口气', '你塌腰换气，绒毛贴得更紧。', `${px}-press-adult`, [time(5)], adultGate),
        ],
        pressAdult: [
          choice('腰塌下去换一口气', '你塌腰换气，绒毛贴得更紧。', `${px}-peak`, [time(5)]),
          choice('夹紧腿根把吻部顶开', '你夹紧腿根，把吻部顶离大腿。', `${px}-peak`, [time(5)]),
          choice('反手去抠按肩的爪缝', '你反手抠进爪缝，逼它抬爪。', `${px}-peak`, [time(5)], [grasp]),
        ],
        peak: [
          choice('用空出来的手戳它眼周', '你戳向眼周，它头一偏。', `${px}-resolve`, [time(5)], [grasp]),
          choice('大喊，想吓起附近鸟群', '你放声大喊，林子里鸟群惊起。', `${px}-resolve`, [time(5)]),
          choice('把脖颈再送近半分，换它松爪', '你把脖颈送近，换它爪劲一松。', `${px}-peak-adult`, [time(5)], adultGate),
        ],
        peakAdult: [
          choice('抓颈毛往后拽', '你攥住颈毛往后拽，它喉间一哽。', `${px}-resolve`, [time(5)], [grasp]),
          choice('屈膝顶它小腹', '你屈膝上顶，它腹毛一缩。', `${px}-resolve`, [time(5)]),
          choice('咬住袖口忍住出声', '你咬住袖口，把喘息压进布里。', `${px}-resolve`, [time(5)]),
        ],
        resolve: [
          choice(
            '撑起来往火堆方向挪',
            '你撑起身，朝营火方向慢慢挪动。',
            null,
            [time(15), health(5), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK)],
          ),
          choice(
            '先擦净脖颈再走',
            '你擦净脖颈的涎迹，整理衣领离开兽径。',
            null,
            [time(10), health(5), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK, false)],
          ),
          choice(
            '就地靠树缓一会儿',
            '你靠树喘息，颈侧涎迹慢慢变凉。',
            null,
            [time(20), health(8), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK)],
          ),
        ],
        corrSeed: [
          choice(
            '立刻洗净，把袖口也换掉',
            '你把脖颈和袖口都洗净，兽径的味道淡下去。',
            null,
            [time(10), flagSet(FLAG_CORRUPTION, false), flagSet(FLAG_MARK, false)],
          ),
          choice('把这味留到夜里再洗', '你决定把味道留到夜里。', `${px}-corr-slip`, [time(5)]),
          choice('假装没事去睡', '你装作没事，先去睡。', null, [time(30), health(5)]),
        ],
        corrSlip: [
          choice('用腰带勒紧领口', '你把领口勒紧，肩背慢慢挺直。', null, [time(5), flagSet(FLAG_CORRUPTION, false)]),
          choice('再闻一次袖口', '你又闻了一次袖口，肩胛发软。', null, [time(5), flagSet(FLAG_CORRUPTION)]),
          choice('出门往兽径方向走', '你推门走向兽径。', `${px}-corr-sink`, [time(10), flagSet(FLAG_CORRUPTION)]),
        ],
        corrSink: [
          choice('跟它走进更深的林子', '你跟着它没入深林，林光在背后合拢。', null, [time(15), flagSet(FLAG_CORRUPTION)]),
          choice('抓起石子砸它鼻梁后逃', '你抓起石子砸向鼻梁，转身逃回营地。', null, [
            time(10),
            health(3),
            flagSet(FLAG_CORRUPTION, false),
          ]),
          choice('停在这里，下次再进', '你停在转弯处，把决定留到下次。', null, [time(5), flagSet(FLAG_CORRUPTION)]),
        ],
      };
    },
  };
}

export function forestSlugSpec(_h) {
  return {
    slug: 'forest_slug',
    profileNs: 'beast',
    displayName: '林缘蛞蝓兽',
    stagePrefix: 'fs',
    defeatTag: 'defeat.beast.forest_slug',
    playerMarkTag: 'forest_slug.slime_coat',
    flags: {
      defeatDone: 'defeat.beast.forest_slug.done',
      markUnwiped: 'forest_slug.coat_unwiped',
      corruption: 'corruption.beast.forest_slug',
    },
    tags: [
      {
        key: 'defeat.beast.forest_slug',
        label: '林缘蛞蝓兽战败',
        definition: '对手为林缘蛞蝓兽时的战败叙事入口；厚质外膜慢压，不等于物种 TF。',
      },
      {
        key: 'forest_slug.slime_coat',
        label: '蛞蝓黏液覆层',
        definition: '战败结算：体表留有蛞蝓黏液涂覆事实（叙事用）。',
      },
      {
        key: 'beast.combo.forest_slug.ankle',
        label: '蛞蝓黏液×脚踝×涂覆',
        definition: '林缘蛞蝓兽自动组合行 1；词条≠玩法≠数值。',
      },
      {
        key: 'beast.combo.forest_slug.thigh',
        label: '蛞蝓黏液×大腿内侧×滴落包覆',
        definition: '林缘蛞蝓兽自动组合行 2。',
      },
      {
        key: 'beast.combo.forest_slug.waist',
        label: '蛞蝓黏液×腰侧×涂覆',
        definition: '林缘蛞蝓兽自动组合行 3。',
      },
    ],
    combos: [
      { key: 'slug_ankle_coat', tagKey: 'beast.combo.forest_slug.ankle' },
      { key: 'slug_thigh_drip', tagKey: 'beast.combo.forest_slug.thigh' },
      { key: 'slug_waist_layer', tagKey: 'beast.combo.forest_slug.waist' },
    ],
    enemy: {
      hp: 58,
      reward: 12,
      tier: 'S',
      combat: {
        attack: 8,
        defense: 8,
        speed: 7,
        skillPower: 7,
        hit: 70,
        evasion: 6,
        crit: 4,
        actionsPerTurn: 1,
        skillResource: 0,
      },
      intents: [
        { label: '厚膜慢压', damage: 5, guard: 3, drain: 0 },
        { label: '黏液涂踝', damage: 3, guard: 2, drain: 0 },
        { label: '腹足缠腰', damage: 7, guard: 1, drain: 1 },
      ],
    },
    env: {
      ruleId: 'forest_slug.wild',
      requiresTags: ['foundation:theme.exploration', 'foundation:theme.gel'],
      name: '林缘蛞蝓兽（凝胶林缘）',
      weight: 18,
      priority: 6,
      hp: 54,
      combat: { attack: 7, defense: 8, speed: 7 },
    },
    buildChoices(ctx) {
      const {
        comboCond,
        grasp,
        adultGate,
        flagSet,
        FLAG_DEFEAT_DONE,
        FLAG_MARK,
        FLAG_CORRUPTION,
        time,
        health,
        choice,
        px,
      } = ctx;
      return {
        titles: {
          capture: '林缘软泥',
          press: '厚膜推进',
          pressAdult: '黏液渗过衣缝',
          peak: '腹足收拢',
          peakAdult: '腿根被滴落包覆',
          resolve: '蛞蝓兽退开',
          corrSeed: '营地的黏滑',
          corrSlip: '夜里摸脚踝',
          corrSink: '再赴林缘',
        },
        capture: [
          choice('抽脚甩开踝上的膜', '你抽脚，厚膜在踝骨上滑开一线。', `${px}-press`, [time(5)], [grasp]),
          choice('撑地往后挪开腰侧', '你撑地后挪，腹足在腰侧落空。', `${px}-press`, [time(5)], [
            notCombo(comboCond, 'slug_waist_layer'),
          ]),
          choice('任它把黏液涂覆在脚踝', '你停住脚，让它把黏液完整涂覆在踝骨。', `${px}-press`, [time(5)], [
            comboCond('slug_ankle_coat'),
          ]),
        ],
        press: [
          choice('抬膝顶开腹足', '你抬膝上顶，腹足在腰侧松开半寸。', `${px}-peak`, [time(5)], [
            notCombo(comboCond, 'slug_thigh_drip'),
          ]),
          choice('并拢腿根挡滴落的黏液', '你并拢腿根，挡住往腿根滴落的黏液。', `${px}-peak`, [time(5)], [
            comboCond('slug_thigh_drip'),
          ]),
          choice('腰侧贴地，换一口气', '你把腰侧贴地，厚膜慢慢往肋下推。', `${px}-press-adult`, [time(5)], adultGate),
        ],
        pressAdult: [
          choice('抠进腹足边缘', '你抠进腹足边缘，逼它抬离腰窝。', `${px}-peak`, [time(5)], [grasp]),
          choice('侧翻把黏液蹭到草上', '你侧翻，把黏液蹭到草叶上。', `${px}-peak`, [time(5)]),
          choice('放松腰侧随它涂覆', '你放松腰侧，让它把黏液涂满腰窝。', `${px}-peak`, [time(5)], [
            comboCond('slug_waist_layer'),
          ]),
        ],
        peak: [
          choice('抓树枝借力起身', '你抓住低枝借力，腹足从背后滑开。', `${px}-resolve`, [time(5)], [grasp]),
          choice('用石块敲它头冠', '你用石块敲向头冠，它膜面一缩。', `${px}-resolve`, [time(5)]),
          choice('大腿内侧随滴落微微分开', '你大腿内侧随滴落微微分开，换它收力。', `${px}-peak-adult`, [time(5)], adultGate),
        ],
        peakAdult: [
          choice('把黏液抹匀在腿根', '你把腿根的黏液抹匀，膜面贴得更整。', `${px}-resolve`, [time(5)]),
          choice('蜷起腿根挤出黏液', '你蜷起腿根，挤出一线黏液。', `${px}-resolve`, [time(5)]),
          choice('任其滴落包覆腿内侧', '你任其滴落包覆腿内侧，腹足慢慢松开。', `${px}-resolve`, [time(5)], [
            comboCond('slug_thigh_drip'),
          ]),
        ],
        resolve: [
          choice(
            '刮掉踝上黏液离开',
            '你刮掉踝上黏液，沿林缘小径离开。',
            null,
            [time(15), health(5), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK, false)],
          ),
          choice(
            '留着覆层先回营地',
            '你留着体表覆层，先回营地处理。',
            null,
            [time(12), health(5), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK)],
          ),
          choice(
            '在溪边冲洗再动身',
            '你在溪边冲洗，黏液被水流带走。',
            null,
            [time(20), health(8), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK, false)],
          ),
        ],
        corrSeed: [
          choice('把裤脚洗净收好', '你把裤脚洗净收好，黏滑感淡下去。', null, [
            time(10),
            flagSet(FLAG_CORRUPTION, false),
            flagSet(FLAG_MARK, false),
          ]),
          choice('夜里还觉踝骨发黏', '你夜里还觉踝骨发黏，没立刻去洗。', `${px}-corr-slip`, [time(5)]),
          choice('当作普通擦伤处理', '你当作普通擦伤处理，继续日常。', null, [time(20), health(5)]),
        ],
        corrSlip: [
          choice('穿厚袜勒紧踝骨', '你穿厚袜勒紧踝骨，步子稳下来。', null, [time(5), flagSet(FLAG_CORRUPTION, false)]),
          choice('摸一遍腰侧的干痕', '你摸一遍腰侧的干痕，指腹发黏。', null, [time(5), flagSet(FLAG_CORRUPTION)]),
          choice('独往林缘凝胶带', '你独往林缘凝胶带。', `${px}-corr-sink`, [time(10), flagSet(FLAG_CORRUPTION)]),
        ],
        corrSink: [
          choice('在软泥里站定任它覆层', '你在软泥里站定，任它把覆层推满腰侧。', null, [
            time(15),
            flagSet(FLAG_CORRUPTION),
          ]),
          choice('折返营地不再深入', '你折返营地，不再深入林缘。', null, [time(10), health(3), flagSet(FLAG_CORRUPTION, false)]),
          choice('只留标记，改日再来', '你只留标记，改日再来。', null, [time(5), flagSet(FLAG_CORRUPTION)]),
        ],
      };
    },
  };
}

export function tentacleVineSpec(_h) {
  return {
    slug: 'tentacle_vine',
    profileNs: 'monster',
    displayName: '触手藤',
    stagePrefix: 'tv',
    defeatTag: 'defeat.monster.tentacle_vine',
    playerMarkTag: 'tentacle_vine.bind_mark',
    flags: {
      defeatDone: 'defeat.monster.tentacle_vine.done',
      markUnwiped: 'tentacle_vine.bind_unwiped',
      corruption: 'corruption.monster.tentacle_vine',
    },
    tags: [
      {
        key: 'defeat.monster.tentacle_vine',
        label: '触手藤战败',
        definition: '对手为触手藤时的战败叙事入口；活藤束缚，非黏液覆层。',
      },
      {
        key: 'tentacle_vine.bind_mark',
        label: '藤勒痕',
        definition: '战败结算：体表留有活藤勒紧与悬挂事实（叙事用）。',
      },
      {
        key: 'monster.combo.tentacle_vine.wrist',
        label: '活藤湿膜×手腕×缠绕',
        definition: '触手藤自动组合行 1；词条≠玩法≠数值。',
      },
      {
        key: 'monster.combo.tentacle_vine.neck',
        label: '缠绕茎×脖颈×勒紧固定',
        definition: '触手藤自动组合行 2。',
      },
      {
        key: 'monster.combo.tentacle_vine.hang',
        label: '活藤×身后×倒挂',
        definition: '触手藤自动组合行 3。',
      },
    ],
    combos: [
      { key: 'vine_wrist_bind', tagKey: 'monster.combo.tentacle_vine.wrist' },
      { key: 'vine_neck_tight', tagKey: 'monster.combo.tentacle_vine.neck' },
      { key: 'vine_hang_back', tagKey: 'monster.combo.tentacle_vine.hang' },
    ],
    enemy: {
      hp: 54,
      reward: 15,
      tier: 'S',
      combat: {
        attack: 9,
        defense: 6,
        speed: 10,
        skillPower: 8,
        hit: 71,
        evasion: 9,
        crit: 5,
        actionsPerTurn: 1,
        skillResource: 0,
      },
      intents: [
        { label: '藤绕手腕', damage: 4, guard: 2, drain: 0 },
        { label: '茎勒脖颈', damage: 6, guard: 1, drain: 0 },
        { label: '倒挂提离', damage: 8, guard: 0, drain: 1 },
      ],
    },
    env: {
      ruleId: 'tentacle_vine.wild',
      requiresTags: ['foundation:theme.exploration', 'foundation:theme.beast-form'],
      name: '触手藤（林冠）',
      weight: 16,
      priority: 6,
      hp: 50,
      combat: { attack: 8, defense: 6, speed: 11 },
    },
    buildChoices(ctx) {
      const {
        comboCond,
        grasp,
        adultGate,
        flagSet,
        FLAG_DEFEAT_DONE,
        FLAG_MARK,
        FLAG_CORRUPTION,
        time,
        health,
        choice,
        px,
      } = ctx;
      return {
        titles: {
          capture: '林冠垂藤',
          press: '藤茎收紧',
          pressAdult: '倒挂晃荡',
          peak: '颈侧勒痕',
          peakAdult: '身后藤环',
          resolve: '藤群松开',
          corrSeed: '腕上的湿膜',
          corrSlip: '梦见倒挂',
          corrSink: '再入林冠',
        },
        capture: [
          choice('反手掰开腕上湿膜', '你反手掰开腕上湿膜，指节重获半寸空隙。', `${px}-press`, [time(5)], [grasp]),
          choice('收颈护住喉结', '你收颈护住喉结，茎圈在锁骨上方打滑。', `${px}-press`, [time(5)], [
            notCombo(comboCond, 'vine_neck_tight'),
          ]),
          choice('随缠绕茎勒紧固定脖颈', '你随缠绕茎勒紧，把脖颈固定在它施力的角度。', `${px}-press`, [time(5)], [
            comboCond('vine_neck_tight'),
          ]),
        ],
        press: [
          choice('蹬树干借力下坠', '你蹬树干借力下坠，藤环在身后滑开。', `${px}-peak`, [time(5)], [
            notCombo(comboCond, 'vine_hang_back'),
          ]),
          choice('放松肩背随活藤倒挂', '你放松肩背，活藤把你从地面提离倒挂。', `${px}-peak`, [time(5)], [
            comboCond('vine_hang_back'),
          ]),
          choice('扭腰让藤茎错开腰窝', '你扭腰，藤茎错开腰窝，呼吸顺了一线。', `${px}-press-adult`, [time(5)], adultGate),
        ],
        pressAdult: [
          choice('在倒挂里收紧腹肌', '你在倒挂里收紧腹肌，晃幅变小。', `${px}-peak`, [time(5)], [
            comboCond('vine_hang_back'),
          ]),
          choice('用空闲手抓近处枝杈', '你用空闲手抓近处枝杈，藤环松半圈。', `${px}-peak`, [time(5)], [grasp]),
          choice('任腕上湿膜再缠一圈', '你任腕上湿膜再缠一圈，指节被固定得更死。', `${px}-peak`, [time(5)], [
            comboCond('vine_wrist_bind'),
          ]),
        ],
        peak: [
          choice('以肘击打断近藤', '你以肘击打断近藤，茎圈一颤。', `${px}-resolve`, [time(5)], [grasp]),
          choice('屏息等它松劲', '你屏息等它松劲，勒痕处血脉回涌。', `${px}-resolve`, [time(5)]),
          choice('把脖颈送近换倒挂角度', '你把脖颈送近，换倒挂时藤环的角度。', `${px}-peak-adult`, [time(5)], adultGate),
        ],
        peakAdult: [
          choice('在晃荡里并紧腿', '你在晃荡里并紧腿，藤茎离开腿根。', `${px}-resolve`, [time(5)]),
          choice('用牙咬断一根细藤', '你用牙咬断一根细藤，身后一轻。', `${px}-resolve`, [time(5)]),
          choice('随倒挂把体重交给藤环', '你随倒挂把体重交给藤环，茎圈在身后收死。', `${px}-resolve`, [time(5)], [
            comboCond('vine_hang_back'),
          ]),
        ],
        resolve: [
          choice(
            '落地整理衣领离开',
            '你落地整理衣领，沿兽径离开林冠。',
            null,
            [time(15), health(5), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK, false)],
          ),
          choice(
            '保留腕勒痕先回营地',
            '你保留腕上勒痕，先回营地。',
            null,
            [time(12), health(5), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK)],
          ),
          choice(
            '在树下缓到呼吸平稳',
            '你在树下缓到呼吸平稳，再动身。',
            null,
            [time(20), health(8), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK)],
          ),
        ],
        corrSeed: [
          choice('洗净腕上湿膜', '你洗净腕上湿膜，勒痕淡成浅印。', null, [
            time(10),
            flagSet(FLAG_CORRUPTION, false),
            flagSet(FLAG_MARK, false),
          ]),
          choice('夜里腕骨仍觉被缠', '你夜里腕骨仍觉被缠，没再洗。', `${px}-corr-slip`, [time(5)]),
          choice('当作普通扭伤', '你当作普通扭伤，继续行程。', null, [time(25), health(5)]),
        ],
        corrSlip: [
          choice('把领口束高', '你把领口束高，脖颈不再习惯性侧出。', null, [time(5), flagSet(FLAG_CORRUPTION, false)]),
          choice('闭眼重现倒挂晃幅', '你闭眼重现倒挂晃幅，肩背发软。', null, [time(5), flagSet(FLAG_CORRUPTION)]),
          choice('摸黑走向林冠垂藤', '你摸黑走向林冠垂藤。', `${px}-corr-sink`, [time(10), flagSet(FLAG_CORRUPTION)]),
        ],
        corrSink: [
          choice('在垂藤下主动抬腕', '你在垂藤下主动抬腕，任湿膜缠上。', null, [time(15), flagSet(FLAG_CORRUPTION)]),
          choice('砍断主藤后撤离', '你砍断主藤后撤离，林冠恢复安静。', null, [time(10), health(3), flagSet(FLAG_CORRUPTION, false)]),
          choice('记下位置改日再来', '你记下位置，改日再来。', null, [time(5), flagSet(FLAG_CORRUPTION)]),
        ],
      };
    },
  };
}

export function bogSlimeSpec(_h) {
  return {
    slug: 'bog_slime',
    profileNs: 'monster',
    displayName: '沼面软泥',
    stagePrefix: 'bs',
    defeatTag: 'defeat.monster.bog_slime',
    playerMarkTag: 'bog_slime.fluid_wrap',
    flags: {
      defeatDone: 'defeat.monster.bog_slime.done',
      markUnwiped: 'bog_slime.wrap_unwiped',
      corruption: 'corruption.monster.bog_slime',
    },
    tags: [
      {
        key: 'defeat.monster.bog_slime',
        label: '沼面软泥战败',
        definition: '对手为沼面软泥时的战败叙事入口；流体包覆塑形，无吞没与附身。',
      },
      {
        key: 'bog_slime.fluid_wrap',
        label: '史莱姆包覆',
        definition: '战败结算：体表留有史莱姆黏液包覆事实（叙事用）。',
      },
      {
        key: 'monster.combo.bog_slime.crotch',
        label: '史莱姆黏液×胯下×涂覆',
        definition: '沼面软泥自动组合行 1；词条≠玩法≠数值。',
      },
      {
        key: 'monster.combo.bog_slime.waist',
        label: '史莱姆黏液×腰侧×涂覆',
        definition: '沼面软泥自动组合行 2。',
      },
      {
        key: 'monster.combo.bog_slime.lip',
        label: '史莱姆黏液×嘴唇×封口包覆',
        definition: '沼面软泥自动组合行 3。',
      },
    ],
    combos: [
      { key: 'slime_crotch_coat', tagKey: 'monster.combo.bog_slime.crotch' },
      { key: 'slime_waist_mold', tagKey: 'monster.combo.bog_slime.waist' },
      { key: 'slime_lip_seal', tagKey: 'monster.combo.bog_slime.lip' },
    ],
    enemy: {
      hp: 50,
      reward: 13,
      tier: 'S',
      combat: {
        attack: 8,
        defense: 7,
        speed: 6,
        skillPower: 8,
        hit: 68,
        evasion: 5,
        crit: 4,
        actionsPerTurn: 1,
        skillResource: 0,
      },
      intents: [
        { label: '流体缠腰', damage: 5, guard: 2, drain: 0 },
        { label: '黏液涂胯', damage: 4, guard: 1, drain: 0 },
        { label: '膜面压合', damage: 7, guard: 0, drain: 1 },
      ],
    },
    env: {
      ruleId: 'bog_slime.wild',
      requiresTags: ['foundation:theme.exploration', 'foundation:context.waterways'],
      name: '沼面软泥（水际）',
      weight: 17,
      priority: 6,
      hp: 46,
      combat: { attack: 7, defense: 7, speed: 6 },
    },
    buildChoices(ctx) {
      const {
        comboCond,
        grasp,
        adultGate,
        flagSet,
        FLAG_DEFEAT_DONE,
        FLAG_MARK,
        FLAG_CORRUPTION,
        time,
        health,
        choice,
        px,
      } = ctx;
      return {
        titles: {
          capture: '水际软泥',
          press: '流体包覆',
          pressAdult: '膜面塑形',
          peak: '封口前的喘息',
          peakAdult: '黏液化倾向',
          resolve: '软泥退去',
          corrSeed: '衣缝里的滑',
          corrSlip: '夜里发黏',
          corrSink: '再赴水际',
        },
        capture: [
          choice('并腿挡开胯下流体', '你并腿挡开胯下流体，膜面在腿根打滑。', `${px}-press`, [time(5)], [
            comboCond('slime_crotch_coat'),
          ]),
          choice('捂嘴偏头躲膜面', '你捂嘴偏头，膜面没能贴上嘴唇。', `${px}-press`, [time(5)], [
            notCombo(comboCond, 'slime_lip_seal'),
          ]),
          choice('任封口包覆贴上嘴唇', '你停住呼吸，任封口包覆贴上嘴唇。', `${px}-press`, [time(5)], [
            comboCond('slime_lip_seal'),
          ]),
        ],
        press: [
          choice('扭腰挤出腰侧黏液', '你扭腰挤出腰侧黏液，膜面裂开一线。', `${px}-peak`, [time(5)], [
            comboCond('slime_waist_mold'),
          ]),
          choice('撑地把自己从泥面剥离', '你撑地把自己从泥面剥离，流体拖成长丝。', `${px}-peak`, [time(5)], [grasp]),
          choice('放松腰腹随它涂覆塑形', '你放松腰腹，随它在腰侧涂覆塑形。', `${px}-press-adult`, [time(5)], adultGate),
        ],
        pressAdult: [
          choice('接受膜面往黏液化方向贴合', '你接受膜面往黏液化方向贴合，体表轮廓被它重新抹平。', `${px}-peak`, [
            time(5),
          ]),
          choice('抠开胯下膜面留气缝', '你抠开胯下膜面，留出一道气缝。', `${px}-peak`, [time(5)]),
          choice('把流体往腰侧推匀', '你把流体往腰侧推匀，塑形更完整。', `${px}-peak`, [time(5)], [
            comboCond('slime_waist_mold'),
          ]),
        ],
        peak: [
          choice('用石块砸向膜心', '你用石块砸向膜心，流体四散。', `${px}-resolve`, [time(5)]),
          choice('屏息挣开唇上封口', '你屏息挣开唇上封口，空气涌入口腔。', `${px}-resolve`, [time(5)], [
            comboCond('slime_lip_seal'),
          ]),
          choice('任其继续包覆胯下', '你任其继续包覆胯下，膜面贴得更整。', `${px}-peak-adult`, [time(5)], adultGate),
        ],
        peakAdult: [
          choice('在膜内试着抬胯', '你在膜内试着抬胯，塑形跟着你的骨节走。', `${px}-resolve`, [time(5)]),
          choice('舔去唇缘一线黏液', '你舔去唇缘一线黏液，封口不再完整。', `${px}-resolve`, [time(5)]),
          choice('随黏液化贴合整片胯下', '你随黏液化贴合整片胯下，膜面与皮肤之间再无空隙。', `${px}-resolve`, [time(5)], [
            comboCond('slime_crotch_coat'),
          ]),
        ],
        resolve: [
          choice(
            '剥掉外层膜面离开',
            '你剥掉外层膜面，沿水际离开。',
            null,
            [time(15), health(5), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK, false)],
          ),
          choice(
            '留着包覆先回营地',
            '你留着包覆，先回营地。',
            null,
            [time(12), health(5), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK)],
          ),
          choice(
            '在浅水里涮洗再动身',
            '你在浅水里涮洗，流体被冲散。',
            null,
            [time(20), health(8), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK, false)],
          ),
        ],
        corrSeed: [
          choice('把内外衣都换洗', '你把内外衣都换洗，滑腻感消失。', null, [
            time(10),
            flagSet(FLAG_CORRUPTION, false),
            flagSet(FLAG_MARK, false),
          ]),
          choice('夜里皮肤仍觉发黏', '你夜里皮肤仍觉发黏，没再洗。', `${px}-corr-slip`, [time(5)]),
          choice('当作沾了沼泥', '你当作沾了沼泥，继续行程。', null, [time(25), health(5)]),
        ],
        corrSlip: [
          choice('用布条勒紧腰腹', '你用布条勒紧腰腹，膜面感被压下去。', null, [time(5), flagSet(FLAG_CORRUPTION, false)]),
          choice('摸一遍腰侧想象塑形', '你摸一遍腰侧想象塑形，指节发软。', null, [time(5), flagSet(FLAG_CORRUPTION)]),
          choice('独自走向水际软泥', '你独自走向水际软泥。', `${px}-corr-sink`, [time(10), flagSet(FLAG_CORRUPTION)]),
        ],
        corrSink: [
          choice('站进软泥任膜面合拢', '你站进软泥，任膜面从脚面合拢到腰。', null, [time(15), flagSet(FLAG_CORRUPTION)]),
          choice('绕开沼面返回', '你绕开沼面返回，水际恢复平静。', null, [time(10), health(3), flagSet(FLAG_CORRUPTION, false)]),
          choice('记下位置改日再来', '你记下位置，改日再来。', null, [time(5), flagSet(FLAG_CORRUPTION)]),
        ],
      };
    },
  };
}

export function hiveCrawlerSpec(_h) {
  return {
    slug: 'hive_crawler',
    profileNs: 'beast',
    displayName: '虫巢爬行者',
    stagePrefix: 'hc',
    defeatTag: 'defeat.beast.hive_crawler',
    playerMarkTag: 'hive_crawler.cocoon_mark',
    flags: {
      defeatDone: 'defeat.beast.hive_crawler.done',
      markUnwiped: 'hive_crawler.cocoon_unwiped',
      corruption: 'corruption.beast.hive_crawler',
    },
    tags: [
      {
        key: 'defeat.beast.hive_crawler',
        label: '虫巢爬行者战败',
        definition: '对手为虫巢爬行者时的战败叙事入口；节肢钳制与结茧，不等于物种 TF。',
      },
      {
        key: 'hive_crawler.cocoon_mark',
        label: '虫巢结茧痕',
        definition: '战败结算：体表留有虫巢黏液结茧或产卵接触事实（叙事用）。',
      },
      {
        key: 'beast.combo.hive_crawler.back',
        label: '虫巢黏液×身后×节肢钳制',
        definition: '虫巢爬行者自动组合行 1；词条≠玩法≠数值。',
      },
      {
        key: 'beast.combo.hive_crawler.wrist',
        label: '虫巢黏液×手腕×结茧涂覆',
        definition: '虫巢爬行者自动组合行 2。',
      },
      {
        key: 'beast.combo.hive_crawler.crotch',
        label: '虫巢黏液×胯下×产卵',
        definition: '虫巢爬行者自动组合行 3。',
      },
    ],
    combos: [
      { key: 'hive_back_clamp', tagKey: 'beast.combo.hive_crawler.back' },
      { key: 'hive_wrist_cocoon', tagKey: 'beast.combo.hive_crawler.wrist' },
      { key: 'hive_crotch_egg', tagKey: 'beast.combo.hive_crawler.crotch' },
    ],
    enemy: {
      hp: 56,
      reward: 16,
      tier: 'S',
      combat: {
        attack: 11,
        defense: 6,
        speed: 9,
        skillPower: 9,
        hit: 73,
        evasion: 8,
        crit: 5,
        actionsPerTurn: 1,
        skillResource: 0,
      },
      intents: [
        { label: '节肢钳背', damage: 6, guard: 1, drain: 0 },
        { label: '腕部结茧', damage: 4, guard: 2, drain: 0 },
        { label: '胯下产卵', damage: 8, guard: 0, drain: 1 },
      ],
    },
    env: {
      ruleId: 'hive_crawler.wild',
      requiresTags: ['foundation:theme.exploration', 'foundation:theme.risk'],
      name: '虫巢爬行者（风险林带）',
      weight: 15,
      priority: 6,
      hp: 52,
      combat: { attack: 10, defense: 6, speed: 10 },
    },
    buildChoices(ctx) {
      const {
        comboCond,
        grasp,
        adultGate,
        flagSet,
        FLAG_DEFEAT_DONE,
        FLAG_MARK,
        FLAG_CORRUPTION,
        time,
        health,
        choice,
        px,
      } = ctx;
      return {
        titles: {
          capture: '林带虫巢',
          press: '节肢钳制',
          pressAdult: '结茧涂覆',
          peak: '胯下接触',
          peakAdult: '产卵余温',
          resolve: '爬行者退巢',
          corrSeed: '腕上的茧丝',
          corrSlip: '夜里虫鸣',
          corrSink: '再入风险林带',
        },
        capture: [
          choice('耸肩甩开背后节肢', '你耸肩甩开背后节肢，钳口在肩胛打滑。', `${px}-press`, [time(5)], [
            notCombo(comboCond, 'hive_back_clamp'),
          ]),
          choice('随节肢钳制把背脊送实', '你随节肢钳制把背脊送实，钳口在身后收死。', `${px}-press`, [time(5)], [
            comboCond('hive_back_clamp'),
          ]),
          choice('抽手躲腕部结茧', '你抽手躲腕部结茧，指节重获半寸。', `${px}-press`, [time(5)], [grasp]),
        ],
        press: [
          choice('并腿护住胯下', '你并腿护住胯下，节肢在腿根落空。', `${px}-peak`, [time(5)], [
            notCombo(comboCond, 'hive_crotch_egg'),
          ]),
          choice('任虫巢黏液在胯下产卵', '你任虫巢黏液在胯下产卵，温热的包覆贴上来。', `${px}-peak`, [time(5)], [
            comboCond('hive_crotch_egg'),
          ]),
          choice('抬腕让结茧涂覆手腕', '你抬腕让结茧涂覆手腕，指节被茧丝固定。', `${px}-press-adult`, [time(5)], adultGate),
        ],
        pressAdult: [
          choice('撕扯腕上茧丝', '你撕扯腕上茧丝，结茧裂开一线。', `${px}-peak`, [time(5)], [grasp]),
          choice('放松手腕随结茧收拢', '你放松手腕，随结茧收拢到指根。', `${px}-peak`, [time(5)], [
            comboCond('hive_wrist_cocoon'),
          ]),
          choice('背脊贴地减轻钳劲', '你背脊贴地，减轻身后节肢的钳劲。', `${px}-peak`, [time(5)]),
        ],
        peak: [
          choice('滚身压断近侧节肢', '你滚身压断近侧节肢，钳口松开。', `${px}-resolve`, [time(5)]),
          choice('大声呼救引走虫群', '你大声呼救，远处虫群被引开。', `${px}-resolve`, [time(5)]),
          choice('胯下随产卵微微抬臀', '你胯下随产卵微微抬臀，换节肢施力的角度。', `${px}-peak-adult`, [time(5)], adultGate),
        ],
        peakAdult: [
          choice('抠去胯下温热的包覆', '你抠去胯下温热的包覆，余温留在皮肤上。', `${px}-resolve`, [time(5)]),
          choice('把茧丝往腕上缠紧', '你把茧丝往腕上缠紧，指节不再乱动。', `${px}-resolve`, [time(5)], [
            comboCond('hive_wrist_cocoon'),
          ]),
          choice('伏地等爬行者退巢', '你伏地等爬行者退巢，节肢从背后撤离。', `${px}-resolve`, [time(5)]),
        ],
        resolve: [
          choice(
            '剥茧离开林带',
            '你剥茧离开林带，身后虫鸣渐远。',
            null,
            [time(15), health(5), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK, false)],
          ),
          choice(
            '保留结茧痕回营地',
            '你保留结茧痕，先回营地。',
            null,
            [time(12), health(5), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK)],
          ),
          choice(
            '在火边烤干茧丝',
            '你在火边烤干茧丝，再动身。',
            null,
            [time(20), health(8), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK, false)],
          ),
        ],
        corrSeed: [
          choice('洗净腕茧与胯下痕迹', '你洗净腕茧与胯下痕迹，虫鸣在记忆里淡下去。', null, [
            time(10),
            flagSet(FLAG_CORRUPTION, false),
            flagSet(FLAG_MARK, false),
          ]),
          choice('夜里腕骨仍觉被茧缚', '你夜里腕骨仍觉被茧缚，没再处理。', `${px}-corr-slip`, [time(5)]),
          choice('当作普通虫咬', '你当作普通虫咬，继续行程。', null, [time(25), health(5)]),
        ],
        corrSlip: [
          choice('用护腕勒紧', '你用护腕勒紧，节肢感被压下去。', null, [time(5), flagSet(FLAG_CORRUPTION, false)]),
          choice('侧耳听虫巢方向', '你侧耳听虫巢方向，背脊发紧。', null, [time(5), flagSet(FLAG_CORRUPTION)]),
          choice('摸向风险林带深处', '你摸向风险林带深处。', `${px}-corr-sink`, [time(10), flagSet(FLAG_CORRUPTION)]),
        ],
        corrSink: [
          choice('在巢口站定抬腕', '你在巢口站定抬腕，任结茧再次涂覆。', null, [time(15), flagSet(FLAG_CORRUPTION)]),
          choice('点火熏退虫群后离开', '你点火熏退虫群后离开。', null, [time(10), health(3), flagSet(FLAG_CORRUPTION, false)]),
          choice('记下巢位改日再来', '你记下巢位，改日再来。', null, [time(5), flagSet(FLAG_CORRUPTION)]),
        ],
      };
    },
  };
}

export function gelWardenSpec(_h) {
  return {
    slug: 'gel_warden',
    profileNs: 'boss',
    displayName: '黑胶守卫',
    stagePrefix: 'gw',
    defeatTag: 'defeat.boss.gel_warden',
    playerMarkTag: 'gel_warden.seal_mark',
    flags: {
      defeatDone: 'defeat.boss.gel_warden.done',
      markUnwiped: 'gel_warden.seal_unwiped',
      corruption: 'corruption.boss.gel_warden',
    },
    tags: [
      {
        key: 'defeat.boss.gel_warden',
        label: '黑胶守卫战败',
        definition: '对手为活体黑胶守卫时的战败叙事入口；凝胶指令与覆层，不等于物种 TF。',
      },
      {
        key: 'gel_warden.seal_mark',
        label: '黑胶封口痕',
        definition: '战败结算：体表留有活体黑胶封口或覆层事实（叙事用）。',
      },
      {
        key: 'boss.combo.gel_warden.lip',
        label: '活体黑胶×嘴唇×封口包覆',
        definition: '黑胶守卫自动组合行 1；词条≠玩法≠数值。',
      },
      {
        key: 'boss.combo.gel_warden.body',
        label: '凝胶膜×整身×滴落包覆',
        definition: '黑胶守卫自动组合行 2。',
      },
      {
        key: 'boss.combo.gel_warden.crotch',
        label: '活体黑胶×胯下×抵入',
        definition: '黑胶守卫自动组合行 3。',
      },
    ],
    combos: [
      { key: 'gel_lip_seal', tagKey: 'boss.combo.gel_warden.lip' },
      { key: 'gel_body_drip', tagKey: 'boss.combo.gel_warden.body' },
      { key: 'gel_crotch_press', tagKey: 'boss.combo.gel_warden.crotch' },
    ],
    enemy: {
      hp: 120,
      reward: 28,
      tier: 'boss',
      combat: {
        attack: 14,
        defense: 10,
        speed: 9,
        skillPower: 14,
        hit: 74,
        evasion: 7,
        crit: 6,
        actionsPerTurn: 1,
        skillResource: 0,
      },
      intents: [
        { label: '黑胶封口', damage: 5, guard: 3, drain: 0 },
        { label: '膜面滴落', damage: 7, guard: 1, drain: 0 },
        { label: '胯下抵入', damage: 10, guard: 0, drain: 1 },
      ],
    },
    env: {
      ruleId: 'gel_warden.wild',
      requiresTags: ['foundation:theme.exploration', 'foundation:theme.gel'],
      name: '黑胶守卫（凝胶要地）',
      weight: 12,
      priority: 9,
      hp: 110,
      combat: { attack: 13, defense: 10, speed: 9 },
    },
    buildChoices(ctx) {
      const {
        comboCond,
        grasp,
        adultGate,
        flagSet,
        FLAG_DEFEAT_DONE,
        FLAG_MARK,
        FLAG_CORRUPTION,
        time,
        health,
        choice,
        px,
      } = ctx;
      return {
        titles: {
          capture: '凝胶要地',
          press: '黑胶指令',
          pressAdult: '膜面滴落',
          peak: '封口边缘',
          peakAdult: '胯下抵入',
          resolve: '守卫凝滞',
          corrSeed: '唇上的黑胶',
          corrSlip: '听凝胶低鸣',
          corrSink: '再入要地',
        },
        capture: [
          choice('捂唇退半步', '你捂唇退半步，黑胶没能贴上嘴唇。', `${px}-press`, [time(5)], [
            notCombo(comboCond, 'gel_lip_seal'),
          ]),
          choice('随活体黑胶封口包覆嘴唇', '你停住呼吸，随活体黑胶封口包覆嘴唇。', `${px}-press`, [time(5)], [
            comboCond('gel_lip_seal'),
          ]),
          choice('侧身躲整身滴落', '你侧身躲整身滴落，膜面只扫过肩线。', `${px}-press`, [time(5)], [
            notCombo(comboCond, 'gel_body_drip'),
          ]),
        ],
        press: [
          choice('展臂挡开胯下黑胶', '你展臂挡开胯下黑胶，抵入停在腿根外。', `${px}-peak`, [time(5)], [
            notCombo(comboCond, 'gel_crotch_press'),
          ]),
          choice('随黑胶抵入胯下', '你随黑胶抵入胯下，膜面跟着骨节塑形。', `${px}-peak`, [time(5)], [
            comboCond('gel_crotch_press'),
          ]),
          choice('任凝胶膜滴落包覆整身', '你任凝胶膜滴落包覆整身，轮廓被它重新抹平。', `${px}-press-adult`, [time(5)], adultGate),
        ],
        pressAdult: [
          choice('在膜内试着抬肘', '你在膜内试着抬肘，滴落包覆跟着你的动作走。', `${px}-peak`, [time(5)], [
            comboCond('gel_body_drip'),
          ]),
          choice('抠开唇缘一线封口', '你抠开唇缘一线封口，低鸣从喉间漏出。', `${px}-peak`, [time(5)]),
          choice('把胯下黑胶往深处送', '你把胯下黑胶往深处送，膜面贴得更死。', `${px}-peak`, [time(5)], [
            comboCond('gel_crotch_press'),
          ]),
        ],
        peak: [
          choice('以刃尖挑破膜心', '你以刃尖挑破膜心，黑胶退成一线。', `${px}-resolve`, [time(5)], [grasp]),
          choice('屏息挣开唇上封口', '你屏息挣开唇上封口，空气重新灌满肺腔。', `${px}-resolve`, [time(5)], [
            comboCond('gel_lip_seal'),
          ]),
          choice('听凝胶低鸣不再挣扎', '你听凝胶低鸣，不再挣扎，膜面慢慢松开。', `${px}-peak-adult`, [time(5)], adultGate),
        ],
        peakAdult: [
          choice('在覆层里试着屈膝', '你在覆层里试着屈膝，黑胶跟着你的骨节流动。', `${px}-resolve`, [time(5)]),
          choice('把封口留到自行脱落', '你把封口留到自行脱落，唇缘留下黑胶印。', `${px}-resolve`, [time(5)]),
          choice('随黑胶化贴合整身轮廓', '你随黑胶化贴合整身轮廓，膜面与皮肤之间再无空隙。', `${px}-resolve`, [time(5)], [
            comboCond('gel_body_drip'),
          ]),
        ],
        resolve: [
          choice(
            '剥膜离开要地',
            '你剥膜离开要地，凝胶低鸣在身后渐弱。',
            null,
            [time(15), health(5), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK, false)],
          ),
          choice(
            '保留封口痕撤离',
            '你保留封口痕，沿来路撤离。',
            null,
            [time(12), health(5), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK)],
          ),
          choice(
            '在要地边缘缓到膜面干透',
            '你在要地边缘缓到膜面干透，再动身。',
            null,
            [time(20), health(8), flagSet(FLAG_DEFEAT_DONE), flagSet(FLAG_MARK)],
          ),
        ],
        corrSeed: [
          choice('洗净唇上与锁骨黑胶', '你洗净唇上与锁骨黑胶，低鸣在记忆里淡下去。', null, [
            time(10),
            flagSet(FLAG_CORRUPTION, false),
            flagSet(FLAG_MARK, false),
          ]),
          choice('夜里仍听凝胶低鸣', '你夜里仍听凝胶低鸣，没再洗。', `${px}-corr-slip`, [time(5)]),
          choice('当作普通覆层处理', '你当作普通覆层处理，继续行程。', null, [time(25), health(5)]),
        ],
        corrSlip: [
          choice('用围巾遮住唇缘', '你用围巾遮住唇缘，低鸣被挡在布后。', null, [time(5), flagSet(FLAG_CORRUPTION, false)]),
          choice('闭眼回想黑胶化贴合', '你闭眼回想黑胶化贴合，膝弯发软。', null, [time(5), flagSet(FLAG_CORRUPTION)]),
          choice('独自走向凝胶要地', '你独自走向凝胶要地。', `${px}-corr-sink`, [time(10), flagSet(FLAG_CORRUPTION)]),
        ],
        corrSink: [
          choice('在要地中央站定张口', '你在要地中央站定张口，任活体黑胶再次封口。', null, [
            time(15),
            flagSet(FLAG_CORRUPTION),
          ]),
          choice('破膜逃离不再回头', '你破膜逃离，不再回头。', null, [time(10), health(3), flagSet(FLAG_CORRUPTION, false)]),
          choice('记下要地改日再来', '你记下要地，改日再来。', null, [time(5), flagSet(FLAG_CORRUPTION)]),
        ],
        corrSinkAdultOnly: true,
      };
    },
  };
}

export const WILD_DEFEAT_SPEC_FACTORIES = [
  salivaWolfSpec,
  forestSlugSpec,
  tentacleVineSpec,
  bogSlimeSpec,
  hiveCrawlerSpec,
  gelWardenSpec,
];
