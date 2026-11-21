// HUD: только то, что нужно пальцу и глазу.
//
// Правила интерфейса (из гейм-дизайна):
//   * всё важное — в нижней трети экрана, под большой палец
//   * шкалы тонкие и сверху: они для чтения, не для нажатия
//   * ни одного модального окна в первые 3 минуты
//   * текст короткий, детский, без терминов

import { POINTS, HEIGHTS } from '../data/house.mjs';
import { PROPS } from '../world/props.mjs';

const fmt = (n) => String(Math.round(n)).padStart(3, ' ');

export class Hud {
  constructor(root, { onAction, onRoom, onPause } = {}) {
    this.root = root;
    this.onAction = onAction;
    this.onRoom = onRoom;
    this.onPause = onPause;
    this.torchOn = false;
    this.hintTimer = 0;
    this.build();
    this.bind();
  }

  build() {
    this.root.innerHTML = `
      <header class="hud-top" role="status" aria-live="polite">
        <div class="hud-clock">
          <span data-clock>21:00</span>
          <small data-phase>ночь</small>
        </div>
        <div class="hud-scales">
          ${this.scaleRow('fear', 'страх', '#e0705a')}
          ${this.scaleRow('sleep', 'сон', '#7f9ec4')}
          ${this.scaleRow('hunger', 'сытость', '#c9a15e')}
          ${this.scaleRow('bladder', 'туалет', '#8fb98a')}
        </div>
        <button class="hud-menu" data-act="menu" aria-label="Меню">☰</button>
      </header>

      <div class="hud-room">
        <h1 data-room-name>Детская</h1>
        <p data-room-sub>тут ты спишь. и не спишь.</p>
      </div>

      <div class="hud-toast" data-toast hidden></div>

      <footer class="hud-bottom">
        <div class="hud-bar" data-bar></div>
        <div class="hud-buttons">
          <button class="hud-btn" data-act="look" aria-label="Осмотреться">
            <span class="glyph">◎</span><span class="label">осмотреться</span>
          </button>
          <button class="hud-btn hud-btn-main" data-act="go" aria-label="Идти">
            <span class="glyph">▸</span><span class="label">идти</span>
          </button>
          <button class="hud-btn" data-act="torch" aria-label="Фонарь">
            <span class="glyph">▮</span><span class="label">фонарь</span>
          </button>
        </div>
        <div class="hud-under">
          <button class="hud-mini" data-act="listen">держать — слушать</button>
          <button class="hud-mini" data-act="hide">присесть</button>
        </div>
      </footer>
    `;
    this.el = {
      clock: this.root.querySelector('[data-clock]'),
      phase: this.root.querySelector('[data-phase]'),
      roomName: this.root.querySelector('[data-room-name]'),
      roomSub: this.root.querySelector('[data-room-sub]'),
      bar: this.root.querySelector('[data-bar]'),
      toast: this.root.querySelector('[data-toast]'),
      scales: {},
    };
    for (const s of ['fear', 'sleep', 'hunger', 'bladder']) {
      this.el.scales[s] = this.root.querySelector(`[data-scale="${s}"] i`);
    }
  }

  scaleRow(key, label, color) {
    return `
      <div class="hud-scale" data-scale="${key}" title="${label}">
        <i style="--c:${color}"></i><span>${label[0].toUpperCase()}</span>
      </div>`;
  }

  bind() {
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'menu') { this.onPause?.(); return; }
      if (act === 'torch') {
        this.torchOn = !this.torchOn;
        btn.classList.toggle('on', this.torchOn);
        this.onAction?.('torch', this.torchOn);
        return;
      }
      this.onAction?.(act);
    });

    // «держать — слушать»
    const listen = this.root.querySelector('[data-act="listen"]');
    const start = (e) => { e.preventDefault(); listen.classList.add('on'); this.onAction?.('listenStart'); };
    const end = () => { listen.classList.remove('on'); this.onAction?.('listenEnd'); };
    listen.addEventListener('pointerdown', start);
    listen.addEventListener('pointerup', end);
    listen.addEventListener('pointercancel', end);
    listen.addEventListener('pointerleave', end);
  }

  update(world) {
    this.el.clock.textContent = world.clockText;
    this.el.phase.textContent = { day: 'день', dusk: 'вечер', night: 'ночь', morning: 'утро' }[world.phase] ?? 'ночь';
    const room = world.roomData;
    this.el.roomName.textContent = room.name;
    this.el.roomSub.textContent = subtitleFor(room.kind);
    for (const [k, bar] of Object.entries(this.el.scales)) {
      const v = world.scales[k] ?? 0;
      bar.style.setProperty('--v', `${Math.max(0, Math.min(100, v))}%`);
      bar.parentElement.classList.toggle('danger', v > 78);
    }
    if (this.lastRoom !== world.room) {
      this.lastRoom = world.room;
      this.renderBar(world);
    }
  }

  /** Полоса предметов комнаты: что можно взять и с чем взаимодействовать. */
  renderBar(world) {
    const lay = world.lay;
    const room = world.roomData;
    const pills = [];
    for (const it of lay.items) {
      const prop = PROPS[it.prop];
      const fns = prop.interact ?? [];
      const label = prop.name ?? it.prop;
      pills.push(`<button class="pill" data-item="${it.id}">${label}</button>`);
    }
    for (const it of lay.clutter) {
      pills.push(`<button class="pill pill-clutter" data-item="${it.id}" data-home="${it.home}">${PROPS[it.prop].name ?? it.prop}</button>`);
    }
    this.el.bar.innerHTML = pills.join('');
    this.el.bar.onclick = (e) => {
      const b = e.target.closest('[data-item]');
      if (!b) return;
      this.onAction?.('item', b.dataset.item, b);
    };
  }

  toast(text, ms = 2200) {
    const t = this.el.toast;
    t.textContent = text;
    t.hidden = false;
    t.classList.remove('out');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => { t.hidden = true; }, 240);
    }, ms);
  }

  setHint(text) {
    this.el.roomSub.textContent = text;
  }
}

function subtitleFor(kind) {
  return {
    child: 'тут ты спишь. и не спишь.',
    parents: 'большая кровать. сюда нельзя.',
    bath: 'тут есть зеркало.',
    corridor: 'четыре двери. одна скрипит.',
    stairs: 'вторая ступень снизу.',
    hall: 'дверь на улицу. пока закрыта.',
    living: 'часы тикают. телевизор мёртв.',
    kitchen: 'холодильник гудит.',
    pantry: 'тут темно.',
    attic: 'тут пахнет старым.',
    basement: 'кто-то оставил свет.',
    yard: 'двор.',
  }[kind] ?? '';
}
