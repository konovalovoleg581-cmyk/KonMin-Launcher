/**
 * КонМинли (KonMinli) — ИИ-помощник и маскот KonMin Launcher: сам логотип KonMin, ставший персонажем.
 *
 * Тело — плитка знака как есть: квадрат 376 со скруглением 84, градиент #3D8BFF → #7B5CFF, белая
 * пиксельная буква K на сетке 7×7 по 30 (от 83 до 293, тень со сдвигом), голубая искра в клетке (6,0).
 * Ни размер, ни место буквы не меняются: лицо живёт в пустых полях самого знака — маленькие глаза
 * в верхнем поле над буквой, улыбка и щёки в нижнем поле под ней. Ручки растут из боков плитки,
 * ножки — снизу, и только у персонажа: логотип и иконка приложения — та же плитка с лицом без них.
 *
 * Лицо рисуется в своих координатах («лицо», как у прежнего маскота) и ставится на плитку одним
 * преобразованием `MILLI_FACE_FIT`: глаза, все кадры эмоций и рты уменьшаются вместе.
 *
 * Механика персонажа (кадры, эмоции, ручки и ножки, взгляд) унаследована от маскота Milli
 * из Millida Launcher; знак Millida из тела убран.
 */
import type { MilliEmotion } from './milliEmotions'

/**
 * Режимы (держатся, пока стоит проп): `dance` — прежнее имя `happy`, оставлено
 * для старых вызовов. `hop` — прыжки с пылью, `spin` — праздничный оборот,
 * `sleep` — спит (в покое засыпает и сама, см. `MILLI_SLEEP_AFTER`).
 */
export type MilliMode = 'idle' | 'talk' | 'think' | 'happy' | 'wave' | 'dance' | 'hop' | 'spin' | 'sleep' | MilliEmotion

export interface MilliBox {
  x: number
  y: number
  w: number
  h: number
}

export const MILLI_VIEW = 376
/**
 * Поле персонажа: знак 376×376 плюс поля под ручки, ботинки и точки «думает».
 * Квадрат, чтобы `size` по-прежнему задавал и ширину, и высоту.
 */
export const MILLI_FRAME_BOX = { x: -96, y: -96, size: 568 } as const

/** Сетка буквы K логотипа KonMin: 7×7 клеток по 30, ровно как в знаке (от 83 до 293). */
export const MILLI_GRID = { x0: 83, y0: 83, step: 30 } as const
export function milliCell(col: number, row: number): MilliBox {
  const { x0, y0, step } = MILLI_GRID
  return { x: x0 + col * step, y: y0 + row * step, w: step, h: step }
}

/** Буква K логотипа KonMin по клеткам, строка за строкой (1 — белая). Клетка (6,0) — голубая искра. */
export const MILLI_GLYPH_CELLS: readonly (readonly number[])[] = [
  [1, 1, 0, 0, 0, 1, 1],
  [1, 1, 0, 0, 1, 1, 0],
  [1, 1, 0, 1, 1, 0, 0],
  [1, 1, 1, 1, 0, 0, 0],
  [1, 1, 0, 1, 1, 0, 0],
  [1, 1, 0, 0, 1, 1, 0],
  [1, 1, 0, 0, 0, 1, 1],
]

/** Плитка знака KonMin: квадрат 376 со скруглением 84. */
export const MILLI_TILE = 'M84 0H292A84 84 0 0 1 376 84V292A84 84 0 0 1 292 376H84A84 84 0 0 1 0 292V84A84 84 0 0 1 84 0Z'
/** Внутренний ободок толщиной 10 по той же скруглённой форме. */
export const MILLI_RIM = `${MILLI_TILE}M84 10H292A74 74 0 0 1 366 84V292A74 74 0 0 1 292 366H84A74 74 0 0 1 10 292V84A74 74 0 0 1 84 10Z`
/** Блик сверху и слева, тень справа и снизу — полосы, обрезанные по скруглённым углам. */
export const MILLI_BEVEL = {
  top: 'M32.04 18A84 84 0 0 1 84 0H292A84 84 0 0 1 343.96 18Z',
  left: 'M18 32.04A84 84 0 0 0 0 84V292A84 84 0 0 0 18 343.96Z',
  right: 'M358 32.04A84 84 0 0 1 376 84V292A84 84 0 0 1 358 343.96Z',
  bottom: 'M19.66 346H356.34A84 84 0 0 1 292 376H84A84 84 0 0 1 19.66 346Z',
} as const

