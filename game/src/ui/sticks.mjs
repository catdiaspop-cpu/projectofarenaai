// Управление: один стик и свайп.
//
// Что изменилось и почему:
//   * правого стика больше нет. Камера — СВАЙП по правой половине экрана:
//     палец ведёт, камера поворачивается на величину сдвига. Это точнее стика:
//     стик нужно «держать», а свайп заканчивается вместе с движением пальца.
//   * кнопки больше не висят поверх игры постоянно. Они появляются при касании
//     в нижней части экрана и уходят через 2.5 с бездействия. Панель узкая
//     (48 px), в один столбик у правого края — под большой палец, а не
//     «на пол экрана».
//   * «действие» — крупнее остальных и появляется только когда рядом что-то
//     есть (дверь, предмет). Нет смысла держать кнопку, которая ничего не делает.
//
// Зона левого стика — левая нижняя половина, зона свайпа — правая нижняя
// половина. Верхняя половина экрана остаётся для HUD и будущих предметов.

import { Stick } from '../core/joystick.mjs';

const SWIPE = {
  sensitivity: 0.0042,     // рад на пиксель: 240 px через экран ≈ 1 рад
  maxPerMove: 0.28,        // чтобы резкий рывок не «телепортировал» камеру
  pitchLimit: [-0.95, 0.85],
  tapMaxDist: 12,          // меньше — это тап, а не свайп
  tapMaxMs: 220,
};

const BUTTONS = [
  { act: 'torch', label: 'фонарь' },
  { act: 'crouch', label: 'присесть' },
  { act: 'listen', label: 'слушать' },
  { act: 'use', label: 'действие', main: true },
  { act: 'map', label: 'карта' },
];

export class Sticks {
  constructor(root, { onButton, onTap } = {}) {
    this.root = root;
    this.onButton = onButton;
    this.onTap = onTap;
    this.move = new Stick();
    this.look = { dx: 0, dy: 0, dragging: false, id: null, x0: 0, y0: 0, moved: 0, t0: 0 };
    this.sprint = false;
    this.crouch = false;
    this.torch = false;
    this.idleTimer = 0;
    this.buttonsVisible = false;

    // Камера свайпом — по ВСЕМУ экрану, кроме нижнего левого угла под стик.
    // Раньше свайп работал только по правой половине, и повернуть взгляд,
    // не отпуская стик, было нельзя. Правая половина уходит вперёд по слоям.
    root.innerHTML = `
      <div class="stick-zone stick-zone-left" data-zone="move"></div>
      <div class="look-zone" data-zone="look"></div>
      <div class="stick stick-move" data-stick="move">
        <div class="stick-base"></div>
        <div class="stick-knob"></div>
      </div>
      <div class="action-buttons" data-buttons>
        ${BUTTONS.map((b) => `
          <button class="act${b.main ? ' act-main' : ''}" data-act="${b.act}" aria-label="${b.label}">
            <span>${b.label}</span>
          </button>`).join('')}
      </div>
    `;

    this.el = {
      moveStick: root.querySelector('[data-stick="move"]'),
      moveKnob: root.querySelector('[data-stick="move"] .stick-knob'),
      buttons: root.querySelector('[data-buttons]'),
    };

    this.bindMove();
    this.bindLook();
    this.bindButtons();
  }

  // ─────────────────────────── движение ───────────────────────────

