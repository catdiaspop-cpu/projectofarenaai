// Превью дома: разрез по этажам, canvas 2D.
//
// Каждый этаж — своя горизонтальная полоса, комнаты нарисованы в масштабе
// плана. Так дом читается на телефоне 360×640: 25 пикселей на метр.
//
// Это не отладочный экран: он грузится первым (2 мс), работает как карта,
// и остаётся в игре как «где я и куда идти».

import { ROOMS } from '../data/house.mjs';
import { LAYOUT } from '../data/layout.mjs';
import { PROPS } from '../world/props.mjs';
import { roomById } from '../sim/graph.mjs';

const FLOOR_ORDER = [2, 1, 0, -1];
const FLOOR_LABEL = { 2: 'чердак', 1: '2 этаж', 0: '1 этаж', '-1': 'подвал' };
const GAP = 14;

/** Этажи с их полосами. Чистая функция — проверяется в тестах. */
export function floorBands(width, height) {
  const house = ROOMS.filter((r) => r.kind !== 'yard');
  const minX = Math.min(...house.map((r) => r.rect.x));
  const maxX = Math.max(...house.map((r) => r.rect.x + r.rect.w));
  const planW = maxX - minX;

  const bands = [];
  for (const f of FLOOR_ORDER) {
    const rooms = house.filter((r) => r.floor === f);
    if (!rooms.length) continue;
    const z0 = Math.min(...rooms.map((r) => r.rect.z));
    const z1 = Math.max(...rooms.map((r) => r.rect.z + r.rect.d));
    bands.push({ floor: f, rooms, z0, z1, depth: z1 - z0 });
  }
  const totalDepth = bands.reduce((s, b) => s + b.depth, 0);

  const padX = 16;
  const padTop = 34;
  const padBottom = 12;
  const availH = height - padTop - padBottom - GAP * (bands.length - 1);
  const scale = Math.min((width - padX * 2) / planW, availH / totalDepth);

  let y = padTop;
  for (const b of bands) {
    b.scale = scale;
    b.height = b.depth * scale;
    b.y = y;
    b.x = padX + ((width - padX * 2) - planW * scale) / 2 - minX * scale;
    y += b.height + GAP;
  }
  return { bands, scale, planW, minX, totalDepth };
}