/** Строки буквы K прямоугольниками: соседние клетки строки сливаются, искра (6,0) — отдельно. */
function glyphRuns(fromRow: number, toRow: number): MilliBox[] {
  const out: MilliBox[] = []
  for (let r = fromRow; r <= toRow; r++) {
    const row = MILLI_GLYPH_CELLS[r] ?? []
    for (let c = 0; c < row.length; c++) {
      if (!row[c] || (r === 0 && c === 6)) continue
      let end = c
      while (row[end + 1] && !(r === 0 && end + 1 === 6)) end++
      const cell = milliCell(c, r)
      out.push({ ...cell, w: cell.w * (end - c + 1) })
      c = end
    }
  }
  return out
}
const boxPath = (rs: readonly MilliBox[]) => rs.map((b) => `M${b.x} ${b.y}H${b.x + b.w}V${b.y + b.h}H${b.x}Z`).join('')
const GLYPH_UPPER = glyphRuns(0, 3)
const GLYPH_LOWER = glyphRuns(4, 6)

/** Буква K прямоугольниками (без искры): по ним тест проверяет, что лицо её не закрывает. */
export const MILLI_GLYPH_RECTS: readonly MilliBox[] = [...GLYPH_UPPER, ...GLYPH_LOWER]
/** Ствол и верхнее плечо буквы K. */
export const MILLI_FRAME = boxPath(GLYPH_UPPER)
/** Нижняя нога буквы K. */
export const MILLI_STEPS = boxPath(GLYPH_LOWER)
/** Голубая искра логотипа — клетка (6,0) буквы. Имя `NOSE` осталось от прежнего маскота. */
export const MILLI_NOSE: MilliBox = milliCell(6, 0)
export const MILLI_GLYPH_LIFT = 0
export const MILLI_SHADOW_SHIFT = 10
/** Тень буквы в знаке KonMin сдвинута на (8, 10). */
export const MILLI_SHADOW_SHIFT_X = 8

function centered(cell: MilliBox, w: number, h: number, dy = 0): MilliBox {
  return { x: cell.x + (cell.w - w) / 2, y: cell.y + (cell.h - h) / 2 + dy, w, h }
}

/**
 * Лицо → плитка: x' = s·x + dx, y' = s·y + dy. Глаза (в координатах лица 6…130 по высоте) ложатся
 * в верхнее поле знака над буквой, место улыбки — в нижнее поле под ней.
 */
export const MILLI_FACE_FIT = { s: 0.5, dx: 94, dy: 14 } as const
export function milliFaceToTile(b: MilliBox): MilliBox {
  const { s, dx, dy } = MILLI_FACE_FIT
  return { x: b.x * s + dx, y: b.y * s + dy, w: b.w * s, h: b.h * s }
}
/** Место улыбки в координатах лица: на плитке это полоса 305…341 под буквой, по центру. */
export const MILLI_MOUTH_CELL: MilliBox = { x: 188 - 44, y: 584, w: 88, h: 72 }
const BELOW = MILLI_MOUTH_CELL
const LEFT: MilliBox = { ...BELOW, x: BELOW.x - 96 }
const RIGHT: MilliBox = { ...BELOW, x: BELOW.x + 96 }

/**
 * Глаза в пиксельном аниме-стиле (владелец 30.09.2026 20:51: «большие красивые
 * аниме-глаза»): 42×56 на пиксельной сетке по 7 — выше клетки, вылезают вниз
 * в пустую клетку под собой (вверх нельзя: над правым глазом белая клетка); по бокам — белые клетки, туда глаз не
 * заходит. Тёмный зрачок в радужке из двух оттенков (светлый верх, тёмный низ),
 * большой блик слева сверху, маленький справа снизу, реснички у внешнего
 * верхнего угла.
 */
