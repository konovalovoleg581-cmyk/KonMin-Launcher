// Короткий «пиксельный» щелчок через WebAudio (без аудиофайлов).
let ctx: AudioContext | null = null;

export function click(enabled: boolean, freq = 660) {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.1);
  } catch {
    /* звук недоступен — не важно */
  }
}
