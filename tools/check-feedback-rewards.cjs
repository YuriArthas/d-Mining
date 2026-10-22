// Public desktop acceptance fragment. The parent owns browser startup, the
// published URL, clipboard permissions, screenshots and isolated save stores.
// Online threshold seeding/advance and debug travel are constructed checks;
// purchases, clipboard operations and auto-hatch elapsed time use the real UI.
const assert = require('node:assert/strict');
const { createInviteCode, parseInviteCode } = require('../src/game/logic/InviteCode.ts');
const { CAPSULE_MACHINE_ZONE } = require('../src/game/content/feedbackFacilities.ts');

module.exports = async function checkFeedbackRewards({ page, snap, travel, frames, screenshot, check, seed, go, base, id, autoOnly = false, claimsOnly = false }) {
  const sourceName = `${id}-reward-source`, receiverName = `${id}-reward-receiver`, autoName = `${id}-reward-auto`;
  const urlFor = name => `${base}?debug=1&submission=fenced&saveTest=store-${name}`;
  const wait = (predicate, argument) => page.waitForFunction(predicate, argument, { timeout: 60000, polling: 250 });
  const progress = () => page.evaluate(() => structuredClone(window.__miningSave.progress()));
  const flush = () => page.evaluate(() => window.__miningSave.flush());
  const rewardsDialog = () => page.getByRole('dialog', { name: '游玩奖励', exact: true });
  const openRewards = async () => {
    await page.locator('.reward-hud button').click();
    await rewardsDialog().waitFor({ state: 'visible' });
  };
  const closeDialog = async () => {
    await page.getByRole('dialog').getByRole('button', { name: /^关闭/ }).click();
    await wait(() => !document.querySelector('[role="dialog"]'));
  };
  const advance = seconds => page.evaluate(seconds => window.__miningValidation.advanceOnline(seconds), seconds);
  const readClipboard = () => page.evaluate(() => navigator.clipboard.readText());
  const onlineWait = async seconds => {
    const target = (await snap()).economy.rewards.onlineSeconds + seconds;
    await wait(target => window.__miningValidation.snapshot().economy.rewards.onlineSeconds >= target, target);
  };
  const resetRewardHistory = (data, inviteId) => {
    assert.ok(data.rewards, 'The published save must include rewards before constructing its fixture');
    Object.assign(data.rewards, {
      balance: 0, onlineSeconds: 0, onlineClaimed: [], lastSigninDay: null,
      signinStreak: 0, lastShareDay: null, redeemedInviteId: null,
      permanent: { mining: false, travel: false, autoHatch: false }, timed: { speed: 0, luck: 0 },
      ...(inviteId ? { inviteId } : {}),
    });
    data.wallet.coins = 0;
    data.inventory.items = {};
    data.exploration.maxDepth = 0;
    data.exploration.unlockedDestinationIds = [];
    if (data.onboarding) data.onboarding.status = 'skipped';
  };

  if (!autoOnly) {
  await seed(sourceName, data => resetRewardHistory(data));
  await go(urlFor(sourceName));
  assert.equal((await snap()).economy.rewards.balance, 0);
  await openRewards();
  assert.equal(await rewardsDialog().locator('.reward-online-card').count(), 4);
  assert.equal(await rewardsDialog().locator('.reward-signin-days > div').count(), 7);
  await rewardsDialog().getByRole('button', { name: /^签到领取 / }).click();
  await wait(() => window.__miningValidation.snapshot().economy.rewards.balance === 1);
  assert.equal(await rewardsDialog().getByRole('button', { name: '今日已签到', exact: true }).isDisabled(), true);
  const signed = (await snap()).economy.rewards;
  assert.equal(signed.lastSigninDay, signed.day);
  assert.equal(signed.signinStreak, 1);

  await advance(300);
  const fiveMinuteCard = rewardsDialog().locator('.reward-online-card').filter({ has: page.getByText('5 分钟', { exact: true }) });
  await fiveMinuteCard.getByRole('button', { name: '领取奖励', exact: true }).click();
  await wait(() => window.__miningValidation.snapshot().economy.rewards.balance === 2);
  assert.equal(await fiveMinuteCard.getByRole('button', { name: '已领取', exact: true }).isDisabled(), true);
  assert.ok((await snap()).economy.rewards.onlineClaimed.includes(5));
  check('Public rewards window: seven-day sign-in grants 1 coin once; constructed 300 online seconds unlock the real five-minute claim button and grant exactly 1 coin');

  await rewardsDialog().getByRole('button', { name: '复制微信分享文案', exact: true }).click();
  await wait(() => document.querySelector('.reward-notice')?.textContent.includes('文案已复制'));
  const wechatText = await readClipboard(), inviter = (await snap()).economy.rewards.inviteId;
  assert.equal(parseInviteCode(wechatText), inviter);
  assert.ok(wechatText.includes(base));
  assert.ok(wechatText.includes('微信'));
  assert.equal((await snap()).economy.rewards.balance, 3);
  await rewardsDialog().getByRole('button', { name: '复制抖音分享文案', exact: true }).click();
  await wait(() => document.querySelector('.reward-notice')?.textContent.includes('今天的分享奖励已经领取'));
  const douyinText = await readClipboard();
  assert.equal(parseInviteCode(douyinText), inviter);
  assert.ok(douyinText.includes('抖音'));
  assert.equal((await snap()).economy.rewards.balance, 3);

  await rewardsDialog().getByLabel('粘贴邀请码或完整分享文案', { exact: true }).fill(createInviteCode(inviter));
  await rewardsDialog().getByRole('button', { name: '兑换 2 枚幸运币', exact: true }).click();
  await wait(() => document.querySelector('.reward-notice')?.textContent.includes('不能兑换自己的邀请码'));
  assert.equal((await snap()).economy.rewards.balance, 3);
  assert.equal((await snap()).economy.rewards.redeemedInviteId, null);
  await screenshot('feedback-rewards-share-and-self-code');
  await flush();
  check('Real clipboard: WeChat and Douyin both copy usable game-link/invite text, share a single daily +1 reward, and self-invite redemption is rejected without granting coins');

  const receiverId = `feedback-receiver-${Date.now().toString(36)}`;
  assert.notEqual(receiverId, inviter);
  await seed(receiverName, data => resetRewardHistory(data, receiverId));
  await go(urlFor(receiverName));
  await openRewards();
  await rewardsDialog().getByLabel('粘贴邀请码或完整分享文案', { exact: true }).fill(wechatText);
  await rewardsDialog().getByRole('button', { name: '兑换 2 枚幸运币', exact: true }).click();
  await wait(() => window.__miningValidation.snapshot().economy.rewards.balance === 2);
  assert.equal((await snap()).economy.rewards.redeemedInviteId, inviter);
  assert.equal(await rewardsDialog().locator('textarea').count(), 0);
  assert.equal(await rewardsDialog().getByText('✓ 邀请奖励已领取', { exact: true }).count(), 1);
  await screenshot('feedback-rewards-invite-redeemed');
  await flush();
  await go(page.url());
  await openRewards();
  assert.equal((await snap()).economy.rewards.balance, 2);
  assert.equal((await snap()).economy.rewards.redeemedInviteId, inviter);
  assert.equal(await rewardsDialog().locator('textarea').count(), 0);
  await screenshot('feedback-rewards-invite-reloaded');
  await flush();
  await go(urlFor(sourceName));
  assert.equal((await snap()).economy.rewards.balance, 3, 'Redeeming someone else\'s code must not credit the inviter');
  await openRewards();
  assert.equal(await rewardsDialog().getByRole('button', { name: '今日已签到', exact: true }).isDisabled(), true);
  assert.equal(await rewardsDialog().locator('.reward-online-card').filter({ has: page.getByText('5 分钟', { exact: true }) }).getByRole('button', { name: '已领取', exact: true }).isDisabled(), true);
  assert.equal((await snap()).economy.rewards.lastShareDay, (await snap()).economy.rewards.day);
  await closeDialog();
  check('Actual copied invite text grants only the other save +2 once; reload keeps redemption consumed, and the original sharer remains at 3 coins with daily claims still consumed');

  const machine = CAPSULE_MACHINE_ZONE;
  await travel([machine.x, machine.y, machine.z]);
  await wait(() => window.__miningValidation.snapshot().economy.atMachine === true);
  await page.locator('.scene').focus();
  await page.keyboard.press('e');
  await page.getByRole('dialog', { name: '幸运扭蛋机', exact: true }).waitFor({ state: 'visible' });
  assert.equal(await page.locator('.capsule-reward-card').count(), 6);
  const displayedWeights = await page.locator('.capsule-reward-top strong').allTextContents();
  assert.deepEqual(displayedWeights, ['65%', '10%', '5%', '5%', '5%', '10%']);
  const beforeSpin = (await snap()).economy;
  await page.locator('.capsule-spin-button').click();
  await wait(balance => window.__miningValidation.snapshot().economy.rewards.balance === balance - 1, beforeSpin.rewards.balance);
  const afterSpin = (await snap()).economy;
  assert.match(await page.locator('.capsule-result').innerText(), /获得|已拥有/);
  const coinDelta = afterSpin.coins - beforeSpin.coins;
  const newPermanent = Object.keys(afterSpin.rewards.permanent).filter(key => afterSpin.rewards.permanent[key] && !beforeSpin.rewards.permanent[key]);
  const newTimed = Object.keys(afterSpin.rewards.timed).filter(key => afterSpin.rewards.timed[key] > beforeSpin.rewards.timed[key]);
  assert.ok(coinDelta === 0 || coinDelta === beforeSpin.capsuleCoins, 'Capsule coins must use the displayed historical-depth reward');
  assert.equal(Number(coinDelta > 0) + newPermanent.length + newTimed.length, 1, 'A single spin must award exactly one result');
  await screenshot('feedback-capsule-real-result');
  await flush();
  const savedAfterSpin = await progress();
  await go(page.url());
  const restoredSpin = (await snap()).economy;
  assert.equal(restoredSpin.coins, savedAfterSpin.wallet.coins);
  assert.equal(restoredSpin.rewards.balance, savedAfterSpin.rewards.balance);
  assert.deepEqual(restoredSpin.rewards.permanent, savedAfterSpin.rewards.permanent);
  if (restoredSpin.rewards.day === savedAfterSpin.rewards.day) {
    const onlineDelta = restoredSpin.rewards.onlineSeconds - savedAfterSpin.rewards.onlineSeconds;
    for (const key of ['speed', 'luck']) assert.ok(Math.abs(restoredSpin.rewards.timed[key] - Math.max(0, savedAfterSpin.rewards.timed[key] - onlineDelta)) < 0.01, `${key} expiry must follow online elapsed time rather than reload wall time`);
  }
  check(`Public capsule UI shows all probabilities; one real random spin spends 1 coin and grants one actual result (${coinDelta > 0 ? `${coinDelta} coins` : [...newPermanent, ...newTimed].join(', ')}); coins, rights and online-only timers persist after reload`);
  }
  if (claimsOnly) return;

  await seed(autoName, data => {
    resetRewardHistory(data);
    data.wallet.coins = 8000;
    data.rewards.permanent.autoHatch = true;
  });
  await go(urlFor(autoName));
  const label = (await snap()).eggLabels.labels.find(label => label.eggId === 'meadow-egg');
  assert.ok(label, 'Public meadow egg station is present');
  await travel([label.x - 2, label.y, label.z]);
  await wait(() => window.__miningValidation.snapshot().economy.eggId === 'meadow-egg');
  await wait(() => document.querySelector('.egg-world-prompt')?.style.visibility === 'visible');
  const openEgg = async () => {
    await page.bringToFront();
    await page.locator('.scene').focus();
    await page.keyboard.press('e');
    await page.locator('.pet-egg-panel').waitFor({ state: 'visible' });
  };
  await openEgg();
  assert.equal(await page.locator('.egg-probability').count(), 5);
  const price = (await snap()).pets.eggs.find(egg => egg.id === 'meadow-egg').price;
  const startAuto = async () => {
    const before = await snap();
    await page.getByRole('button', { name: '开始自动孵蛋', exact: true }).click();
    await wait(count => window.__miningValidation.snapshot().pets.pets.length > count, before.pets.pets.length);
    const after = await snap();
    assert.equal(before.economy.coins - after.economy.coins, (after.pets.pets.length - before.pets.pets.length) * price);
    assert.equal(after.economy.autoHatch, 'meadow-egg');
    return after;
  };
  await startAuto();
  await screenshot('feedback-auto-hatch-running');
  await closeDialog();
  await wait(() => window.__miningValidation.snapshot().economy.autoHatch === null);
  const stopped = await snap();
  await onlineWait(3);
  assert.equal((await snap()).economy.coins, stopped.economy.coins);
  assert.equal((await snap()).pets.pets.length, stopped.pets.pets.length);
  check('Seeded auto-hatch entitlement: E opens the actual egg window, real elapsed frames buy pets at the displayed price, and closing the window stops further purchases across another three online seconds');

  await openEgg();
  await startAuto();
  // Headless Chromium keeps every page focused. Run this real focus check with
  // FEEDBACK_HEADFUL=1 under Xvfb, with Playwright focus emulation disabled.
  const focusSession = await page.context().newCDPSession(page);
  await focusSession.send('Emulation.setFocusEmulationEnabled', { enabled: false });
  let otherPage;
  try {
    otherPage = await page.context().newPage();
    await otherPage.goto('about:blank');
    await otherPage.bringToFront();
    await wait(() => !document.hasFocus() && window.__miningValidation.snapshot().economy.autoHatch === null);
  } finally {
    if (otherPage) await otherPage.close();
    await page.bringToFront();
    await focusSession.detach();
  }
  const blurred = await snap();
  await onlineWait(3);
  assert.equal((await snap()).economy.autoHatch, null);
  assert.equal((await snap()).economy.coins, blurred.economy.coins);
  assert.equal((await snap()).pets.pets.length, blurred.pets.pets.length);
  assert.equal(await page.getByRole('button', { name: '开始自动孵蛋', exact: true }).count(), 1);
  await frames();
  await screenshot('feedback-auto-hatch-blur-stopped');
  await closeDialog();
  await flush();
  check('Real tab focus loss stops auto-hatch; returning to the game leaves it stopped, with no extra pet or coin change during three more online seconds');
};