  bindMove() {
    const zone = this.root.querySelector('[data-zone="move"]');
    const stick = this.move;

    zone.addEventListener('pointerdown', (e) => {
      if (stick.active) return;
      zone.setPointerCapture?.(e.pointerId);
      const rect = this.root.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      stick.down(e.pointerId, x, y);
      this.el.moveStick.classList.add('active');
      this.el.moveStick.style.left = `${x}px`;
      this.el.moveStick.style.top = `${y}px`;
      this.el.moveKnob.style.transform = 'translate(-50%, -50%)';
      this.wake();
      e.preventDefault();
    }, { passive: false });

    zone.addEventListener('pointermove', (e) => {
      if (!stick.active || stick.id !== e.pointerId) return;
      const rect = this.root.getBoundingClientRect();
      stick.move(e.pointerId, e.clientX - rect.left, e.clientY - rect.top);
      this.el.moveStick.style.left = `${stick.base.x}px`;
      this.el.moveStick.style.top = `${stick.base.y}px`;
      this.el.moveKnob.style.transform =
        `translate(calc(-50% + ${stick.knob.x}px), calc(-50% + ${stick.knob.y}px))`;
      this.wake();
      e.preventDefault();
    }, { passive: false });

    const end = (e) => {
      if (!stick.active || stick.id !== e.pointerId) return;
      stick.up(e.pointerId);
      this.el.moveStick.classList.remove('active');
      this.el.moveKnob.style.transform = 'translate(-50%, -50%)';
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('pointerleave', end);
  }

  // ─────────────────────────── камера свайпом ───────────────────────────

  bindLook() {
    const zone = this.root.querySelector('[data-zone="look"]');
    const L = this.look;

    zone.addEventListener('pointerdown', (e) => {
      if (L.dragging) return;
      zone.setPointerCapture?.(e.pointerId);
      const rect = this.root.getBoundingClientRect();
      L.dragging = true;
      L.id = e.pointerId;
      L.x0 = e.clientX - rect.left;
      L.y0 = e.clientY - rect.top;
      L.x = L.x0;
      L.y = L.y0;
      L.moved = 0;
      L.t0 = performance.now();
      this.wake();
      e.preventDefault();
    }, { passive: false });

    zone.addEventListener('pointermove', (e) => {
      if (!L.dragging || L.id !== e.pointerId) return;
      const rect = this.root.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      let dx = x - L.x;
      let dy = y - L.y;
      L.moved += Math.hypot(x - L.x, y - L.y);
      L.x = x;
      L.y = y;

      // ограничение на один кадр: резкий рывок не должен «телепортировать»
      const cap = SWIPE.maxPerMove;
      dx = Math.max(-cap / SWIPE.sensitivity, Math.min(cap / SWIPE.sensitivity, dx));
      dy = Math.max(-cap / SWIPE.sensitivity, Math.min(cap / SWIPE.sensitivity, dy));

      L.dx += dx * SWIPE.sensitivity;
      L.dy += dy * SWIPE.sensitivity;
      this.wake();
      e.preventDefault();
    }, { passive: false });

    const end = (e) => {
      if (!L.dragging || L.id !== e.pointerId) return;
      const dt = performance.now() - L.t0;
      // короткое касание без сдвига — это тап: «слушать»
      if (L.moved < SWIPE.tapMaxDist && dt < SWIPE.tapMaxMs) this.onTap?.();
      L.dragging = false;
      L.id = null;
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('pointerleave', end);
  }

  // ─────────────────────────── кнопки ───────────────────────────

  bindButtons() {
    this.el.buttons.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      this.onButton?.(b.dataset.act);
      this.wake();
    });
  }

  /** Показать кнопки и продлить их жизнь. */
  wake() {
    this.idleTimer = 2.5;
    if (!this.buttonsVisible) {
      this.buttonsVisible = true;
      this.el.buttons.classList.add('visible');
    }
  }

  hideButtons() {
    this.buttonsVisible = false;
    this.el.buttons.classList.remove('visible');
  }

  /** Вызвать из кадра: гасит кнопки по бездействию и сбрасывает свайп в поворот. */
  update(dt) {
    this.move.update(dt);

    if (this.buttonsVisible) {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0 && !this.look.dragging && !this.move.active) this.hideButtons();
    }

    this.el.moveKnob.style.transform =
      `translate(calc(-50% + ${this.move.knob.x}px), calc(-50% + ${this.move.knob.y}px))`;
  }

  /** Снять накопленный поворот камеры: забирает Scene3D каждый кадр. */
  takeLook() {
    const d = { yaw: this.look.dx, pitch: this.look.dy };
    this.look.dx = 0;
    this.look.dy = 0;
    return d;
  }

  /**
   * Кнопка «действие»: показывать только когда рядом есть что делать.
   * @param {'door'|'item'|null} what
   */
  setAction(what) {
    const btn = this.root.querySelector('[data-act="use"]');
    if (!btn) return;
    btn.classList.toggle('near-door', what === 'door');
    btn.classList.toggle('ready', what === 'item');
    if (what) this.wake();
  }

  reset() {
    this.move.up();
    this.look.dragging = false;
    this.look.dx = 0;
    this.look.dy = 0;
    this.el.moveStick.classList.remove('active');
    this.el.moveKnob.style.transform = 'translate(-50%, -50%)';
    this.el.moveStick.style.left = '';
    this.el.moveStick.style.top = '';
  }

  read() {
    return {
      move: { x: this.move.value.x, y: this.move.value.y, mag: Math.hypot(this.move.value.x, this.move.value.y) },
      dragging: this.look.dragging,
      sprint: this.sprint,
      crouch: this.crouch,
      torch: this.torch,
    };
  }

  setCrouch(on) {
    this.crouch = on;
    this.root.querySelector('[data-act="crouch"]')?.classList.toggle('on', on);
  }

  setTorch(on) {
    this.torch = on;
    this.root.querySelector('[data-act="torch"]')?.classList.toggle('on', on);
  }

  toggleClass(act, cls) {
    const b = this.root.querySelector(`[data-act="${act}"]`);
    if (b) b.classList.toggle(cls, !b.classList.contains(cls));
  }
}

export { SWIPE, BUTTONS };
