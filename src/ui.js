// Сцена на весь экран и минимальный HUD.

import { ROOMS } from './rooms.js';
import { CHANNELS, CHANNEL, createState, swapStats, evaluate, describe, getObj, submerge } from './engine.js';
import { artSvg } from './art.js';

const STAGE_W = 1000;
const STAGE_H = 620;
const FLOOR_Y = 470;

const app = document.getElementById('app');

const ui = {
  roomIndex: 0,
  state: null,
  history: [],
  selected: null,
  channel: null,
  solved: false,
  sheetOpen: false,
  hintId: null,
  pulse: [],
  view: { x: 0, y: 0, w: STAGE_W, h: STAGE_H },
};

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(`metabolism.${key}`);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`metabolism.${key}`, JSON.stringify(value));
    } catch {
      /* приватный режим */
    }
  },
};

const progress = store.get('progress', { solved: [], moves: {} });
const soundOn = store.get('sound', true);

/* ─────────────────────────── звук ─────────────────────────── */

let audioCtx = null;
function tone(freq, dur = 0.12, type = 'sine', gain = 0.05) {
  if (!soundOn) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch {
    /* тишина допустима */
  }
}

const sfx = {
  pick: () => tone(520, 0.08, 'triangle', 0.04),
  swap: () => {
    tone(300, 0.1, 'sine', 0.045);
    setTimeout(() => tone(460, 0.12, 'sine', 0.035), 55);
  },
  solve: () => [392, 523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.045), i * 110)),
  nope: () => tone(140, 0.16, 'sawtooth', 0.025),
};

/* ─────────────────────────── система координат ─────────────────────────── */

// Сцена рисуется в координатах 1000×620, но область просмотра растягивается
// под экран: лишнее место занимают стена и пол, ничего не обрезается.
// Полезная часть сцены: пол и всё, что на нём. Верхняя пустая стена отрезается,
// иначе на широком экране предметы выглядят мелкими и жмутся к низу.
const CONTENT = { x: 0, y: 78, w: 1000, h: 542 };

function computeView() {
  const wrap = document.querySelector('.scene');
  const w = wrap ? wrap.clientWidth : window.innerWidth;
  const h = wrap ? wrap.clientHeight : window.innerHeight;
  const ratio = w / Math.max(1, h);
  const contentRatio = CONTENT.w / CONTENT.h;

  if (ratio >= contentRatio) {
    const width = CONTENT.h * ratio;
    ui.view = { x: CONTENT.x + (CONTENT.w - width) / 2, y: CONTENT.y, w: width, h: CONTENT.h };
  } else {
    const height = CONTENT.w / ratio;
    ui.view = { x: CONTENT.x, y: CONTENT.y - (height - CONTENT.h) / 2, w: CONTENT.w, h: height };
  }
  return ui.view;
}

/* ─────────────────────────── запуск ─────────────────────────── */

const currentRoom = () => ROOMS[ui.roomIndex];
const preferred = { 1: 'heat', 2: 'mass', 3: 'heat', 4: 'moisture', 5: 'moisture', 6: 'give', 7: 'moisture', 8: 'heat' };

function loadRoom(index) {
  ui.roomIndex = Math.max(0, Math.min(ROOMS.length - 1, index));
  store.set('room', ui.roomIndex);
  ui.state = createState(currentRoom());
  ui.history = [];
  ui.selected = null;
  ui.channel = preferred[currentRoom().id] || 'heat';
  ui.hintId = null;
  ui.solved = evaluate(ui.state, currentRoom()).solved;
  render();
}

/* ─────────────────────────── разметка ─────────────────────────── */

function roomUnlocked(i) {
  return i === 0 || progress.solved.includes(ROOMS[i].id) || progress.solved.includes(ROOMS[i - 1].id);
}