export const MILLI_EYE_SIZE = { w: 100, h: 124 } as const
export const MILLI_EYE_DY = 0
/**
 * Глаза на макушке (владелец 01.10.2026: «внятнее, в полтора-два раза больше,
 * кверху и по центру — половина выглядывает над телом, половина внутри»):
 * 100×124, по центру знака с зазором 14, середина глаза — на верхней кромке.
 * Логотип под ними не закрыт: скобка начинается ниже.
 */
const EYE_GAP = 14
const EYE_CX = MILLI_VIEW / 2
/** Верх глаза (07.10.2026, владелец: «глаза слишком высоко, задевают корону»): глаза целиком на теле, у верхней кромки. */
const EYE_TOP = 6
export const MILLI_EYES: readonly MilliBox[] = [
  { x: EYE_CX - EYE_GAP / 2 - MILLI_EYE_SIZE.w, y: EYE_TOP, w: MILLI_EYE_SIZE.w, h: MILLI_EYE_SIZE.h },
  { x: EYE_CX + EYE_GAP / 2, y: EYE_TOP, w: MILLI_EYE_SIZE.w, h: MILLI_EYE_SIZE.h },
]
/** Корона стоит над глазами: низ обода — на их верхней кромке. */
export const MILLI_CROWN_DY = EYE_TOP - 22
/** Большой блик — у верхнего левого края радужки. */
export const MILLI_GLINT = { dx: 17, dy: 24, size: 31 } as const
/** Второй, маленький блик — внизу справа. */
export const MILLI_GLINT2 = { dx: 66, dy: 83, size: 16 } as const
/** Радужка: от 33 до 117 по высоте глаза, с отступом 16 по бокам; верхняя половина светлее. */
export const MILLI_IRIS = { inset: 16, top: 33, bottom: 117 } as const
/** Зрачок — тёмный блок в середине радужки. */
export const MILLI_PUPIL = { dx: 34, dy: 51, w: 32, h: 48 } as const
/**
 * Реснички: два пикселя у верхнего внешнего угла, торчат за край глаза на
 * белую клетку (ink на белом читается). side: -1 — левый глаз (наружу влево), 1 — правый.
 */
export function milliLashes(eye: MilliBox, side: -1 | 1): MilliBox[] {
  const w = 10
  const x = side < 0 ? eye.x - w : eye.x + eye.w
  return [
    { x, y: eye.y + 10, w, h: 10 },
    { x: side < 0 ? x - 8 : x + 8, y: eye.y - 2, w: 10, h: 10 },
    { x: side < 0 ? x - 14 : x + 14, y: eye.y - 12, w: 9, h: 9 },
  ]
}
export const MILLI_CHEEKS: readonly MilliBox[] = [
  { x: LEFT.x + (LEFT.w - 26) / 2, y: BELOW.y + 4, w: 26, h: 9 },
  { x: RIGHT.x + (RIGHT.w - 26) / 2, y: BELOW.y + 4, w: 26, h: 9 },
]
/**
 * Росток на макушке (запоминающаяся деталь): стебель растёт из-под тела, два
 * листика ступеньками — правый выше. Рисуется ДО тела, корень спрятан.
 */
export const MILLI_SPROUT = {
  stem: { x: 300, y: -30, w: 12, h: 46 } as MilliBox,
  leafR: { x: 290, y: -62, w: 32, h: 32 } as MilliBox,
  leafL: { x: 328, y: -78, w: 14, h: 14 } as MilliBox,
} as const
export const MILLI_MOUTH_SHUT: MilliBox = centered(BELOW, 24, 8, -8)
export const MILLI_MOUTH_OPEN: MilliBox = centered(BELOW, 30, 24, -2)
export const MILLI_TONGUE: MilliBox = {
  x: MILLI_MOUTH_OPEN.x + 7,
  y: MILLI_MOUTH_OPEN.y + MILLI_MOUTH_OPEN.h - 10,
  w: 16,
  h: 10,
}

