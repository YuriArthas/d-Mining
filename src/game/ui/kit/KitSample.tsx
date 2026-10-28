import { useState, type CSSProperties } from 'react';
import { PetArt } from '../pets/PetArt.tsx';
import { EggArt } from '../pets/EggArt.tsx';
import { CloseButton, CountUp, Pill, PriceButton, Tile, UiButton, type Tone } from './controls.tsx';
import { Icon, type IconKind } from './icons.tsx';
import { Bar, Chip, RarityTag, Sheet, Toggle } from './panel.tsx';
import './kitSample.css';

const ICONS: IconKind[] = ['coin', 'tech', 'starcoin', 'luck', 'backpack', 'paw', 'chest', 'gift', 'grid', 'globe', 'portal', 'gem', 'question', 'gear', 'home', 'jump', 'plus', 'bolt', 'clover', 'exit', 'close', 'pickaxe', 'rebirth', 'lock'];
const TONES: Tone[] = ['green', 'orange', 'blue', 'purple', 'pink', 'gold', 'red', 'steel', 'white'];
const PETS = [
  { id: 'pebble-guardian', name: '磐岩熊', rarity: 'legendary', bonus: '+440%', icon: 'coin' },
  { id: 'amber-fox', name: '琥珀狐', rarity: 'rare', bonus: '+80%', icon: 'coin', equipped: true },
  { id: 'crystal-owl', name: '晶羽猫头鹰', rarity: 'rare', bonus: '+110%', icon: 'coin' },
  { id: 'gear-wing', name: '机械鹰', rarity: 'epic', bonus: '+290%', icon: 'tech' },
  { id: 'moss-slime', name: '苔团', rarity: 'common', bonus: '+50%', icon: 'coin', equipped: true },
] as const;
const noop = () => {};

/** The UI kit on one page (?kit=1): every control in every state, over grass and over rock, so a change to the kit
 *  can be checked on the public build without playing to the screen that uses it. */
