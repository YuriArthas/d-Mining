import { REVISION, type WebGLRenderer } from 'three';

/** What the "report performance" button (bottom left, PerformanceReportButton) sends to the public host, which keeps
 *  it in d-game1/data/mining-reports/ (docs/phase-performance-report-20261028.md):
 *  - every animation frame of the last 1800 (30 s at 60 Hz): time, interval, update CPU, drawn or not, draws, triangles;
 *  - one row per second for the last 3 minutes: frame rate, worst frame, CPU, GPU waits, where the player stood, JS heap;
 *  - the browser's long tasks and long animation frames (Chromium), with the scripts that ran in them;
 *  - the device: browser and model hints, GPU, screen and pixel ratio, cores and memory.
 *  Recording is a few typed-array writes per frame; the report is put together only when the button is pressed. */
const FRAMES = 1800, SECONDS = 180, LONG_TASKS = 300, ANIMATION_FRAMES = 60;
/** A pause longer than this (tab hidden, a debugger) is a gap between runs, not a slow frame. */
const GAP_MS = 1000;
/** A frame interval past this missed at least one 60 Hz refresh. */
const MISSED_MS = 25;
const DRAWN = 1, SCHEDULED = 2, GAP = 4;
export const PERFORMANCE_REPORT_PATH = '/api/mining/performance-reports';

export type ReportSource = {
  renderer: WebGLRenderer;
  /** Where the player stands; read once a second. */
  where(): { place: string; position: readonly number[] | null };
  /** Settings and game state for the report; read when the button is pressed. */
  game(): Record<string, unknown>;
  /** The debug panel's A/B mode (normal, unlit, low-resolution…), kept per second so a run of the probe shows
   *  which change removes the missed frames. */
  probe?(): string;
};
type Second = { start: number; ticks: number; drawn: number; scheduled: number; waited: number; worst: number; slow: number; cpu: number; cpuMax: number; calls: number; triangles: number };
type ScriptTiming = { duration: number; invoker: string; invokerType: string; sourceURL: string; sourceFunctionName: string; sourceCharPosition: number; forcedStyleAndLayoutDuration: number };
type AnimationFrameTiming = PerformanceEntry & { blockingDuration: number; renderStart: number; styleAndLayoutStart: number; scripts: ScriptTiming[] };

const round = (value: number, places = 2) => { const f = 10 ** places; return Math.round(value * f) / f; };
/** Nearest-rank percentile of an ascending list. */
const rank = (sorted: readonly number[], p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p / 100 * sorted.length) - 1)] : null;
const spread = (values: number[]) => {
  const sorted = values.sort((a, b) => a - b);
  return { p50: rank(sorted, 50), p90: rank(sorted, 90), p95: rank(sorted, 95), p99: rank(sorted, 99), max: sorted.at(-1) ?? null };
};
const heapMB = () => {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return memory ? round(memory.usedJSHeapSize / 2 ** 20, 1) : null;
};

export class PerformanceRecorder {
  readonly sessionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : '00000000-0000-4000-8000-000000000000';
  private readonly at = new Float64Array(FRAMES);
  private readonly interval = new Float32Array(FRAMES);
  private readonly cpu = new Float32Array(FRAMES);
  private readonly flags = new Uint8Array(FRAMES);
  private readonly calls = new Uint16Array(FRAMES);
  private readonly triangles = new Uint32Array(FRAMES);
  private head = 0; private count = 0; private last = 0;
  private second: Second = PerformanceRecorder.emptySecond(0);
  private readonly seconds: Record<string, unknown>[] = [];
  private readonly longTasks: number[][] = [];
  private readonly animationFrames: Record<string, unknown>[] = [];
  private source: ReportSource | null = null;
  private observers: PerformanceObserver[] = [];

  private static emptySecond(start: number): Second {
    return { start, ticks: 0, drawn: 0, scheduled: 0, waited: 0, worst: 0, slow: 0, cpu: 0, cpuMax: 0, calls: 0, triangles: 0 };
  }

  /** The running game; returns the detach. Long tasks are observed while a game is attached. */
  attach(source: ReportSource) {
    this.source = source;
    this.observe();
    return () => {
      if (this.source !== source) return;
      this.source = null;
      for (const observer of this.observers) observer.disconnect();
      this.observers = [];
    };
  }