function render() {
  const room = currentRoom();
  const ev = evaluate(ui.state, room);
  computeView();
  const v = ui.view;

  app.innerHTML = `
    <div class="scene">
      <svg class="stage" viewBox="${v.x} ${v.y} ${v.w} ${v.h}" preserveAspectRatio="none"
           role="img" aria-label="${room.name}: ${room.law}">
        <defs>
          <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#312619"/>
            <stop offset="0.75" stop-color="#1c1612"/>
            <stop offset="1" stop-color="#141010"/>
          </linearGradient>
          <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#1b1512"/>
            <stop offset="1" stop-color="#0b0908"/>
          </linearGradient>
          <pattern id="bricks" width="120" height="62" patternUnits="userSpaceOnUse">
            <rect width="120" height="62" fill="none"/>
            <rect x="2" y="2" width="116" height="58" rx="3" fill="none" stroke="#3a2e24" stroke-width="1.2" opacity="0.5"/>
            <rect x="-58" y="33" width="116" height="58" rx="3" fill="none" stroke="#3a2e24" stroke-width="1.2" opacity="0.5"/>
          </pattern>
          <radialGradient id="lamp" cx="0.5" cy="0.05" r="1.1">
            <stop offset="0" stop-color="#ffd98f" stop-opacity="0.2"/>
            <stop offset="0.5" stop-color="#ffb45e" stop-opacity="0.05"/>
            <stop offset="1" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75">
            <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
            <stop offset="1" stop-color="#000" stop-opacity="0.55"/>
          </radialGradient>
          ${room.water ? `<linearGradient id="waterg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#2f7d9d" stop-opacity="0.4"/>
            <stop offset="1" stop-color="#123a52" stop-opacity="0.72"/>
          </linearGradient>` : ''}
        </defs>

        <rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" fill="url(#wall)"/>
        <rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" fill="url(#bricks)"/>
        <rect x="${v.x}" y="${FLOOR_Y}" width="${v.w}" height="${v.h}" fill="url(#floor)"/>
        <line x1="${v.x}" y1="${FLOOR_Y}" x2="${v.x + v.w}" y2="${FLOOR_Y}" stroke="#3a2f26" stroke-width="2"/>
        <g pointer-events="none">
          <rect x="${v.x}" y="${v.y}" width="${v.w}" height="34" fill="#0a0806"/>
          <rect x="${v.x}" y="26" width="${v.w}" height="16" fill="#241b15"/>
          <rect x="${v.x}" y="40" width="${v.w}" height="4" fill="#120d0a"/>
          <g>
            <path d="M500 44 v22" stroke="#2e241c" stroke-width="3"/>
            <path d="M470 66 h60 l14 20 h-88 Z" fill="#3a2c20" stroke="#513e2c" stroke-width="1.6"/>
            <ellipse cx="500" cy="86" rx="30" ry="5" fill="#ffd98f" opacity="0.75"/>
            <ellipse cx="500" cy="88" rx="16" ry="3" fill="#fff3d0" opacity="0.8"/>
          </g>
        </g>
        <rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" fill="url(#lamp)" pointer-events="none"/>

        ${sceneryLayer(room)}
        ${doorArt()}
        ${room.water ? waterBody(room) : ''}
        ${objectsLayer()}
        ${room.water ? waterSurface(room) : ''}
        ${ui.solved ? doorGlow() : ''}
        <rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" fill="url(#vignette)" pointer-events="none"/>
      </svg>

      <header class="hud">
        <button class="goal" id="infoBtn">
          <span class="goal-room">${room.id} / ${ROOMS.length}</span>
          <span class="goal-law">${room.law}</span>
        </button>
        <div class="hud-tools">
          <button class="pips" id="pips" aria-label="Условия двери">
            ${ev.status.map((s) => `<i class="${s.ok ? 'on' : ''}"></i>`).join('')}
          </button>
          <button class="tool" id="undoBtn" aria-label="Отменить ход" title="Отменить ход (Ctrl+Z)">↶</button>
          <button class="tool" id="resetBtn" aria-label="Заново" title="Начать комнату заново (R)">⟳</button>
          <button class="tool" id="helpBtn" aria-label="Как играть" title="Как играть">?</button>
        </div>
      </header>

      <nav class="dock" aria-label="Канал обмена">
        ${CHANNELS.map((key) => `
          <button class="chan ${ui.channel === key ? 'is-on' : ''}" data-channel="${key}"
                  style="--c:${CHANNEL[key].color}" aria-pressed="${ui.channel === key}"
                  title="${CHANNEL[key].hint}">
            <span class="dot"></span><span class="chan-name">${CHANNEL[key].label}</span>
          </button>`).join('')}
      </nav>

      <section class="strip" aria-label="Предметы">
        ${ui.state.objects.map((o) => `
          <button class="chip ${ui.selected === o.id ? 'is-selected' : ''} ${o.isSelf ? 'is-self' : ''}"
                  data-id="${o.id}" aria-label="${o.name}">
            <span class="chipart">${artSvg(o.art, 0, 0, 40, 40)}</span>
            <span class="chipname">${o.name}</span>
          </button>`).join('')}
      </section>

      <div class="toast" id="toast" role="status" aria-live="polite"></div>

      ${ui.solved ? solvedOverlay(room) : ''}
      <div class="inspector" id="inspector"></div>
      ${ui.sheetOpen ? sheet(room, ev) : ''}
    </div>
  `;

  bind();
}