/** Счастливые глаза «^» из пикселей по 8: вершина и два плеча, шире глаза не выходят за клетку. */
export function milliJoy(eye: MilliBox): MilliBox[] {
  const cx = eye.x + eye.w / 2
  const p = 8
  const top = eye.y + (eye.h - 3 * p) / 2
  return [
    { x: cx - p / 2, y: top, w: p, h: p },
    { x: cx - p / 2 - p, y: top + p, w: p, h: p },
    { x: cx + p / 2, y: top + p, w: p, h: p },
    { x: cx - p / 2 - 2 * p, y: top + 2 * p, w: p, h: p },
    { x: cx + p / 2 + p, y: top + 2 * p, w: p, h: p },
  ]
}

/** Точки «думает» над правым верхним углом. */
export const MILLI_DOTS: readonly MilliBox[] = [
  { x: 332, y: -40, w: 20, h: 20 },
  { x: 356, y: -60, w: 20, h: 20 },
  { x: 380, y: -40, w: 20, h: 20 },
]

/**
 * Конечности. Корни (плечо, бедро) уходят под тело на 8–46 единиц: при любом
 * повороте ручки и при подскоке тела шва не видно.
 *
 * Плечо — y = 232, на уровне глаз: ручки растут из «щёк» знака, как у
 * игрушки-кубика. Поворот ручки — вокруг плеча (CSS: `transform-box: fill-box`,
 * `transform-origin` на внутреннем крае группы, см. `MILLI_SHOULDER_Y_PCT`).
 */
export interface MilliArm {
  arm: MilliBox
  hand: MilliBox
  /** Большой палец варежки — сверху, со стороны тела: без него белый квадрат не читается рукой. */
  thumb: MilliBox
}

export const MILLI_SHOULDER_Y = 238
const ARM = { w: 44, h: 40 } as const
const HAND = 54

function arm(side: 'l' | 'r'): MilliArm {
  // Короткая толстая ручка: 30 единиц торчит из тела, остальное — под ним.
  const armBox: MilliBox =
    side === 'l'
      ? { x: -30, y: MILLI_SHOULDER_Y - ARM.h / 2, w: ARM.w, h: ARM.h }
      : { x: MILLI_VIEW - 14, y: MILLI_SHOULDER_Y - ARM.h / 2, w: ARM.w, h: ARM.h }
  const hand: MilliBox =
    side === 'l'
      ? { x: armBox.x - HAND + 12, y: MILLI_SHOULDER_Y - HAND / 2, w: HAND, h: HAND }
      : { x: armBox.x + armBox.w - 12, y: MILLI_SHOULDER_Y - HAND / 2, w: HAND, h: HAND }
  const thumb: MilliBox =
    side === 'l' ? { x: hand.x + hand.w - 22, y: hand.y - 14, w: 18, h: 18 } : { x: hand.x + 4, y: hand.y - 14, w: 18, h: 18 }
  return { arm: armBox, hand, thumb }
}

export const MILLI_ARMS: { l: MilliArm; r: MilliArm } = { l: arm('l'), r: arm('r') }

/** Где в рамке группы ручки стоит плечо, по вертикали, в процентах (для transform-origin). */
export const MILLI_SHOULDER_Y_PCT = Math.round(
  ((MILLI_SHOULDER_Y - MILLI_ARMS.l.hand.y) / MILLI_ARMS.l.hand.h) * 100,
)

export interface MilliLeg {
  leg: MilliBox
  /** Белый кед, как перчатка; тёмная подошва — цвета глаз. */
  boot: MilliBox
  sole: MilliBox
}

function leg(x: number): MilliLeg {
  const legBox: MilliBox = { x, y: 330, w: 56, h: 84 }
  const boot: MilliBox = { x: x - 14, y: 400, w: 84, h: 42 }
  return { leg: legBox, boot, sole: { x: boot.x + 4, y: boot.y + boot.h - 12, w: boot.w - 8, h: 12 } }
}

/** Ножки стоят под белыми клетками низа скобки — симметрично относительно носа. */
export const MILLI_LEGS: readonly MilliLeg[] = [leg(98), leg(MILLI_VIEW - 98 - 56)]