  /** One animation frame: `scheduled` when the render cap let it run, `drawn` when a frame was submitted, `cpuMs` the
   *  update and submit time on the main thread. */
  record(now: number, scheduled: boolean, cpuMs: number, drawn: boolean, calls: number, triangles: number) {
    const interval = this.last ? now - this.last : 0, gap = interval > GAP_MS;
    this.last = now;
    const i = this.head;
    this.head = (i + 1) % FRAMES; this.count = Math.min(this.count + 1, FRAMES);
    this.at[i] = now; this.interval[i] = interval; this.cpu[i] = cpuMs;
    this.flags[i] = (drawn ? DRAWN : 0) | (scheduled ? SCHEDULED : 0) | (gap ? GAP : 0);
    this.calls[i] = Math.min(calls, 65535); this.triangles[i] = triangles;
    const s = this.second;
    if (gap || !s.start) { this.second = PerformanceRecorder.emptySecond(now); return; }
    s.ticks++; s.worst = Math.max(s.worst, interval); if (interval > MISSED_MS) s.slow++;
    if (scheduled) { s.scheduled++; s.cpu += cpuMs; s.cpuMax = Math.max(s.cpuMax, cpuMs); if (!drawn) s.waited++; }
    if (drawn) { s.drawn++; s.calls = calls; s.triangles = triangles; }
    const elapsed = now - s.start;
    if (elapsed < 1000) return;
    const where = this.source?.where();
    this.seconds.push({
      t: round(s.start / 1000, 1), fps: round(s.drawn * 1000 / elapsed, 1), worstMs: round(s.worst, 1), slow: s.slow, probe: this.source?.probe?.() ?? 'normal',
      cpuMs: round(s.scheduled ? s.cpu / s.scheduled : 0), cpuMaxMs: round(s.cpuMax, 1), gpuWait: s.waited,
      calls: s.calls, triangles: s.triangles, heapMB: heapMB(),
      place: where?.place ?? '', position: where?.position?.map(v => round(v, 1)) ?? null,
    });
    if (this.seconds.length > SECONDS) this.seconds.shift();
    this.second = PerformanceRecorder.emptySecond(now);
  }

  private observe() {
    if (this.observers.length || typeof PerformanceObserver === 'undefined') return;
    const types = PerformanceObserver.supportedEntryTypes ?? [];
    const watch = (type: string, take: (entries: PerformanceEntryList) => void) => {
      if (!types.includes(type)) return;
      const observer = new PerformanceObserver(list => take(list.getEntries()));
      observer.observe({ type, buffered: true });
      this.observers.push(observer);
    };
    watch('longtask', entries => {
      for (const e of entries) this.longTasks.push([round(e.startTime, 1), round(e.duration, 1)]);
      this.longTasks.splice(0, Math.max(0, this.longTasks.length - LONG_TASKS));
    });
    // Long animation frames name the scripts that ran in them (Chromium 123+).
    watch('long-animation-frame', entries => {
      for (const e of entries as AnimationFrameTiming[]) this.animationFrames.push({
        t: round(e.startTime, 1), ms: round(e.duration, 1), blockingMs: round(e.blockingDuration, 1),
        renderStartMs: e.renderStart ? round(e.renderStart - e.startTime, 1) : null,
        styleLayoutStartMs: e.styleAndLayoutStart ? round(e.styleAndLayoutStart - e.startTime, 1) : null,
        scripts: [...e.scripts].sort((a, b) => b.duration - a.duration).slice(0, 4).map(s => ({
          ms: round(s.duration, 1), invoker: s.invoker.slice(0, 120), type: s.invokerType, forcedLayoutMs: round(s.forcedStyleAndLayoutDuration, 1),
          source: `${s.sourceURL.split('/').pop()?.slice(0, 80) ?? ''}:${s.sourceFunctionName.slice(0, 60)}:${s.sourceCharPosition}`,
        })),
      });
      this.animationFrames.splice(0, Math.max(0, this.animationFrames.length - ANIMATION_FRAMES));
    });
  }

  /** The frames in order, oldest first. */
  private *frames() {
    for (let n = 0; n < this.count; n++) yield (this.head - this.count + n + FRAMES) % FRAMES;
  }

  private summary() {
    const frameMs: number[] = [], cpu: number[] = [], raf: number[] = [];
    let drawn = 0, scheduled = 0, waited = 0, lastDrawn = -1, span = 0;
    for (const i of this.frames()) {
      const f = this.flags[i];
      if (f & GAP || !this.interval[i]) { lastDrawn = -1; continue; }
      span += this.interval[i]; raf.push(this.interval[i]);
      if (f & SCHEDULED) { scheduled++; cpu.push(this.cpu[i]); if (!(f & DRAWN)) waited++; }
      if (f & DRAWN) { drawn++; if (lastDrawn >= 0) frameMs.push(this.at[i] - lastDrawn); lastDrawn = this.at[i]; }
    }
    const from = this.count ? this.at[(this.head - this.count + FRAMES) % FRAMES] : 0;
    const tasks = this.longTasks.filter(([start]) => start >= from);
    const slow = (ms: number) => frameMs.filter(v => v > ms).length;
    const fix = (o: Record<string, number | null>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === null ? null : round(v)]));
    const rafMedian = spread(raf).p50;
    return {
      seconds: round(span / 1000, 1), frames: drawn, fps: span ? round(drawn * 1000 / span, 1) : 0,
      refreshHz: rafMedian ? round(1000 / rafMedian, 1) : null,
      frameMs: fix(spread(frameMs)),
      slowFrames: { over33ms: slow(33.4), over50ms: slow(50), over100ms: slow(100), over250ms: slow(250) },
      updateCpuMs: fix(spread(cpu)),
      gpuWaitPercent: scheduled ? round(100 * waited / scheduled, 1) : 0,
      longTasks: { count: tasks.length, totalMs: round(tasks.reduce((n, [, ms]) => n + ms, 0), 1), maxMs: tasks.reduce((n, [, ms]) => Math.max(n, ms), 0) },
    };
  }

  /** The report for the button; throws when no game is running. */
  async report() {
    const source = this.source;
    if (!source) throw new Error('game not running');
    const rows: number[][] = [];
    for (const i of this.frames()) rows.push([round(this.at[i], 1), round(this.interval[i]), round(this.cpu[i]), this.flags[i], this.calls[i], this.triangles[i]]);
    return {
      schemaVersion: 1, project: 'mining', capturedAt: new Date().toISOString(), sessionId: this.sessionId,
      build: { page: location.href, module: import.meta.url, three: REVISION },
      device: await deviceInfo(source.renderer),
      render: renderInfo(source.renderer),
      game: { ...source.where(), ...source.game(), uptimeSeconds: round(performance.now() / 1000, 1), heapMB: heapMB() },
      summary: this.summary(),
      frames: { columns: ['t', 'interval', 'cpu', 'flags', 'calls', 'triangles'], flags: { drawn: DRAWN, scheduled: SCHEDULED, gap: GAP }, rows },
      seconds: [...this.seconds],
      longTasks: [...this.longTasks],
      animationFrames: [...this.animationFrames],
    };
  }
}