export function KitSample() {
  const [coins, setCoins] = useState(4800);
  const [on, setOn] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [tab, setTab] = useState('pets');
  return <main className="game-shell kit-sample-shell" aria-label="UI 组件样板">
    <div className="kit-sample">
      <h1 className="ui-outline">UI 组件样板 · A 奶油卡片</h1>

      <section><h2>图标</h2><div className="kit-row kit-icons">{ICONS.map(kind => <span key={kind} title={kind}><Icon kind={kind} /></span>)}</div></section>

      <section><h2>资源条 · 主界面按钮</h2>
        <div className="kit-row kit-ground">
          <Pill icon="coin"><span className="ui-num"><CountUp value={coins} format={v => v.toLocaleString('en-US')} /></span></Pill>
          <Pill icon="backpack" meter={.48} plus={{ label: '升级背包', onPress: noop }}><span className="ui-num">12 / 25</span></Pill>
          <Pill icon="backpack" meter={1} state="full" plus={{ label: '升级背包', onPress: noop }}><span className="ui-num">25 / 25</span></Pill>
          <UiButton size="s" tone="white" onPress={() => setCoins(c => c + 1250)}>+1250 金币</UiButton>
        </div>
        <div className="kit-row kit-ground">
          <Tile icon="paw" label="宠物" tone="orange" badge="!" onPress={noop} />
          <Tile icon="chest" label="商店" tone="blue" onPress={noop} />
          <Tile icon="gift" label="奖励" tone="purple" badge={1} onPress={noop} />
          <Tile icon="rebirth" label="重生" tone="green" onPress={noop} />
          <Tile icon="gear" label="设置" tone="white" onPress={noop} />
          <CloseButton label="关闭" onPress={noop} />
        </div>
      </section>

      <section><h2>按钮</h2>
        <div className="kit-row">{TONES.map(tone => <UiButton key={tone} tone={tone} onPress={noop}>{tone === 'white' ? '次要' : '确定'}</UiButton>)}</div>
        <div className="kit-row">
          <UiButton size="s" tone="green" icon="coin" onPress={noop}>出售</UiButton>
          <UiButton size="m" tone="blue" icon="home" onPress={noop}>回地表</UiButton>
          <UiButton size="l" tone="orange" onPress={noop}>一键最佳</UiButton>
          <UiButton tone="green" disabled onPress={noop}>不可用</UiButton>
        </div>
        <div className="kit-row">
          <PriceButton verb="购买" price="480" currency="coin" onPress={noop} />
          <PriceButton verb="强化 +2" price="1.2万" currency="coin" tone="orange" onPress={noop} />
          <PriceButton verb="购买" price="2,600" currency="tech" disabled onPress={noop} />
          <PriceButton verb="开蛋" price="350" currency="starcoin" size="l" tone="purple" onPress={noop} />
        </div>
      </section>

      <section className="kit-paper"><h2>面板内容</h2>
        <div className="kit-row">
          <Chip icon="coin" label="总加成"><b>+130%</b></Chip>
          <Chip icon="pickaxe"><b>+10%</b></Chip>
          <RarityTag rarity="common" /><RarityTag rarity="rare" /><RarityTag rarity="epic" /><RarityTag rarity="legendary" />
          <span className="ui-stamp">已解锁</span>
          <span className="ui-toast">背包满了，去出售吧</span>
        </div>
        <div className="kit-row">
          <Toggle on={on} label="音乐" onPress={() => setOn(v => !v)} />
          <Toggle on={!on} label="音效" onPress={() => setOn(v => !v)} />
          <div className="kit-bar"><Bar value={2} max={60}>下一层 老矿井 2 / 60 米</Bar></div>
          <div className="kit-bar"><Bar value={1} max={5} tone="gold">金色合成 1/5</Bar></div>
          <div className="ui-seg" role="group"><button aria-pressed="true">全部</button><button aria-pressed="false">金币</button><button aria-pressed="false">科技币</button></div>
        </div>
        <div className="kit-row kit-cells">
          {PETS.map(pet => <button key={pet.id} className="ui-cell" data-rarity={pet.rarity} data-equipped={'equipped' in pet || undefined} aria-pressed={pet.id === 'pebble-guardian'}>
            <span className="ui-cell-name ui-outline">{pet.name}</span>
            <PetArt speciesId={pet.id} rarity={pet.rarity} />
            {'equipped' in pet && <span className="ui-cell-check">✓</span>}
            <span className="ui-cell-stat ui-outline"><Icon kind={pet.icon} className="ui-icon ui-cell-currency" />{pet.bonus}</span>
          </button>)}
          <div className="ui-cell" data-empty />
          <div className="ui-detail kit-detail" data-rarity="legendary">
            <RarityTag rarity="legendary" />
            <PetArt speciesId="pebble-guardian" rarity="legendary" className="kit-detail-art" />
            <h3 className="ui-outline">磐岩熊</h3>
            <div className="ui-stat"><span>金币收入</span><b>+440%</b></div>
            <div className="ui-stat"><span>挖矿速度</span><b>+16%</b></div>
            <UiButton tone="green" onPress={noop}>装备</UiButton>
          </div>
          <div className="ui-card-tile kit-card" style={{ '--c': 'var(--ui-orange)' } as CSSProperties}>
            <EggArt eggId="amber-egg" className="ui-card-art" />
            <h4 className="ui-outline">琥珀蛋</h4><small>第 2 层解锁</small>
            <UiButton size="s" tone="green" onPress={noop}>查看</UiButton>
          </div>
          <div className="ui-card-tile kit-card" data-locked>
            <Icon kind="lock" className="ui-icon ui-card-art" />
            <h4 className="ui-outline">未解锁</h4><small>到达第 3 层</small>
          </div>
        </div>
        <UiButton tone="orange" onPress={() => setSheet(true)}>打开面板示例</UiButton>
      </section>
    </div>
    {sheet && <Sheet title="宠物" subtitle="副标题在标题条下面单独一行" tabs={[{ id: 'pets', label: '宠物', icon: 'paw', badge: '!' }, { id: 'ores', label: '矿物', icon: 'gem' }]} tab={tab} onTab={setTab}
      onClose={() => setSheet(false)} footer={<><span className="ui-hint ui-grow">提示文字用小号墨色</span><UiButton tone="white" onPress={noop}>全部卸下</UiButton><UiButton tone="orange" onPress={noop}>一键最佳</UiButton></>}>
      <div className="ui-row"><Chip icon="paw"><b>已装备 2 / 3</b></Chip><Chip icon="coin"><b>+130%</b></Chip><Chip icon="pickaxe"><b>+10%</b></Chip></div>
      <div className="ui-grid">{PETS.map(pet => <button key={pet.id} className="ui-cell" data-rarity={pet.rarity} data-equipped={'equipped' in pet || undefined}>
        <span className="ui-cell-name ui-outline">{pet.name}</span><PetArt speciesId={pet.id} rarity={pet.rarity} />
        <span className="ui-cell-stat ui-outline"><Icon kind={pet.icon} className="ui-icon ui-cell-currency" />{pet.bonus}</span></button>)}</div>
    </Sheet>}
  </main>;
}
