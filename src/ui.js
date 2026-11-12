// Сцена, интерфейс и взаимодействие.

import { ROOMS } from './rooms.js';
import { CHANNELS, CHANNEL, createState, swapStats, evaluate, describe, getObj, submerge } from './engine.js';
import { artSvg } from './art.js';

const STAGE_W = 1000;
const STAGE_H = 620;

const app = document.getElementById('app');

const ui = {
  roomIndex: 0,
  state: null,
  history: [],
  selected: null,
  channel: null,
  solved: false,
  hintOpen: false,
  hintId: null,
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
      /* приватный режим — играем без сохранений */
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
    /* без звука тоже играется */
  }
}

const sfx = {
  pick: () => tone(520, 0.08, 'triangle', 0.045),
  swap: () => {
    tone(300, 0.1, 'sine', 0.05);
    setTimeout(() => tone(460, 0.12, 'sine', 0.04), 55);
  },
  solve: () => [392, 523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.05), i * 110)),
  nope: () => tone(140, 0.16, 'sawtooth', 0.03),
};

/* ─────────────────────────── запуск ─────────────────────────── */

const currentRoom = () => ROOMS[ui.roomIndex];

let pulseIds = [];
function pulse(aId, bId) {
  pulseIds = [aId, bId];
  setTimeout(() => {
    pulseIds = [];
    document.querySelectorAll('.obj.is-pulse').forEach((el) => el.classList.remove('is-pulse'));
  }, 620);
}

function loadRoom(index) {
  ui.roomIndex = Math.max(0, Math.min(ROOMS.length - 1, index));
  store.set('room', ui.roomIndex);
  ui.state = createState(currentRoom());
  ui.history = [];
  ui.selected = null;
  ui.channel = null;
  ui.hintOpen = false;
  ui.hintId = null;
  const ev = evaluate(ui.state, currentRoom());
  ui.solved = ev.solved;
  render();
}

/* ─────────────────────────── каркас ─────────────────────────── */

