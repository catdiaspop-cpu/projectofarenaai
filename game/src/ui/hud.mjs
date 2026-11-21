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

    `;
    this.el = {
      // кнопки теперь в Sticks, здесь только чтение
      clock: this.root.querySelector('[data-clock]'),
      phase: this.root.querySelector('[data-phase]'),
      roomName: this.root.querySelector('[data-room-name]'),
      roomSub: this.root.querySelector('[data-room-sub]'),
      toast: this.root.querySelector('[data-toast]'),
      scales: {},
    };
    for (const s of ['fear', 'sleep', 'hunger', 'bladder']) {
      this.el.scales[s] = this.root.querySelector(`[data-scale="${s}"] i`);
    }
  }

  /**
   * Шкала: полоска и подпись ПОД ней.
   * Раньше справа стояла одна буква («С», «С», «Т» — две одинаковые), и по
   * ней нельзя было понять, что кончается. Подпись мелкая, но читаемая.
   */
  scaleRow(key, label, color) {
    return `
      <div class="hud-scale" data-scale="${key}" title="${label}">
        <i style="--c:${color}"></i><span>${label}</span>
      </div>`;
  }

  bind() {
    // В HUD осталась одна кнопка — меню. Остальное живёт в Sticks.
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act="menu"]');
      if (!btn) return;
      this.onAction?.('menu');
    });
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
    }
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