/** Контур спрайта: та же фигура, раздутая на `by` во все стороны. */
export function milliGrow(b: MilliBox, by: number): MilliBox {
  return { x: b.x - by, y: b.y - by, w: b.w + by * 2, h: b.h + by * 2 }
}

/** Прямоугольник со срезанными на `n` углами — пиксельная «перчатка» и «ботинок». */
export function milliCut(b: MilliBox, n = 8): string {
  const { x, y, w, h } = b
  return `M${x + n} ${y}H${x + w - n}V${y + n}H${x + w}V${y + h - n}H${x + w - n}V${y + h}H${x + n}V${y + h - n}H${x}V${y + n}H${x + n}Z`
}

/** Всё, что рисуется, — внутри поля персонажа (проверяется тестом). */
export function milliExtent(): MilliBox {
  const parts: MilliBox[] = [
    { x: 0, y: 0, w: MILLI_VIEW, h: MILLI_VIEW },
    ...Object.values(MILLI_ARMS).flatMap((a) => [a.arm, a.hand]),
    ...MILLI_LEGS.flatMap((l) => [l.leg, l.boot]),
    ...MILLI_DOTS,
    MILLI_SPROUT.stem,
    MILLI_SPROUT.leafR,
    MILLI_SPROUT.leafL,
  ]
  const x = Math.min(...parts.map((p) => p.x))
  const y = Math.min(...parts.map((p) => p.y))
  const x2 = Math.max(...parts.map((p) => p.x + p.w))
  const y2 = Math.max(...parts.map((p) => p.y + p.h))
  return { x, y, w: x2 - x, h: y2 - y }
}

/* ── Анимация (04.10.2026): кадры, реакции, взгляд ─────────────────────────
 * Всё ниже — чистые функции и готовая геометрия: что рисовать в каждом кадре
 * и куда смотреть. Само движение — CSS-ключи со steps() в
 * styles/pixel/milli-mascot.css; таймеры и указатель — общий «режиссёр» в
 * Milli.tsx (один на все маскоты на странице).
 */

/** Пиксель движения: всё, что сдвигается, сдвигается шагами по 8 единиц (≈2 px при size 136). */
export const MILLI_PX = 8

/**
 * Разовые реакции поверх режима: `poke1…3` — тык мышкой (по кругу), `wake` —
 * проснулась, `hop` — прыжок с пылью, `spin` — праздничный оборот (сборка готова),
 * `wow` — «ух ты!» (что-то пролетело): глаза-точки, «!», подскок, взгляд следит.
 */
export type MilliCue = 'hop' | 'spin' | 'poke1' | 'poke2' | 'poke3' | 'wake' | 'wow'
/** То, что сейчас играет: режим или реакция. */
export type MilliState = Exclude<MilliMode, 'dance'> | MilliCue

/** Длина реакции — ровно длина её CSS-ключей. */
export const MILLI_CUE_MS: Readonly<Record<MilliCue, number>> = {
  hop: 1000,
  spin: 1600,
  poke1: 1000,
  poke2: 1100,
  poke3: 1200,
  wake: 800,
  wow: 900,
}

const POKES: readonly MilliCue[] = ['poke1', 'poke2', 'poke3']
/** n-й тык → одна из трёх реакций по кругу. */
export function milliPoke(n: number): MilliCue {
  return POKES[((Math.trunc(n) % 3) + 3) % 3] as MilliCue
}

/** Сколько покоя (без мыши и клавиатуры), пока Милли не задремлет. */
export const MILLI_SLEEP_AFTER = 45_000

/** Что играть: реакция важнее режима; спит только в покое. `dance` — это `happy`. */
export function milliState(mode: MilliMode, cue: MilliCue | null, asleep: boolean): MilliState {
  if (cue) return cue
  const m = mode === 'dance' ? 'happy' : mode
  return asleep && m === 'idle' ? 'sleep' : m
}

/** В каких состояниях глаза открыты и живут: моргают, следят за курсором. */
export function milliEyesLive(s: MilliState): boolean {
  return s === 'idle' || s === 'wave' || s === 'talk' || s === 'hop'
}

