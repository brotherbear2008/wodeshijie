/* 我的世界 · economy：金币、复活石、会员（模拟 ¥1/月）、广告、复活规则、装备 */
(function () {
  'use strict';
  const MW = window.MW;
  const $ = MW.$;
  const E = (MW.eco = {});
  const DAY = 24 * 3600 * 1000;

  E.isVip = () => (MW.save.vipUntil || 0) > Date.now();
  E.vipDaysLeft = () => Math.max(0, Math.ceil(((MW.save.vipUntil || 0) - Date.now()) / DAY));

  E.refreshWallet = () => {
    const cn = $('#coinNum'), rn = $('#reviveNum');
    if (cn) cn.textContent = MW.save.coins;
    if (rn) rn.textContent = MW.save.revives;
    const vb = $('#vipBtn'), vl = $('#vipLabel');
    if (vb && vl) {
      const vip = E.isVip();
      vb.classList.toggle('is-vip', vip);
      vl.textContent = vip ? `会员 · 剩 ${E.vipDaysLeft()} 天` : '会员 ¥1/月';
    }
  };
  function bump(sel) {
    const el = $(sel);
    if (!el) return;
    const pill = el.closest('.pill');
    pill.classList.remove('bump');
    void pill.offsetWidth;
    pill.classList.add('bump');
  }
  E.addCoins = (n) => {
    MW.save.coins = Math.max(0, MW.save.coins + Math.round(n));
    MW.persist();
    E.refreshWallet();
    if (n > 0) bump('#coinNum');
  };
  E.addRevive = (n) => {
    MW.save.revives = Math.max(0, MW.save.revives + n);
    MW.persist();
    E.refreshWallet();
    if (n > 0) bump('#reviveNum');
  };
  MW.on('save', E.refreshWallet);

  // ---------- 装备 ----------
  E.equippedIds = (spec) => {
    const map = MW.save.equipped || (MW.save.equipped = {});
    let ids = map[spec.id];
    if (!Array.isArray(ids)) {
      ids = spec.equipment.filter((e) => e.price === 'free').slice(0, 3).map((e) => e.id);
      map[spec.id] = ids;
    }
    return ids.filter((id) => spec.equipment.some((e) => e.id === id));
  };
  // 真正生效的装备：会员专属的只有会员能用
  E.activeEquip = (spec) => {
    const ids = E.equippedIds(spec);
    return spec.equipment.filter((e) => ids.includes(e.id) && (e.price === 'free' || E.isVip()));
  };
  E.toggleEquip = (spec, id, after) => {
    const it = spec.equipment.find((e) => e.id === id);
    if (!it) return;
    if (it.price === 'vip' && !E.isVip()) {
      E.openVip((ok) => { if (ok) E.toggleEquip(spec, id, after); else if (after) after(); });
      return;
    }
    const ids = E.equippedIds(spec).slice();
    const i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1);
    else {
      if (ids.length >= 3) { MW.toast('最多同时装备 3 件，先卸下一件吧'); return; }
      ids.push(id);
      MW.toast(`装备上了 ${it.icon} ${it.name}`);
    }
    MW.save.equipped[spec.id] = ids;
    MW.persist();
    MW.sfx('click');
    MW.emit('equip');
    if (after) after();
  };
  E.equipRowHtml = (spec, e, ids) => {
    const on = ids.includes(e.id);
    const locked = e.price === 'vip' && !E.isVip();
    const btn = locked
      ? `<button class="btn btn-vip" type="button" data-eq="${e.id}">🔒 会员可用</button>`
      : `<button class="btn ${on ? 'btn-primary' : ''}" type="button" data-eq="${e.id}">${on ? '已装备' : '装备'}</button>`;
    return `<div class="eq${on && !locked ? ' on' : ''}"><div class="ico">${MW.esc(e.icon)}</div><div><b>${MW.esc(e.name)}</b><span class="price ${e.price === 'vip' ? 'price-vip' : 'price-free'}">${e.price === 'vip' ? '会员' : '免费'}</span><p>${MW.esc(e.desc)}</p></div>${btn}</div>`;
  };

  // 背包 + 小商店（游戏里随时打开）
  E.openBag = (spec, onClose) => {
    if (!spec) return;
    const render = () => {
      const ids = E.equippedIds(spec);
      const html = `
        <div class="bag-sec"><h4>这个世界的装备（最多装 3 件）</h4>${spec.equipment.map((e) => E.equipRowHtml(spec, e, ids)).join('')}</div>
        <div class="bag-sec"><h4>用金币买道具</h4>
          <div class="shop-row"><div class="ico">💎</div><div><b>复活石</b><p>被打倒、答错题时直接复活，不用看广告</p></div><button class="btn" type="button" data-buy="revive">🪙 100</button></div>
          ${spec.mode === 'math' ? '<div class="shop-row"><div class="ico">💡</div><div><b>提示灯泡</b><p>数独卡住时帮你填一个格子</p></div><button class="btn" type="button" data-buy="hint">🪙 30</button></div>' : ''}
        </div>
        <p class="rule-note">你现在有 🪙 ${MW.save.coins} 金币、💎 ${MW.save.revives} 个复活石${spec.mode === 'math' ? `、💡 ${MW.save.hints} 个灯泡` : ''}。金币靠打怪、闯关、收集得来，不用花钱。</p>`;
      MW.ui.dialog({ title: '🎒 装备和道具', html, buttons: [{ label: '好了', kind: 'primary', onClick: () => onClose && onClose() }], keep: true });
      MW.$$('#dlgBody [data-eq]').forEach((b) => b.addEventListener('click', () => E.toggleEquip(spec, b.dataset.eq, render)));
      MW.$$('#dlgBody [data-buy]').forEach((b) => b.addEventListener('click', () => {
        const what = b.dataset.buy, price = what === 'revive' ? 100 : 30;
        if (MW.save.coins < price) { MW.toast('金币不够哦，去打怪、闯关赚金币吧', 'bad'); MW.sfx('wrong'); return; }
        MW.save.coins -= price;
        if (what === 'revive') MW.save.revives++; else MW.save.hints++;
        MW.persist();
        E.refreshWallet();
        MW.sfx('coin');
        MW.toast(what === 'revive' ? '买到 1 个复活石 💎' : '买到 1 个提示灯泡 💡', 'gold');
        render();
        MW.emit('equip');
      }));
    };
    render();
  };

  // ---------- 会员（演示版：只是模拟付款） ----------
  E.openVip = (after) => {
    const vip = E.isVip();
    const html = `
      <div class="vip-price">¥1<small>/ 月</small></div>
      <ul class="vip-list">
        <li><i>📺</i><span>跳过所有广告：答错题、被打倒都不用等</span></li>
        <li><i>💥</i><span>死了也能免广告直接复活</span></li>
        <li><i>🗡️</i><span>可以用任何装备，包括会员专属装备</span></li>
      </ul>
      ${vip ? `<p>你已经是会员啦，还剩 <b>${E.vipDaysLeft()}</b> 天。</p>` : ''}
      <p class="rule-note">现在是演示版：点“开通”只是模拟付款，不会扣真钱。正式上线需要接入真正的支付，并且要家长同意。</p>`;
    MW.ui.dialog({
      title: '👑 我的世界 · 会员',
      cls: 'gold',
      html,
      buttons: [
        { label: vip ? '再续一个月（模拟）' : '开通会员 ¥1/月（模拟）', kind: 'vip', onClick: () => confirmVip(after) },
        { label: '先不用', kind: 'quiet', onClick: () => after && after(false) },
      ],
    });
  };
  function confirmVip(after) {
    MW.ui.dialog({
      title: '确认开通？',
      cls: 'gold',
      html: '<p>这是<b>模拟付款</b>，不会真的花钱。开通后 30 天内跳过所有广告、所有装备都能用。</p>',
      buttons: [
        {
          label: '确认开通（模拟 ¥1）', kind: 'vip', onClick: () => {
            MW.save.vipUntil = Math.max(Date.now(), MW.save.vipUntil || 0) + 30 * DAY;
            MW.persist();
            E.refreshWallet();
            MW.sfx('win');
            MW.toast('👑 开通成功！30 天内不用看广告啦', 'gold');
            MW.emit('equip');
            if (after) after(true);
          },
        },
        { label: '再想想', kind: 'quiet', onClick: () => after && after(false) },
      ],
    });
  }

  // ---------- 广告（模拟广告，20~30 秒） ----------
  const ADS = [
    { art: '🦖', title: '恐龙牌牙膏', text: '刷牙像打怪，一刷就亮闪闪！（这是游戏里编的广告）' },
    { art: '🍦', title: '星际冰淇淋', text: '在太空里也不会化，一口一个小星球。' },
    { art: '🧦', title: '会唱歌的袜子', text: '每走一步就唱一句，上学路上不无聊。' },
    { art: '🍉', title: '全息西瓜', text: '看得见、摸不着，零卡路里，吃一万个也不胖。' },
    { art: '🐍', title: '试试「贪吃蛇乐园」', text: '跟设计师说“好多好多贪吃蛇”，30 条蛇陪你一起玩！' },
    { art: '🔢', title: '数独天空城', text: '每闯一关送一颗金星，越玩越聪明。' },
    { art: '🚀', title: '纸箱火箭', text: '只要想象力够大，纸箱也能飞上天。' },
  ];
  let adTimer = 0;
  E.showAd = (onDone) => {
    const s = MW.save.settings;
    const total = MW.randi(Math.min(s.adMin, s.adMax), Math.max(s.adMin, s.adMax));
    const ad = MW.pick(ADS);
    $('#adArt').textContent = ad.art;
    $('#adTitle').textContent = ad.title;
    $('#adText').textContent = ad.text;
    const close = $('#adClose'), ring = $('#adRing'), sec = $('#adSec'), bar = $('#adBar');
    const C = 2 * Math.PI * 23;
    ring.style.strokeDasharray = String(C);
    $('#ad').hidden = false;
    MW.music.duck(true);
    const t0 = performance.now();
    let finished = false;
    const end = () => {
      if (finished) return;
      finished = true;
      clearInterval(adTimer);
      $('#ad').hidden = true;
      MW.music.duck(false);
      onDone && onDone();
    };
    const tick = () => {
      const el = (performance.now() - t0) / 1000;
      const left = Math.max(0, Math.ceil(total - el));
      sec.textContent = left;
      ring.style.strokeDashoffset = String(C * Math.min(1, el / total));
      bar.style.width = Math.min(100, (el / total) * 100) + '%';
      if (left <= 0) {
        clearInterval(adTimer);
        close.disabled = false;
        close.textContent = '✕ 关闭广告，继续';
        sec.textContent = '✓';
      } else {
        close.disabled = true;
        close.textContent = `还要等 ${left} 秒`;
      }
    };
    clearInterval(adTimer);
    adTimer = setInterval(tick, 200);
    tick();
    close.onclick = () => { if (!close.disabled) { MW.sfx('click'); end(); } };
    $('#adVip').onclick = () => {
      $('#ad').hidden = true;
      E.openVip((ok) => {
        if (ok) end();
        else if (!finished) $('#ad').hidden = false;
      });
    };
  };

  // ---------- 失败了怎么办：统一的复活规则 ----------
  // 有复活石 → 自动复活；会员 → 跳过广告；都没有 → 看 20~30 秒广告
  E.fail = (o) => {
    MW.game.paused = true;
    MW.music.duck(true);
    const verb = o.verb || '复活';
    const vip = E.isVip();
    const n = MW.save.revives;
    const done = () => {
      MW.game.paused = false;
      MW.music.duck(false);
      o.onContinue && o.onContinue();
    };
    const buttons = [];
    if (vip) {
      buttons.push({ label: `👑 会员免广告，直接${verb}`, kind: 'vip', onClick: () => { MW.sfx('revive'); done(); } });
    } else if (n > 0) {
      buttons.push({ label: `💎 用复活石${verb}（还有 ${n} 个）`, kind: 'primary', countdown: 4, onClick: () => { E.addRevive(-1); MW.sfx('revive'); MW.toast(`用掉 1 个复活石，还剩 ${MW.save.revives} 个`); done(); } });
      buttons.push({ label: `📺 不用复活石，看广告${verb}`, onClick: () => E.showAd(done) });
    } else {
      buttons.push({ label: `📺 看广告${verb}（${MW.save.settings.adMin}~${MW.save.settings.adMax} 秒）`, kind: 'primary', onClick: () => E.showAd(done) });
    }
    if (!vip) buttons.push({ label: '👑 ¥1 开通会员，以后都不看广告', kind: 'vip', onClick: () => E.openVip((ok) => { if (ok) { MW.sfx('revive'); done(); } else E.fail(o); }) });
    buttons.push({ label: o.quitLabel || '🏠 不玩了', kind: 'quiet', onClick: () => { MW.game.paused = false; MW.music.duck(false); o.onQuit && o.onQuit(); } });
    MW.ui.dialog({
      title: o.title,
      html: `<p>${o.msg || ''}</p><p class="rule-note">规则：有复活石就能直接${verb}；没有的话要看 ${MW.save.settings.adMin}~${MW.save.settings.adMax} 秒广告；会员（¥1/月）可以跳过所有广告。</p>`,
      buttons,
    });
  };
})();