function sceneryLayer(room) {
  if (!room.scenery) return '';
  return `<g class="scenery" pointer-events="none">
    ${room.scenery.map((s) => `<g opacity="0.95">${artSvg(s.art, s.pos.x, s.pos.y, s.pos.w, s.pos.h, 'stretch')}</g>`).join('')}
  </g>`;
}

function waterBody(room) {
  const { y1, y2 } = room.water;
  return `<g pointer-events="none">
    <rect x="-400" y="${y1}" width="${STAGE_W + 800}" height="${y2 - y1}" fill="url(#waterg)"/>
    <g stroke="#bfeaf7" stroke-width="1.6" opacity="0.16">
      <line x1="180" y1="${y1 + 44}" x2="250" y2="${y1 + 44}"/>
      <line x1="620" y1="${y1 + 84}" x2="690" y2="${y1 + 84}"/>
      <line x1="380" y1="${y1 + 140}" x2="440" y2="${y1 + 140}"/>
    </g>
    <rect x="-400" y="${y2 - 14}" width="${STAGE_W + 800}" height="14" fill="#0b1c26" opacity="0.55"/>
  </g>`;
}

function waterSurface(room) {
  const { y1 } = room.water;
  return `<g pointer-events="none">
    <path d="M-400 ${y1} q60 -9 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0
             t120 0 t120 0 t120 0 t120 0 t120 0"
          fill="none" stroke="#a9e2f4" stroke-width="2.6" opacity="0.55"/>
  </g>`;
}

// Предметы рисуем на 15% крупнее описанных, масштабируя от точки опоры:
// так они не «висят» и не смещаются относительно мебели.
const OBJECT_SCALE = 1.15;

function scaledPos(pos, isSelf) {
  const s = isSelf ? 1.2 : OBJECT_SCALE;
  const w = pos.w * s;
  const h = pos.h * s;
  return {
    x: pos.x + (pos.w - w) / 2,
    y: pos.y + pos.h - h,
    w,
    h,
  };
}

function objectsLayer() {
  return ui.state.objects
    .map((o) => {
      const r = scaledPos(o.pos, o.isSelf);
      const words = describe(o).join(', ') || 'ничем не примечательный';
      const depth = submerge(o, currentRoom());
      return `<g class="obj ${ui.selected === o.id ? 'is-selected' : ''}
                     ${ui.pulse.includes(o.id) ? 'is-pulse' : ''} ${o.isSelf ? 'is-self' : ''}"
                 data-id="${o.id}" tabindex="0" role="button" aria-label="${o.name}: ${words}">
                <rect class="hit" x="${r.x - 16}" y="${r.y - 16}" width="${r.w + 32}" height="${r.h + 32}"
                      rx="16" fill="transparent"/>
                <g class="ghost" opacity="${(1 - depth * 0.22).toFixed(2)}">
                  ${artSvg(o.art, r.x, r.y, r.w, r.h, o.isSelf ? 'xMidYMax' : 'xMidYMid')}
                </g>
              </g>`;
    })
    .join('');
}

function doorArt() {
  return `<g pointer-events="none">
    <rect x="890" y="132" width="100" height="344" rx="5" fill="#120e0b" stroke="#3a2d24" stroke-width="3"/>
    <rect x="899" y="144" width="82" height="160" rx="3" fill="none" stroke="#463427" stroke-width="1.5"/>
    <rect x="899" y="318" width="82" height="148" rx="3" fill="none" stroke="#463427" stroke-width="1.5"/>
    <circle cx="972" cy="308" r="6" fill="#463427"/>
  </g>`;
}

function doorGlow() {
  return `<g pointer-events="none">
    <rect x="890" y="132" width="100" height="344" rx="5" fill="#ffd88a" opacity="0.16"/>
    <circle cx="972" cy="308" r="6" fill="#c9a24a"/>
  </g>`;
}