export interface MilliStep {
  x: number
  y: number
}

/**
 * Куда смотреть: вектор от глаз до цели (экранные px) → шаг зрачка −2…2 по
 * каждой оси. Рядом с Милли (ближе трети её размера) — прямо; дальше полутора
 * размеров — до упора. Квантуется, как в спрайте: зрачок прыгает по пикселям.
 */
export function milliGaze(dx: number, dy: number, size: number): MilliStep {
  const len = Math.hypot(dx, dy)
  if (!Number.isFinite(len) || len < Math.max(8, size * 0.3)) return { x: 0, y: 0 }
  const reach = len < size * 1.5 ? 1 : 2
  const clamp = (v: number) => Math.max(-2, Math.min(2, Math.round(v))) || 0
  return { x: clamp((dx / len) * reach), y: clamp((dy / len) * reach) }
}

/**
 * Сдвиги частей лица для шага взгляда (в единицах спрайта): зрачок — на пиксель
 * за шаг, радужка и всё лицо — на пиксель только при шаге 2 (параллакс: голова
 * чуть поворачивается за взглядом).
 */
export function milliGazeOffsets(g: MilliStep): { pupil: MilliStep; iris: MilliStep; face: MilliStep } {
  const half = (v: number) => Math.trunc(v / 2) * MILLI_PX || 0
  return {
    pupil: { x: g.x * MILLI_PX || 0, y: g.y * MILLI_PX || 0 },
    iris: { x: half(g.x), y: half(g.y) },
    face: { x: half(g.x), y: half(g.y) },
  }
}

/** Наклон к элементу под курсором: по горизонтальному смещению цели, 0/±3/±6°. */
export function milliLeanAngle(dx: number, size: number): number {
  const a = Math.abs(dx)
  if (!Number.isFinite(a) || a < Math.max(24, size * 0.4)) return 0
  return Math.sign(dx) * (a < size * 2.2 ? 3 : 6)
}

/** Следующий шаг наклона: по 3° за кадр, чтобы наклон шёл кадрами, а не рывком. */
export function milliLeanStep(cur: number, target: number): number {
  if (cur === target) return cur
  return cur + Math.sign(target - cur) * Math.min(3, Math.abs(target - cur))
}

/**
 * Когда моргнуть: через 2,4–6,8 с, каждый пятый раз — дважды подряд. `r1`, `r2`
 * — случайные 0…1 (Math.random в режиссёре, фиксированные в тестах).
 */
export function milliBlinkPlan(r1: number, r2: number): { wait: number; double: boolean } {
  return { wait: Math.round(2400 + r1 * 4400), double: r2 < 0.2 }
}

/**
 * Пиксельная картинка из строк: каждый символ, кроме `.`, — клетка `px`×`px`
 * своего цвета. Возвращает path на каждый символ; соседние клетки в строке
 * сливаются в один прямоугольник.
 */
export function milliPixels(rows: readonly string[], px: number, ox = 0, oy = 0): Record<string, string> {
  const out: Record<string, string> = {}
  rows.forEach((row, r) => {
    let c = 0
    while (c < row.length) {
      const ch = row[c] as string
      if (ch === '.' || ch === ' ') {
        c++
        continue
      }
      let e = c
      while (e < row.length && row[e] === ch) e++
      out[ch] = (out[ch] ?? '') + `M${ox + c * px} ${oy + r * px}h${(e - c) * px}v${px}h${-(e - c) * px}z`
      c = e
    }
  })
  return out
}

/** Зеркало пиксельной картинки по горизонтали (правый глаз — отражение левого). */
export function milliMirror(rows: readonly string[]): string[] {
  const w = Math.max(...rows.map((r) => r.length))
  return rows.map((r) => r.padEnd(w, '.').split('').reverse().join(''))
}

/** Размеры пиксельной картинки в клетках. */
export function milliPixelSize(rows: readonly string[]): { w: number; h: number } {
  return { w: Math.max(0, ...rows.map((r) => r.length)), h: rows.length }
}