type UserAgentData = { brands: { brand: string; version: string }[]; mobile: boolean; platform: string; getHighEntropyValues(hints: string[]): Promise<Record<string, unknown>> };
type NavigatorHints = Navigator & {
  userAgentData?: UserAgentData; deviceMemory?: number;
  connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
};

/** Browser, model hints (Chromium on Android names the phone model), GPU and screen. */
async function deviceInfo(renderer: WebGLRenderer) {
  const nav = navigator as NavigatorHints, ua = nav.userAgentData;
  const hints = await ua?.getHighEntropyValues(['model', 'platformVersion', 'architecture', 'bitness', 'fullVersionList', 'formFactors']).catch(() => null);
  const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
  const supported = gl.getSupportedExtensions() ?? [];
  // WebGPU's adapter names the GPU family where WebGL only says "Apple GPU" (Safari); never wait on it for long.
  const adapter = nav.gpu ? await Promise.race([
    nav.gpu.requestAdapter().then(a => a ? { vendor: a.info.vendor, architecture: a.info.architecture, device: a.info.device, description: a.info.description } : null).catch(() => null),
    new Promise<null>(resolve => setTimeout(() => resolve(null), 800)),
  ]) : null;
  return {
    userAgent: navigator.userAgent,
    userAgentData: ua ? { brands: ua.brands, mobile: ua.mobile, platform: ua.platform, ...hints } : null,
    platform: navigator.platform, language: navigator.language,
    cores: navigator.hardwareConcurrency ?? null, memoryGB: nav.deviceMemory ?? null, touchPoints: navigator.maxTouchPoints,
    pointer: matchMedia('(pointer: coarse)').matches ? 'coarse' : 'fine',
    screen: { width: screen.width, height: screen.height, dpr: devicePixelRatio, orientation: screen.orientation?.type ?? null },
    viewport: { width: innerWidth, height: innerHeight, scale: globalThis.visualViewport?.scale ?? 1 },
    connection: nav.connection ? { type: nav.connection.effectiveType ?? null, downlinkMbps: nav.connection.downlink ?? null, rttMs: nav.connection.rtt ?? null, saveData: nav.connection.saveData ?? null } : null,
    gpu: {
      vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION), maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      extensions: supported.length,
      compressedTextures: ['astc', 'etc', 's3tc', 'bptc', 'pvrtc'].filter(f => supported.some(e => e.includes(f))),
      timerQuery: supported.includes('EXT_disjoint_timer_query_webgl2'), parallelShaderCompile: supported.includes('KHR_parallel_shader_compile'),
      webgpuAdapter: adapter,
    },
  };
}

/** The drawing buffer and what the last frame drew. */
function renderInfo(renderer: WebGLRenderer) {
  const gl = renderer.getContext(), canvas = renderer.domElement;
  return {
    bufferWidth: gl.drawingBufferWidth, bufferHeight: gl.drawingBufferHeight, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight,
    pixelRatio: renderer.getPixelRatio(), antialias: gl.getContextAttributes()?.antialias ?? null, samples: gl.getParameter(gl.SAMPLES),
    calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length ?? 0,
    toneMapping: renderer.toneMapping, shadowMap: renderer.shadowMap.enabled,
  };
}

/** The one recorder for the page: the scene feeds it, the button reads it. */
export const performanceRecorder = new PerformanceRecorder();

/** Sends a report to the public host; resolves with the report id. */
export async function sendPerformanceReport(): Promise<string> {
  const response = await fetch(PERFORMANCE_REPORT_PATH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await performanceRecorder.report()) });
  const reply = await response.json().catch(() => null) as { ok?: boolean; id?: string; error?: string } | null;
  if (!response.ok || !reply?.ok || !reply.id) throw new Error(reply?.error ?? `HTTP ${response.status}`);
  return reply.id;
}