function render() {
  const room = currentRoom();
  const solvedCount = progress.solved.length;

  app.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <span class="mark" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M5 8h6l3-4h5v5l-4 3v6h-6l-3-4H5Z"/><path d="M3 15l4 3"/></svg>
        </span>
        <div>
          <h1>Обмен веществ</h1>
          <p class="sub">один глагол · четыре канала</p>
        </div>
      </div>
      <nav class="roomnav" aria-label="Комнаты">
        ${ROOMS.map((r, i) => {
          const done = progress.solved.includes(r.id);
          const unlocked = i === 0 || progress.solved.includes(ROOMS[i - 1].id) || done;
          return `<button class="roomdot ${i === ui.roomIndex ? 'is-now' : ''} ${done ? 'is-done' : ''}"
                  data-room="${i}" ${unlocked ? '' : 'data-locked="1"'}
                  aria-label="Комната ${r.id}: ${r.name}${done ? ' (пройдена)' : ''}">
                    <span>${done ? '✓' : r.id}</span>
                  </button>`;
        }).join('')}
      </nav>
      <div class="topright">
        <span class="counter" title="Пройдено комнат">${solvedCount} / ${ROOMS.length}</span>
        <button class="iconbtn" id="soundBtn" aria-label="${soundOn ? 'Выключить звук' : 'Включить звук'}">
          ${soundOn ? '♪' : '×'}
        </button>
        <button class="iconbtn" id="helpBtn" aria-label="Как играть">?</button>
      </div>
    </header>

    <main class="layout">
      <section class="brief">
        <p class="kicker">Комната ${room.id} из ${ROOMS.length}</p>
        <h2>${room.name}</h2>
        <p class="law">${room.law}</p>
        <p class="intro">${room.intro}</p>

        <div class="channels" role="group" aria-label="Канал обмена">
          ${CHANNELS.map((key) => `
            <button class="chan ${ui.channel === key ? 'is-on' : ''}"
                    data-channel="${key}" style="--c:${CHANNEL[key].color}"
                    aria-pressed="${ui.channel === key}">
              <span class="chan-dot"></span>
              <span class="chan-name">${CHANNEL[key].label}</span>
            </button>`).join('')}
        </div>
        <p class="chanhint">${ui.channel
          ? `<b style="color:${CHANNEL[ui.channel].color}">${
              ui.selected ? getObj(ui.state, ui.selected).name : 'предмет'
            }</b> ↔ кому? · ${CHANNEL[ui.channel].hint}`
          : 'Выбери канал, потом два предмета.'}</p>

        <div class="statusbox">
          <h3>Условия двери</h3>
          <ul id="statusList"></ul>
        </div>

        <div class="brieffoot">
          <button class="ghost" id="undoBtn">Отменить ход</button>
          <button class="ghost" id="resetBtn">Заново</button>
          <button class="ghost" id="hintBtn">Подсказка</button>
        </div>
        ${ui.hintOpen ? `<p class="hintbox">${room.hint}</p>` : ''}
      </section>

      <section class="stagewrap">
        <svg class="stage" viewBox="0 0 ${STAGE_W} ${STAGE_H}" role="img"
             aria-label="Комната ${room.id}: ${room.name}">
          <defs>
            <radialGradient id="lamp" cx="0.5" cy="0.1" r="0.95">
              <stop offset="0" stop-color="#ffdf9e" stop-opacity="0.22"/>
              <stop offset="0.55" stop-color="#ffbb63" stop-opacity="0.06"/>
              <stop offset="1" stop-color="#000" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#241d18"/>
              <stop offset="1" stop-color="#151110"/>
            </linearGradient>
            <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#1b1512"/>
              <stop offset="1" stop-color="#0d0a09"/>
            </linearGradient>
            <clipPath id="wallclip"><rect width="${STAGE_W}" height="470"/></clipPath>
            ${room.water ? `<linearGradient id="waterg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#2f7d9d" stop-opacity="0.42"/>
              <stop offset="1" stop-color="#123a52" stop-opacity="0.74"/>
            </linearGradient>` : ''}
          </defs>

          <rect width="${STAGE_W}" height="${STAGE_H}" fill="url(#wall)"/>
          ${brickWall()}
          <rect y="470" width="${STAGE_W}" height="${STAGE_H - 470}" fill="url(#floor)"/>
          <line x1="0" y1="470" x2="${STAGE_W}" y2="470" stroke="#2e2620" stroke-width="2"/>
          <rect width="${STAGE_W}" height="${STAGE_H}" fill="url(#lamp)" pointer-events="none"/>
          ${sceneryLayer(room)}
          ${room.water ? waterBody(room) : ''}
          ${objectsLayer()}
          ${room.water ? waterSurface(room) : ''}
          ${doorArt(ui.solved)}
        </svg>
        <div class="pickbar" id="pickbar"></div>
        <div class="exchange" id="exchange" role="status" aria-live="polite"></div>
        ${ui.solved ? solvedOverlay(room) : ''}
      </section>

      <nav class="dock" aria-label="Канал обмена (телефон)">
        ${CHANNELS.map((key) => `
          <button class="dockchan ${ui.channel === key ? 'is-on' : ''}"
                  data-channel="${key}" style="--c:${CHANNEL[key].color}"
                  aria-pressed="${ui.channel === key}">
            <span class="dockdot"></span>${CHANNEL[key].label}
          </button>`).join('')}
      </nav>

      <section class="strip" aria-label="Предметы (телефон)">
        <p class="striphead">${ui.selected
          ? `забрали у «${getObj(ui.state, ui.selected).name}» — кому отдать?`
          : ui.channel
            ? `канал «${CHANNEL[ui.channel].label}» — у кого забрать?`
            : 'выбери канал, затем предмет'}</p>
        <div class="striprow">
          ${ui.state.objects.map((o) => `
            <button class="chip ${ui.selected === o.id ? 'is-selected' : ''} ${o.isSelf ? 'is-self' : ''}"
                    data-id="${o.id}">
              <span class="chipart">${artSvg(o.art, 0, 0, 44, 44)}</span>
              <span class="chipname">${o.name}</span>
            </button>`).join('')}
        </div>
      </section>
    </main>

    <div class="inspector" id="inspector" hidden></div>
    <footer class="footerhint">
      <span><b>1</b>–<b>4</b> канал</span>
      <span>щелчок по предмету — забрать, второй щелчок — отдать</span>
      <span><b>Ctrl</b>+<b>Z</b> отменить</span>
    </footer>
  `;

  bind();
  paintStatus();
  paintPickbar();
}

function paintPickbar() {
  const bar = document.getElementById('pickbar');
  if (!bar) return;
  const ch = ui.channel ? CHANNEL[ui.channel] : null;
  const sel = ui.selected ? getObj(ui.state, ui.selected) : null;
  if (!ui.channel) {
    bar.innerHTML = `<span class="step">шаг 1</span> выбери канал слева`;
    bar.classList.remove('ready');
    return;
  }
  if (!sel) {
    bar.innerHTML = `<span class="step" style="--c:${ch.color}">${ch.label}</span>
                     выбери, у кого забрать это свойство`;
    bar.classList.remove('ready');
    return;
  }
  bar.innerHTML = `<span class="step" style="--c:${ch.color}">${ch.label}</span>
                   забрали у <b>${sel.name}</b> — теперь щёлкни, кому отдать`;
  bar.classList.add('ready');
}

function brickWall() {
  let out = '';
  for (let row = 0; row < 7; row += 1) {
    const y = 40 + row * 62;
    const off = row % 2 ? 60 : 0;
    for (let col = -1; col < 10; col += 1) {
      out += `<rect x="${col * 120 + off}" y="${y}" width="112" height="54" rx="3"
              fill="none" stroke="#2a221c" stroke-width="1.4" opacity="0.5"/>`;
    }
  }
  return `<g clip-path="url(#wallclip)">${out}</g>`;
}

function waterBody(room) {
  const { y1, y2 } = room.water;
  return `<g pointer-events="none">
    <rect x="0" y="${y1}" width="${STAGE_W}" height="${y2 - y1}" fill="url(#waterg)"/>
    <g stroke="#bfeaf7" stroke-width="1.6" opacity="0.2">
      <line x1="180" y1="${y1 + 44}" x2="250" y2="${y1 + 44}"/>
      <line x1="620" y1="${y1 + 84}" x2="690" y2="${y1 + 84}"/>
      <line x1="380" y1="${y1 + 140}" x2="440" y2="${y1 + 140}"/>
    </g>
    <rect x="0" y="${y2 - 16}" width="${STAGE_W}" height="16" fill="#0b1c26" opacity="0.6"/>
  </g>`;
}

function waterSurface(room) {
  const { y1 } = room.water;
  return `<g pointer-events="none">
    <path d="M0 ${y1} q60 -9 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t40 0"
          fill="none" stroke="#a9e2f4" stroke-width="2.8" opacity="0.6"/>
    <path d="M0 ${y1 + 3} q60 9 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t40 0"
          fill="none" stroke="#2f7d9d" stroke-width="1.6" opacity="0.5"/>
  </g>`;
}

function sceneryLayer(room) {
  if (!room.scenery) return '';
  return `<g class="scenery" pointer-events="none">
    ${room.scenery.map((s) => `<g opacity="0.96">${artSvg(s.art, s.pos.x, s.pos.y, s.pos.w, s.pos.h, 'stretch')}</g>`).join('')}
  </g>`;
}

function objectsLayer() {
  return ui.state.objects
    .map((o) => {
      const isSel = ui.selected === o.id;
      const r = o.pos;
      const words = describe(o).join(', ') || 'ничем не примечательный';
      const isPulse = pulseIds.includes(o.id);
      return `<g class="obj ${isSel ? 'is-selected' : ''} ${isPulse ? 'is-pulse' : ''} ${o.isSelf ? 'is-self' : ''}"
                 data-id="${o.id}" tabindex="0" role="button"
                 aria-label="${o.name}: ${words}">
                <rect class="hit" x="${r.x - 12}" y="${r.y - 12}" width="${r.w + 24}" height="${r.h + 24}"
                      rx="14" fill="transparent"/>
                ${o.wall ? '' : `<ellipse class="shadow" cx="${r.x + r.w / 2}" cy="${r.y + r.h - 2}"
                         rx="${r.w * 0.46}" ry="${Math.max(5, r.h * 0.06)}" fill="#000"
                         opacity="${submerge(o, currentRoom()) > 0.1 ? 0.12 : 0.28}"/>`}
                <g class="ghost" opacity="${(1 - submerge(o, currentRoom()) * 0.22).toFixed(2)}">
                  ${artSvg(o.art, r.x, r.y, r.w, r.h, o.isSelf ? 'xMidYMax' : 'xMidYMid')}
                </g>
              </g>`;
    })
    .join('');
}

function doorArt(solved) {
  return `
    <g pointer-events="none">
      <rect x="896" y="150" width="92" height="326" rx="5"
            fill="${solved ? '#2b221b' : '#1d1713'}" stroke="#3a2d24" stroke-width="3"/>
      <rect x="906" y="162" width="72" height="150" rx="3" fill="none" stroke="#4a3a2e" stroke-width="1.6"/>
      <rect x="906" y="320" width="72" height="146" rx="3" fill="none" stroke="#4a3a2e" stroke-width="1.6"/>
      <circle cx="968" cy="316" r="6" fill="${solved ? '#c9a24a' : '#4a3a2e'}"/>
      ${solved ? `<rect x="896" y="150" width="92" height="326" rx="5" fill="#ffd88a" opacity="0.16"/>` : ''}
    </g>`;
}

function solvedOverlay(room) {
  const isLast = ui.roomIndex === ROOMS.length - 1;
  return `
    <div class="solvedcard">
      <p class="kicker">Комната ${room.id} пройдена</p>
      <h3>${room.solvedText}</h3>
      ${isLast
        ? `<p class="final">Все восемь комнат позади. Ты вышел другим — и это не метафора.</p>
           <div class="row"><button class="ghost" id="againBtn">Пройти заново</button></div>`
        : `<div class="row">
             <button class="primary" id="nextBtn">Дальше →</button>
             <button class="ghost" id="againBtn">Ещё раз</button>
           </div>`}
    </div>`;
}

/* ─────────────────────────── шкалы и инспектор ─────────────────────────── */

function paintStatus() {
  const ev = evaluate(ui.state, currentRoom());
  const list = document.getElementById('statusList');
  if (list) {
    list.innerHTML = ev.status
      .map((s) => `<li class="${s.ok ? 'ok' : ''}"><span class="tick">${s.ok ? '✓' : '·'}</span>${s.text}</li>`)
      .join('');
  }
  const undo = document.getElementById('undoBtn');
  if (undo) undo.disabled = ui.history.length === 0;
  return ev;
}

function showInspector(o) {
  const el = document.getElementById('inspector');
  if (!o) {
    el.hidden = true;
    return;
  }
  const words = describe(o);
  el.hidden = false;
  el.innerHTML = `
    <div class="inshead">
      <strong>${o.name}</strong>
      <button class="iconbtn small" id="closeIns" aria-label="Закрыть">×</button>
    </div>
    <p class="inswords">${words.length ? words.join(', ') : 'ничем не примечательный'}</p>
    <div class="bars">
      ${CHANNELS.map((ch) => {
        const v = o.stats[ch];
        return `<div class="bar" style="--c:${CHANNEL[ch].color}">
          <span class="barname">${CHANNEL[ch].label}</span>
          <span class="bartrack"><span class="barfill" style="width:${v}%"></span></span>
          <span class="barval">${v}</span>
        </div>`;
      }).join('')}
    </div>
    ${o.isSelf ? '<p class="note">Это ты. Своё отдавать можно — назад уже не вернуть.</p>' : ''}
  `;
  document.getElementById('closeIns').onclick = (e) => {
    e.stopPropagation();
    ui.hintId = null;
    el.hidden = true;
  };
}

/* ─────────────────────────── взаимодействие ─────────────────────────── */

function bind() {
  app.querySelectorAll('.roomdot').forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.locked) {
        sfx.nope();
        if (btn.animate) btn.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' },
           { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }],
          { duration: 180 },
        );
        return;
      }
      loadRoom(Number(btn.dataset.room));
    };
  });

  document.getElementById('soundBtn').onclick = () => {
    store.set('sound', !soundOn);
    location.reload();
  };

  document.getElementById('helpBtn').onclick = openHelp;

  app.querySelectorAll('.dockchan').forEach((btn) => {
    btn.onclick = () => {
      ui.channel = ui.channel === btn.dataset.channel ? null : btn.dataset.channel;
      if (navigator.vibrate) navigator.vibrate(8);
      sfx.pick();
      render();
    };
  });

  app.querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      if (navigator.vibrate) navigator.vibrate(10);
      pick(btn.dataset.id);
    };
  });

  app.querySelectorAll('.chan').forEach((btn) => {
    btn.onclick = () => {
      ui.channel = ui.channel === btn.dataset.channel ? null : btn.dataset.channel;
      sfx.pick();
      render();
    };
  });

  app.querySelectorAll('.obj').forEach((g) => {
    const o = getObj(ui.state, g.dataset.id);
    g.addEventListener('click', () => pick(g.dataset.id));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick(g.dataset.id);
      }
    });
    g.addEventListener('mouseenter', () => showInspector(o));
    g.addEventListener('mouseleave', () => {
      if (!ui.hintId) document.getElementById('inspector').hidden = true;
    });
    g.addEventListener('focus', () => showInspector(o));
  });

  const undo = document.getElementById('undoBtn');
  if (undo) {
    undo.onclick = () => {
      if (!ui.history.length) return;
      ui.state = ui.history.pop();
      ui.solved = false;
      ui.selected = null;
      tone(380, 0.1, 'triangle', 0.04);
      render();
    };
  }

  document.getElementById('resetBtn').onclick = () => loadRoom(ui.roomIndex);

  document.getElementById('hintBtn').onclick = () => {
    ui.hintOpen = !ui.hintOpen;
    render();
  };

  const next = document.getElementById('nextBtn');
  if (next) next.onclick = () => loadRoom(ui.roomIndex + 1);

  const again = document.getElementById('againBtn');
  if (again) again.onclick = () => loadRoom(ui.roomIndex);
}

function pick(id) {
  if (ui.solved) return;
  const o = getObj(ui.state, id);
  if (!o) return;
  ui.hintId = id;
  showInspector(o);

  if (!ui.channel) ui.channel = preferred[ui.state.roomId] || 'heat';

  if (ui.selected === id) {
    ui.selected = null;
    render();
    return;
  }

  if (!ui.selected) {
    ui.selected = id;
    sfx.pick();
    render();
    return;
  }

  commit(ui.selected, id);
}

const preferred = { 1: 'heat', 2: 'mass', 3: 'heat', 4: 'moisture', 5: 'moisture', 6: 'give', 7: 'moisture', 8: 'heat' };

function commit(aId, bId) {
  const room = currentRoom();
  const channel = ui.channel;
  const a = getObj(ui.state, aId);
  const b = getObj(ui.state, bId);

  if (a.fixed || b.fixed) {
    flash('С этим предметом обменяться нельзя: он часть комнаты.');
    sfx.nope();
    ui.selected = null;
    render();
    return;
  }

  const same = a.stats[channel] === b.stats[channel];
  ui.history.push(ui.state);
  ui.state = swapStats(ui.state, aId, bId, channel);
  ui.selected = null;
  progress.moves[room.id] = (progress.moves[room.id] || 0) + 1;
  store.set('progress', progress);

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
  pulse(aId, bId);
  const aValues = a.stats[channel];
  const bValues = b.stats[channel];
  render();
  if (same) {
    flash(`Нечего менять: «${CHANNEL[channel].label}» у обоих уже одинаков.
      Попробуй другой канал.`);
  } else {
    flash(`${a.name}: ${aValues} → ${bValues} · ${b.name}: ${bValues} → ${aValues}`);
  }
}

let flashTimer = null;
function flash(text) {
  const el = document.getElementById('exchange');
  if (!el) return;
  el.textContent = text;
  el.classList.add('is-open');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('is-open'), 3000);
}

/* ─────────────────────────── помощь ─────────────────────────── */

function openHelp() {
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `
    <div class="modalcard">
      <h2>Как играть</h2>
      <p>У каждого предмета четыре свойства: <b>вес</b>, <b>тепло</b>, <b>влага</b>, <b>упругость</b>.
         Ты можешь <b>обменять одно свойство</b> между двумя предметами — это единственный глагол в игре.</p>
      <ol>
        <li>Выбери канал слева (например, «тепло»).</li>
        <li>Щёлкни предмет, у которого хочешь забрать свойство.</li>
        <li>Щёлкни предмет, которому хочешь его отдать.</li>
        <li>Следи за условиями двери: они обновляются после каждого обмена.</li>
      </ol>
      <p>Свойства — не очки, а физика. Мокрое не горит, тяжёлое тонет, податливое провисает.
         Твоё тело — тоже предмет: его свойства можно отдать, но назад их не вернуть иначе,
         как забрав у кого-то другого.</p>
      <p class="note">Тупиков не бывает: обмен — это перестановка, поэтому любой ход можно отменить
         кнопкой «Отменить ход» или Ctrl+Z.</p>
      <button class="primary" id="closeHelp">Понятно</button>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.querySelector('#closeHelp').onclick = close;
  wrap.onclick = (e) => { if (e.target === wrap) close(); };
  wrap.querySelector('#closeHelp').focus();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.querySelector('.modal')) return;
    ui.selected = null;
    ui.channel = null;
    render();
  }
  const digit = ['1', '2', '3', '4'].indexOf(e.key);
  if (digit >= 0 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    ui.channel = CHANNELS[digit];
    sfx.pick();
    render();
  }
  if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    document.getElementById('undoBtn')?.click();
  }
});

loadRoom(Number(store.get('room', 0)) || 0);