/* Глаза-оверлеи (клетка 10, глаз 100 шириной): поверх скрытого обычного глаза. */
const EYE_PX = 10
/** «^^» — радость: дуга. */
export const MILLI_EYE_JOY = ['..XXXXXX..', '.XXXXXXXX.', 'XXX....XXX', 'XX......XX']
/** «‿‿» — сон: дуга вниз. */
export const MILLI_EYE_SLEEP = ['XX......XX', '.XXX..XXX.', '..XXXXXX..']
/** Закрытый глаз — средний кадр моргания. */
export const MILLI_EYE_SHUT = ['.XXXXXXXX.', 'XX......XX']
/** «><» — зажмурилась (тык). Левый глаз; правый — зеркало. */
export const MILLI_EYE_SQUEEZE = ['XX......', 'XXXX....', '..XXXX..', '....XXXX', '..XXXX..', 'XXXX....', 'XX......']

export type MilliEyeArt = 'joy' | 'sleep' | 'shut' | 'squeeze'
/** На сколько ниже кромки тела начинается оверлей глаза. */
export const MILLI_EYE_ART_TOP: Readonly<Record<MilliEyeArt, number>> = { joy: 16, sleep: 26, shut: 26, squeeze: 6 }
const EYE_ART: Record<MilliEyeArt, readonly string[]> = {
  joy: MILLI_EYE_JOY,
  sleep: MILLI_EYE_SLEEP,
  shut: MILLI_EYE_SHUT,
  squeeze: MILLI_EYE_SQUEEZE,
}

/** Оверлей глаза: path цвета ink, по центру глаза (side −1 — левый, 1 — правый). */
export function milliEyeArt(kind: MilliEyeArt, eye: MilliBox, side: -1 | 1): string {
  const rows = side > 0 && kind === 'squeeze' ? milliMirror(EYE_ART[kind]) : EYE_ART[kind]
  const { w } = milliPixelSize(rows)
  const ox = eye.x + (eye.w - w * EYE_PX) / 2
  // Верх глаза торчит над телом, на фоне ink не виден: закрытые глаза
  // рисуются на зелёном — ниже кромки тела (середины глаза).
  const oy = eye.y + eye.h / 2 + MILLI_EYE_ART_TOP[kind]
  return milliPixels(rows, EYE_PX, ox, oy).X ?? ''
}

/** Маленький зрачок — «удивилась» (проснулась). */
export const MILLI_PUPIL_SMALL = { dx: 40, dy: 63, w: 20, h: 24 } as const

/* Рты (клетка 7) в пустой клетке под носом: X — ink, T — язык. */
const MOUTH_PX = 7
export const MILLI_MOUTHS = {
  smile: ['X....X', '.XXXX.'],
  /** «хм» — кривая черта, когда думает. */
  hmm: ['XXX...', '..XXXX'],
  o: ['.XX.', 'XXXX', 'XTTX', '.XX.'],
  open: ['XXXXX', 'XXXXX', 'XTTTX', '.XXX.'],
  grin: ['XXXXXX', 'XXXXXX', 'XTTTTX', '.XTTX.'],
} as const
export type MilliMouth = keyof typeof MILLI_MOUTHS

/** Где лежит рот: по центру клетки под носом, на 2 ниже её верха. */
export function milliMouthBox(kind: MilliMouth): MilliBox {
  const { w, h } = milliPixelSize(MILLI_MOUTHS[kind])
  return { x: BELOW.x + (BELOW.w - w * MOUTH_PX) / 2, y: BELOW.y + 4, w: w * MOUTH_PX, h: h * MOUTH_PX }
}
export function milliMouth(kind: MilliMouth): Record<string, string> {
  const b = milliMouthBox(kind)
  return milliPixels(MILLI_MOUTHS[kind], MOUTH_PX, b.x, b.y)
}