function solvedOverlay(room) {
  const isLast = ui.roomIndex === ROOMS.length - 1;
  return `<div class="solvedcard">
    <p class="solvedtext">${room.solvedText}</p>
    <div class="solvedrow">
      ${isLast
        ? `<p class="final">Все восемь комнат позади.</p>
           <button class="primary" id="againBtn">Пройти заново</button>`
        : `<button class="primary" id="nextBtn">Дальше →</button>
           <button class="ghosty" id="againBtn">Ещё раз</button>`}
    </div>
  </div>`;
}

function sheet(room, ev) {
  return `<div class="sheet" id="sheet">
    <div class="sheetcard">
      <div class="sheethead">
        <div>
          <p class="kicker">Комната ${room.id} из ${ROOMS.length}</p>
          <h2>${room.name}</h2>
        </div>
        <button class="tool" id="closeSheet" aria-label="Закрыть">×</button>
      </div>
      <p class="intro">${room.intro}</p>
      <ul class="conditions">
        ${ev.status.map((s) => `<li class="${s.ok ? 'ok' : ''}"><span>${s.ok ? '✓' : '·'}</span>${s.text}</li>`).join('')}
      </ul>
      <button class="ghosty" id="hintBtn">Подсказка</button>
      ${ui.hintId === 'hint' ? `<p class="hinttext">${room.hint}</p>` : ''}
      <div class="roomnav">
        ${ROOMS.map((r, i) => {
          const done = progress.solved.includes(r.id);
          const unlocked = roomUnlocked(i);
          return `<button class="roomdot ${i === ui.roomIndex ? 'is-now' : ''} ${done ? 'is-done' : ''}"
                  data-room="${i}" ${unlocked ? '' : 'data-locked="1"'}
                  aria-label="Комната ${r.id}: ${r.name}">${done ? '✓' : r.id}</button>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}

/* ─────────────────────────── действия ─────────────────────────── */

function bind() {
  document.getElementById('infoBtn').onclick = () => {
    ui.sheetOpen = !ui.sheetOpen;
    ui.hintId = null;
    render();
  };

  document.getElementById('pips')?.addEventListener('click', () => {
    const unmet = evaluate(ui.state, currentRoom()).status.filter((s) => !s.ok);
    if (!unmet.length) toast('Всё готово — дверь открыта.');
    else toast('Не хватает: ' + unmet.map((s) => s.text).join(' · '));
  });

  document.getElementById('undoBtn').onclick = () => {
    if (!ui.history.length) return;
    ui.state = ui.history.pop();
    ui.solved = false;
    ui.selected = null;
    tone(380, 0.1, 'triangle', 0.035);
    render();
  };

  document.getElementById('resetBtn').onclick = () => loadRoom(ui.roomIndex);

  document.getElementById('helpBtn').onclick = openHelp;

  app.querySelectorAll('.chan').forEach((btn) => {
    btn.onclick = () => {
      ui.channel = btn.dataset.channel;
      if (navigator.vibrate) navigator.vibrate(6);
      sfx.pick();
      render();
    };
  });

  app.querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      if (navigator.vibrate) navigator.vibrate(8);
      pick(btn.dataset.id);
    };
  });

  app.querySelectorAll('.obj').forEach((g) => {
    const o = getObj(ui.state, g.dataset.id);
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      pick(g.dataset.id);
    });
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick(g.dataset.id);
      }
    });
    g.addEventListener('mouseenter', () => {
      if (window.matchMedia('(hover: hover)').matches) showInspector(o);
    });
    g.addEventListener('mouseleave', () => {
      if (ui.hintId !== o.id) hideInspector();
    });
    g.addEventListener('focus', () => showInspector(o));
  });

  document.getElementById('nextBtn')?.addEventListener('click', () => loadRoom(ui.roomIndex + 1));
  document.getElementById('againBtn')?.addEventListener('click', () => loadRoom(ui.roomIndex));

  const closeSheet = document.getElementById('closeSheet');
  if (closeSheet) closeSheet.onclick = () => { ui.sheetOpen = false; render(); };

  const hint = document.getElementById('hintBtn');
  if (hint) hint.onclick = () => { ui.hintId = 'hint'; render(); };

  app.querySelectorAll('.roomdot').forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.locked) {
        sfx.nope();
        toast('Сначала пройди предыдущую комнату.');
        return;
      }
      ui.sheetOpen = false;
      loadRoom(Number(btn.dataset.room));
    };
  });
}

