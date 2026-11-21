// Экранные стики и кнопки действий.
//
// Реализация: DOM-элементы с transform, а не canvas. Причины:
//   * не перерисовывается каждый кадр (0 работы GPU);
//   * работает поверх и 2D-карты, и 3D-сцены;
//   * масштабируется системным DPI бесплатно;
//   * касания не конфликтуют с canvas сцены.
//
// Зона захвата стика — вся нижняя половина экрана слева/справа,
// поэтому палец не обязан попадать точно в кружок.

import { Stick } from '../core/joystick.mjs';

export class Sticks {
  constructor(root, { onButton } = {}) {
    this.root = root;
    this.onButton = onButton;
    this.move = new Stick();
    this.look = new Stick();
    this.sprint = false;

    root.innerHTML = `
      <div class="stick-zone stick-zone-left" data-zone="move">
        <div class="stick" data-stick="move">
          <div class="stick-base"></div>
          <div class="stick-knob"></div>
          <div class="stick-label">идти</div>
        </div>
      </div>
      <div class="stick-zone stick-zone-right" data-zone="look">
        <div class="stick" data-stick="look">
          <div class="stick-base"></div>
          <div class="stick-knob"></div>
          <div class="stick-label">смотреть</div>
        </div>
      </div>
      <div class="action-buttons">
        <button class="act" data-act="torch" aria-label="Фонарь"><span>фонарь</span></button>
        <button class="act" data-act="crouch" aria-label="Присесть"><span>присесть</span></button>
        <button class="act" data-act="listen" aria-label="Слушать"><span>слушать</span></button>
        <button class="act act-main" data-act="use" aria-label="Действие"><span>действие</span></button>
        <button class="act act-wide" data-act="sprint" aria-label="Бежать"><span>бежать</span></button>
        <button class="act act-wide" data-act="map" aria-label="Карта"><span>карта</span></button>
      </div>
    `;

    this.el = {
      moveStick: root.querySelector('[data-stick="move"]'),
      lookStick: root.querySelector('[data-stick="look"]'),
      moveKnob: root.querySelector('[data-stick="move"] .stick-knob'),
      lookKnob: root.querySelector('[data-stick="look"] .stick-knob'),
      moveBase: root.querySelector('[data-stick="move"] .stick-base'),
      lookBase: root.querySelector('[data-stick="look"] .stick-base'),
      moveLabel: root.querySelector('[data-stick="move"] .stick-label'),
    };

    this.bindZones();
    this.bindButtons();
  }

  /** Зона левой половины → стик движения, правой → камера. */
  bindZones() {
    const zones = this.root.querySelectorAll('[data-zone]');
    for (const zone of zones) {
      const which = zone.dataset.zone;
      const stick = which === 'move' ? this.move : this.look;
      const kEl = which === 'move' ? this.el.moveKnob : this.el.lookKnob;
      const bEl = which === 'move' ? this.el.moveBase : this.el.lookBase;
      const sEl = which === 'move' ? this.el.moveStick : this.el.lookStick;

      const start = (e) => {
        // мультитач: у каждого стика свой pointerId, второй стик не перебивает первый
        if (stick.active) return;
        zone.setPointerCapture?.(e.pointerId);
        const rect = this.root.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        stick.down(e.pointerId, x, y);
        sEl.classList.add('active');
        sEl.style.left = `${x}px`;
        sEl.style.top = `${y}px`;
        bEl.style.transform = 'translate(-50%, -50%) scale(1)';
        e.preventDefault();
      };

      const move = (e) => {
        if (!stick.active || stick.id !== e.pointerId) return;
        const rect = this.root.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        stick.move(e.pointerId, x, y);
        // база могла уехать за пальцем
        sEl.style.left = `${stick.base.x}px`;
        sEl.style.top = `${stick.base.y}px`;
        kEl.style.transform = `translate(calc(-50% + ${stick.knob.x}px), calc(-50% + ${stick.knob.y}px))`;
        e.preventDefault();
      };

      const end = (e) => {
        if (!stick.active || stick.id !== e.pointerId) return;
        stick.up(e.pointerId);
        sEl.classList.remove('active');
        kEl.style.transform = 'translate(-50%, -50%)';
      };

      zone.addEventListener('pointerdown', start, { passive: false });
      zone.addEventListener('pointermove', move, { passive: false });
      zone.addEventListener('pointerup', end);
      zone.addEventListener('pointercancel', end);
      zone.addEventListener('pointerleave', end);
    }
  }

  bindButtons() {
    this.root.querySelector('.action-buttons').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'sprint') {
        this.sprint = !this.sprint;
        b.classList.toggle('on', this.sprint);
        return;
      }
      this.onButton?.(act);
    });
  }

  /** Сглаживание стиков — раз в кадр. */
  update(dt) {
    this.move.update(dt);
    this.look.update(dt);
    this.el.moveKnob.style.transform = `translate(calc(-50% + ${this.move.knob.x}px), calc(-50% + ${this.move.knob.y}px))`;
    if (!this.look.active) this.el.lookKnob.style.transform = 'translate(-50%, -50%)';
  }

  /** Сброс при смене комнаты и т.п. */
  reset() {
    this.move.up();
    this.look.up();
    this.el.moveStick.classList.remove('active');
    this.el.lookStick.classList.remove('active');
    this.el.moveKnob.style.transform = 'translate(-50%, -50%)';
    this.el.lookKnob.style.transform = 'translate(-50%, -50%)';
    this.el.moveStick.style.left = '22%';
    this.el.moveStick.style.top = 'auto';
  }

  /** Для отладки и тестов: что сейчас нажато. */
  read() {
    return {
      move: { x: this.move.value.x, y: this.move.value.y, mag: Math.hypot(this.move.value.x, this.move.value.y) },
      look: { x: this.look.value.x, y: this.look.value.y, mag: Math.hypot(this.look.value.x, this.look.value.y) },
      sprint: this.sprint,
      crouch: this.root.querySelector('[data-act="crouch"]').classList.contains('on'),
    };
  }

  setCrouch(on) {
    this.root.querySelector('[data-act="crouch"]').classList.toggle('on', on);
  }

  setTorch(on) {
    this.root.querySelector('[data-act="torch"]').classList.toggle('on', on);
  }

  toggleClass(act, cls) {
    const b = this.root.querySelector(`[data-act="${act}"]`);
    if (b) b.classList.toggle(cls, !b.classList.contains(cls));
  }
}