/* ── Частицы — язык Minecraft ── */
/** Сердечко (как при кормлении животных): R — красный, W — блик, D — тень. */
export const MILLI_HEART = ['.RR.RR.', 'RWRRRRR', 'RRRRRRD', '.RRRRD.', '..RRD..', '...D...']
/** Нотка нотного блока. */
export const MILLI_NOTE = ['...NNN', '...N.N', '...N.N', '...N..', '.NNN..', 'NNNN..', '.NN...']
/** Буква сна. */
export const MILLI_Z = ['ZZZZZ', '...Z.', '..Z..', '.Z...', 'ZZZZZ']
/** Восклицание при пробуждении. */
export const MILLI_BANG = ['XX', 'XX', 'XX', 'XX', '..', 'XX']
/** Искра «довольного жителя» (зелёный плюсик). */
export const MILLI_SPARK = ['.G.', 'GWG', '.G.']
/** Облачко пыли при приземлении: L — светлое, D — тень. */
export const MILLI_PUFF = ['.LL', 'LLD', 'LDD']

/** Ноги стоят на y = 442 (низ подошвы); пыль — на уровне подошв. */
export const MILLI_GROUND = 442
/** Центр по горизонтали — ось прыжка и оборота. */
export const MILLI_CX = MILLI_VIEW / 2

export interface MilliParticle {
  x: number
  y: number
  /** Зеркало по горизонтали: частица летит влево. */
  flip?: boolean
  /** Вариант траектории/задержки — класс `is-<v>`. */
  v: 'a' | 'b' | 'c'
  s?: number
  r?: number
}

/** Пыль: по три облачка у каждой ноги, разлетаются в стороны. */
export const MILLI_DUST: readonly MilliParticle[] = [
  { x: 84, y: MILLI_GROUND - 22, flip: true, v: 'a' },
  { x: 110, y: MILLI_GROUND - 12, flip: true, v: 'b', s: 0.75 },
  { x: 70, y: MILLI_GROUND - 34, flip: true, v: 'c', s: 0.6 },
  { x: 292, y: MILLI_GROUND - 22, v: 'a' },
  { x: 266, y: MILLI_GROUND - 12, v: 'b', s: 0.75 },
  { x: 306, y: MILLI_GROUND - 34, v: 'c', s: 0.6 },
]

/** Искры тотема: кольцо из 16 искр вокруг центра тела, через одну дальше. */
export const MILLI_TOTEM: readonly MilliParticle[] = Array.from({ length: 16 }, (_, i) => ({
  x: MILLI_CX,
  y: 170,
  r: i * 22.5 + (i % 2 ? 9 : 0),
  v: (['a', 'b', 'c'] as const)[i % 3] as 'a' | 'b' | 'c',
  s: i % 4 === 0 ? 1.25 : 1,
}))

/** Зелёные искры радости вокруг. */
export const MILLI_SPARKS: readonly MilliParticle[] = [
  { x: -56, y: 60, v: 'a' },
  { x: 420, y: 100, v: 'b' },
  { x: -40, y: 300, v: 'c', s: 0.75 },
  { x: 410, y: 330, v: 'a', s: 0.75 },
  { x: 40, y: -60, v: 'b', s: 0.75 },
]

export const MILLI_HEARTS: readonly MilliParticle[] = [
  { x: 40, y: -50, v: 'a' },
  { x: 300, y: -70, v: 'b', s: 0.8 },
  { x: 380, y: 40, v: 'c', s: 0.65 },
]

export const MILLI_NOTES: readonly MilliParticle[] = [
  { x: -50, y: 100, v: 'a' },
  { x: 404, y: 70, v: 'b' },
  { x: 380, y: -40, v: 'c', s: 0.75 },
]

/** Буквы сна: снизу вверх-вправо, каждая следующая крупнее. */
export const MILLI_ZZZ: readonly MilliParticle[] = [
  { x: 330, y: -20, v: 'a', s: 0.7 },
  { x: 330, y: -20, v: 'b', s: 0.9 },
  { x: 330, y: -20, v: 'c', s: 1.1 },
]

/** Тень под ногами (ступенчатая плашка). */
export const MILLI_SHADOW = `M${MILLI_CX - 80} ${MILLI_GROUND + 2}h160v8h-160zM${MILLI_CX - 64} ${MILLI_GROUND + 10}h128v6h-128z`

/** Шаг слежения: «как давно» считается свежим курсор или ввод. */
export const MILLI_GAZE_FRESH = 6000