function pick(id) {
  if (ui.solved) return;
  const o = getObj(ui.state, id);
  if (!o) return;

  if (ui.selected === id) {
    ui.selected = null;
    render();
    return;
  }

  if (!ui.selected) {
    ui.selected = id;
    showInspector(o);
    ui.hintId = id;
    sfx.pick();
    render();
    return;
  }

  commit(ui.selected, id);
}

function commit(aId, bId) {
  const room = currentRoom();
  const channel = ui.channel;
  const a = getObj(ui.state, aId);
  const b = getObj(ui.state, bId);

  if (a.fixed || b.fixed) {
    sfx.nope();
    toast('Это часть комнаты.');
    return;
  }

  const beforeA = a.stats[channel];
  const beforeB = b.stats[channel];
  const same = beforeA === beforeB;

  ui.history.push(ui.state);
  ui.state = swapStats(ui.state, aId, bId, channel);
  ui.selected = null;
  progress.moves[room.id] = (progress.moves[room.id] || 0) + 1;
  store.set('progress', progress);

  ui.pulse = [aId, bId];
  setTimeout(() => {
    ui.pulse = [];
    document.querySelectorAll('.obj.is-pulse').forEach((el) => el.classList.remove('is-pulse'));
  }, 560);

  const ev = evaluate(ui.state, room);
  if (ev.solved) {
    ui.solved = true;
    if (!progress.solved.includes(room.id)) progress.solved.push(room.id);
    store.set('progress', progress);
    render();
    sfx.solve();
    return;
  }

  sfx.swap();
  render();
  if (same) toast(`«${CHANNEL[channel].label}» уже одинаков — попробуй другой канал.`);
  else toast(`${CHANNEL[channel].label}: ${a.name} ${beforeA} → ${beforeB} · ${b.name} ${beforeB} → ${beforeA}`);
}

/* ─────────────────────────── мелкие надписи ─────────────────────────── */

let toastTimer = null;
function toast(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('is-open');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-open'), 2600);
}

function showInspector(o) {
  const el = document.getElementById('inspector');
  if (!el || !o) return;
  const words = describe(o);
  el.innerHTML = `
    <p class="insname">${o.name}</p>
    <p class="inswords">${words.length ? words.join(', ') : 'ничем не примечательный'}</p>
    <div class="bars">
      ${CHANNELS.map((ch) => `
        <div class="bar" style="--c:${CHANNEL[ch].color}">
          <span class="bartrack"><span class="barfill" style="width:${o.stats[ch]}%"></span></span>
          <span class="barval">${o.stats[ch]}</span>
        </div>`).join('')}
    </div>`;
  el.classList.add('is-open');
}

function hideInspector() {
  const el = document.getElementById('inspector');
  if (el) el.classList.remove('is-open');
}

function openHelp() {
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `
    <div class="modalcard">
      <h2>Обмен веществ</h2>
      <p>У каждого предмета четыре свойства: <b>вес</b>, <b>тепло</b>, <b>влага</b>, <b>упругость</b>.
         Обменяй одно свойство между двумя предметами — это единственный глагол.</p>
      <p>Нажми на канал внизу, затем на предмет-донор и на предмет-получатель.
         Твоё тело тоже предмет: его свойства можно отдать.</p>
      <p class="note">Тупиков нет: обмен — перестановка, любой ход отменяется (Ctrl+Z).</p>
      <button class="primary" id="closeHelp">Понятно</button>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.querySelector('#closeHelp').onclick = close;
  wrap.onclick = (e) => { if (e.target === wrap) close(); };
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ui.selected = null;
    if (ui.sheetOpen) ui.sheetOpen = false;
    hideInspector();
    render();
  }
  const digit = ['1', '2', '3', '4'].indexOf(e.key);
  if (digit >= 0) {
    ui.channel = CHANNELS[digit];
    sfx.pick();
    render();
  }
  if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    document.getElementById('undoBtn')?.click();
  }
  if (e.key === 'r') loadRoom(ui.roomIndex);
});

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => render(), 120);
});

loadRoom(Number(store.get('room', 0)) || 0);