export class HousePreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.currentRoom = 'childroom';
    this.hoverRoom = null;
    this.time = 0;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(300, rect.width || window.innerWidth);
    const h = Math.max(380, rect.height || window.innerHeight);
    this.cssW = w;
    this.cssH = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.layout = floorBands(w, h);
    this.byFloor = new Map(this.layout.bands.map((b) => [b.floor, b]));
  }

  /** Прямоугольник комнаты на экране. */
  rectOf(room) {
    const b = this.byFloor.get(room.floor);
    if (!b) return null;
    const s = this.layout.scale;
    return {
      x: b.x + room.rect.x * s,
      y: b.y + (room.rect.z - b.z0) * s,
      w: room.rect.w * s,
      h: room.rect.d * s,
      band: b,
    };
  }

  draw(dt) {
    this.time += dt;
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);

    // фон
    const bg = ctx.createLinearGradient(0, 0, 0, this.cssH);
    bg.addColorStop(0, '#090d13');
    bg.addColorStop(0.5, '#101722');
    bg.addColorStop(1, '#06090d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    for (const band of this.layout.bands) {
      this.drawFloorLabel(band);
      for (const room of band.rooms) this.drawRoom(room);
    }
    this.drawLinks();
  }

  drawFloorLabel(band) {
    const { ctx } = this;
    ctx.save();
    ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(160,185,210,0.42)';
    ctx.textAlign = 'left';
    ctx.letterSpacing = '1px';
    ctx.fillText((FLOOR_LABEL[band.floor] ?? '').toUpperCase(), 8, band.y - 5);
    ctx.restore();
  }

  drawRoom(room) {
    const { ctx } = this;
    const r = this.rectOf(room);
    if (!r) return;
    const isCurrent = room.id === this.currentRoom;
    const isHover = room.id === this.hoverRoom;
    const light = room.light.night;

    const grad = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    if (isCurrent) {
      grad.addColorStop(0, 'rgba(255,208,145,0.30)');
      grad.addColorStop(1, 'rgba(130,96,56,0.18)');
    } else {
      const a = 0.055 + light * 0.42 + (isHover ? 0.10 : 0);
      grad.addColorStop(0, `rgba(150,175,200,${a})`);
      grad.addColorStop(1, `rgba(52,64,80,${a * 0.7})`);
    }
    ctx.fillStyle = grad;
    this.roundRect(r.x, r.y, r.w, r.h, 4);
    ctx.fill();

    ctx.lineWidth = isCurrent ? 1.7 : 1;
    ctx.strokeStyle = isCurrent ? 'rgba(255,204,134,0.9)' : 'rgba(150,175,200,0.26)';
    this.roundRect(r.x, r.y, r.w, r.h, 4);
    ctx.stroke();

    // мебель: короткие штрихи
    ctx.save();
    for (const it of LAYOUT[room.id].items) {
      const fp = PROPS[it.prop].footprint ?? { w: 0.2, d: 0.2 };
      const rot = it.rot ?? 0;
      const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
      const w = (fp.w * c + fp.d * s) * this.layout.scale;
      const h = (fp.w * s + fp.d * c) * this.layout.scale;
      const px = r.x + (it.x / room.rect.w) * r.w;
      const py = r.y + (it.z / room.rect.d) * r.h;
      ctx.fillStyle = isCurrent ? 'rgba(255,225,180,0.26)' : 'rgba(190,212,236,0.15)';
      ctx.fillRect(px - w / 2, py - h / 2, Math.min(w, r.w * 0.92), Math.min(h, r.h * 0.92));
    }
    // мелочи: точки
    for (const it of LAYOUT[room.id].clutter) {
      const px = r.x + (it.x / room.rect.w) * r.w;
      const py = r.y + (it.z / room.rect.d) * r.h;
      ctx.fillStyle = 'rgba(255,150,120,0.5)';
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }
    ctx.restore();

    // свет лампы
    for (const it of LAYOUT[room.id].items) {
      if (it.prop !== 'hedgehogLamp' && it.prop !== 'floorLamp') continue;
      const px = r.x + (it.x / room.rect.w) * r.w;
      const py = r.y + (it.z / room.rect.d) * r.h;
      const rad = Math.max(8, this.layout.scale * 0.9);
      const g2 = ctx.createRadialGradient(px, py, 0, px, py, rad);
      g2.addColorStop(0, isCurrent ? 'rgba(255,196,110,0.5)' : 'rgba(255,196,110,0.22)');
      g2.addColorStop(1, 'rgba(255,196,110,0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // подпись
    ctx.save();
    ctx.font = isCurrent ? '600 10px ui-sans-serif, system-ui, sans-serif' : '9px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = isCurrent ? 'rgba(255,226,184,0.95)' : 'rgba(185,205,225,0.4)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    if (r.w > 34) ctx.fillText(room.name, r.x + r.w / 2, r.y + r.h / 2 + 3);
    ctx.restore();
  }

  drawLinks() {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(130,160,190,0.20)';
    ctx.setLineDash([2, 5]);
    ctx.lineWidth = 1;
    const pairs = [['stairs', 'corridor'], ['hall', 'basement'], ['corridor', 'attic']];
    for (const [a, b] of pairs) {
      const ra = this.rectOf(roomById(a)), rb = this.rectOf(roomById(b));
      if (!ra || !rb) continue;
      ctx.beginPath();
      ctx.moveTo(ra.x + ra.w / 2, ra.y + ra.h / 2);
      ctx.lineTo(rb.x + rb.w / 2, rb.y + rb.h / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  roundRect(x, y, w, h, r) {
    const { ctx } = this;
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  hitTest(x, y) {
    let best = null;
    let bestArea = Infinity;
    for (const room of ROOMS) {
      if (room.kind === 'yard') continue;
      const r = this.rectOf(room);
      if (!r) continue;
      const pad = 4;
      if (x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad) {
        const area = r.w * r.h;
        if (area < bestArea) { bestArea = area; best = room.id; }
      }
    }
    return best;
  }
}

/** Совместимость с тестом: масштаб и габариты плана. */
export function layoutFits(width, height) {
  const { scale, planW, totalDepth } = floorBands(width, height);
  return { scale, planW, planD: totalDepth };
}
