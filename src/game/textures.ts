import * as THREE from "three";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function noise(g: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[], size = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    g.globalAlpha = 0.15 + Math.random() * 0.35;
    g.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
  g.globalAlpha = 1;
}

function tex(c: HTMLCanvasElement, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  return t;
}

export function asphalt(rx: number, ry: number) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = "#47474d";
  g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, 9000, ["#2c2c30", "#5d5d63", "#3a3a3f", "#6c6a66"], 2);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = "rgba(20,20,22,0.25)";
    g.beginPath();
    g.ellipse(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 30, 6 + Math.random() * 14, Math.random() * 3, 0, 7);
    g.fill();
  }
  g.strokeStyle = "rgba(25,25,25,0.5)";
  g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    let x = Math.random() * 256, y = Math.random() * 256;
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) g.lineTo((x += (Math.random() - 0.5) * 30), (y += (Math.random() - 0.5) * 30));
    g.stroke();
  }
  return tex(c, rx, ry);
}

export function pavement(rx: number, ry: number) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = "#bdb4a5";
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const v = 175 + Math.random() * 30;
      g.fillStyle = `rgb(${v},${v - 6},${v - 18})`;
      g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
    }
  noise(g, 256, 256, 4000, ["#8f8778", "#d8d0c0"], 1.5);
  return tex(c, rx, ry);
}

export function ground(rx: number, ry: number, base: string, specks: string[]) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, 12000, specks, 3);
  return tex(c, rx, ry);
}

/** One storey-bay tile: 4m wide x 3.5m tall. Repeated in world units via shader. */
export function facade() {
  const [c, g] = canvas(128, 112);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 128, 112);
  noise(g, 128, 112, 900, ["#d8d2c8", "#eae6df", "#c9c2b6"], 2);
  // floor ledge
  g.fillStyle = "#cfc8bc";
  g.fillRect(0, 100, 128, 12);
  g.fillStyle = "#a59d90";
  g.fillRect(0, 98, 128, 3);
  // window frame + glass with sky gradient reflection
  g.fillStyle = "#8a8378";
  g.fillRect(22, 22, 84, 64);
  const gr = g.createLinearGradient(0, 26, 0, 82);
  gr.addColorStop(0, "#9fc3d6");
  gr.addColorStop(0.55, "#3f5a6b");
  gr.addColorStop(1, "#24323c");
  g.fillStyle = gr;
  g.fillRect(26, 26, 76, 56);
  g.fillStyle = "#8a8378";
  g.fillRect(62, 26, 4, 56);
  g.fillStyle = "rgba(255,255,255,0.18)";
  g.beginPath();
  g.moveTo(30, 80); g.lineTo(50, 26); g.lineTo(60, 26); g.lineTo(40, 80);
  g.fill();
  // burglar-proof grille (Lagos staple)
  g.fillStyle = "#2b2b2b";
  for (let x = 30; x < 102; x += 8) g.fillRect(x, 24, 2, 60);
  g.fillRect(24, 40, 80, 2);
  g.fillRect(24, 64, 80, 2);
  // AC unit
  g.fillStyle = "#e4e4e0";
  g.fillRect(84, 74, 18, 12);
  g.fillStyle = "#9a9a96";
  for (let i = 0; i < 4; i++) g.fillRect(86, 76 + i * 3, 14, 1);
  // rain stain under window
  const st = g.createLinearGradient(0, 86, 0, 100);
  st.addColorStop(0, "rgba(90,80,70,0.35)");
  st.addColorStop(1, "rgba(90,80,70,0)");
  g.fillStyle = st;
  g.fillRect(24, 86, 80, 14);
  weather(g, 128, 112);
  const t = tex(c);
  t.anisotropy = 4;
  return t;
}

/** Ground-floor shop band: roll-up metal shutters + painted shop signs. */
export function shopfront() {
  const [c, g] = canvas(256, 64);
  const signs = ["PHARMACY", "LAW CHAMBERS", "POS", "PHONES", "CHOP BAR", "PROVISIONS", "BDC", "SALON"];
  const cols = ["#d62828", "#1d4ed8", "#0b6e4f", "#f4a261", "#7b2cbf", "#e9c46a"];
  for (let k = 0; k < 2; k++) {
    const x0 = k * 128;
    g.fillStyle = cols[(Math.random() * cols.length) | 0];
    g.fillRect(x0, 0, 128, 18);
    g.fillStyle = "#fff";
    g.font = "bold 12px Impact, sans-serif";
    g.textAlign = "center";
    g.fillText(signs[(Math.random() * signs.length) | 0], x0 + 64, 14);
    g.fillStyle = "#9aa0a4";
    g.fillRect(x0 + 6, 18, 116, 46);
    g.fillStyle = "#7c8287";
    for (let y = 20; y < 64; y += 3) g.fillRect(x0 + 6, y, 116, 1);
    g.fillStyle = "#555";
    g.fillRect(x0, 18, 6, 46);
  }
  return tex(c);
}

/** Make box UVs repeat per world metre on instanced buildings (tile = 4m x 3.5m). */
export function worldUVFacade(m: THREE.Material) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace(
      "#include <uv_vertex>",
      `#include <uv_vertex>
      #ifdef USE_INSTANCING
        vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vec2 rep = abs(normal.x) > 0.5 ? vec2(sc.z, sc.y) : abs(normal.y) > 0.5 ? vec2(0.0) : vec2(sc.x, sc.y);
        vMapUv = uv * rep / vec2(4.0, 3.5);
      #endif`,
    );
  };
}

/** Curtain-wall glass bay (banks, offices): tinted reflective panes, aluminium mullions, spandrel band. */
export function glassFacade(top: string, mid: string, low: string, frame = "#c9ced3") {
  const [c, g] = canvas(128, 112);
  const gr = g.createLinearGradient(0, 0, 128, 112);
  gr.addColorStop(0, top); gr.addColorStop(0.5, mid); gr.addColorStop(1, low);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 112);
  g.fillStyle = "rgba(255,255,255,0.12)";
  g.beginPath(); g.moveTo(0, 90); g.lineTo(70, 0); g.lineTo(100, 0); g.lineTo(20, 112); g.lineTo(0, 112); g.fill();
  g.fillStyle = frame;
  g.fillRect(0, 0, 128, 3); g.fillRect(0, 92, 128, 20);
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, 95, 128, 2);
  g.fillStyle = frame;
  for (const x of [0, 42, 84, 125]) g.fillRect(x, 0, 3, 112);
  g.fillRect(0, 46, 128, 2);
  return tex(c);
}

/** Lagos flat-block bay: plastered wall, louvred window with burglar-proof grille, balcony with railing and laundry. */
export function residentialFacade() {
  const [c, g] = canvas(128, 112);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 128, 112);
  noise(g, 128, 112, 1400, ["#d6cfc2", "#ebe5da", "#bdb4a4"], 2);
  // louvre window
  g.fillStyle = "#6d5a44"; g.fillRect(14, 18, 46, 52);
  for (let y = 22; y < 68; y += 5) { g.fillStyle = y % 10 ? "#9db4c0" : "#c6d6dd"; g.fillRect(18, y, 38, 3); }
  g.fillStyle = "#1e1e1e";
  for (let x = 18; x < 58; x += 6) g.fillRect(x, 18, 1.5, 52);
  // balcony door + slab + railing
  g.fillStyle = "#7a4e2d"; g.fillRect(74, 14, 38, 64);
  g.fillStyle = "#5b3920"; g.fillRect(92, 14, 2, 64);
  g.fillStyle = "#cfc6b7"; g.fillRect(66, 78, 56, 6);
  g.fillStyle = "#2a2a2a";
  g.fillRect(66, 58, 56, 2);
  for (let x = 68; x < 122; x += 5) g.fillRect(x, 58, 1.5, 20);
  // laundry line
  g.strokeStyle = "#333"; g.lineWidth = 1; g.beginPath(); g.moveTo(66, 46); g.lineTo(122, 46); g.stroke();
  const cl = ["#e63946", "#2a9d8f", "#ffb703", "#f1faee", "#457b9d", "#8338ec"];
  for (let x = 70; x < 118; x += 10) { g.fillStyle = cl[(Math.random() * cl.length) | 0]; g.fillRect(x, 46, 7, 9 + Math.random() * 6); }
  // AC + stains
  g.fillStyle = "#e4e4e0"; g.fillRect(20, 76, 20, 12);
  g.fillStyle = "#9a9a96"; for (let i = 0; i < 4; i++) g.fillRect(22, 78 + i * 3, 16, 1);
  const st = g.createLinearGradient(0, 84, 0, 112);
  st.addColorStop(0, "rgba(80,70,60,0.35)"); st.addColorStop(1, "rgba(80,70,60,0)");
  g.fillStyle = st; g.fillRect(66, 84, 56, 28);
  g.fillStyle = "#b9b0a1"; g.fillRect(0, 104, 128, 8);
  weather(g, 128, 112);
  return tex(c);
}

/** Hotel bay: warm-lit rooms behind floor-to-ceiling glass, cantilevered balcony and glass balustrade. */
export function hotelFacade() {
  const [c, g] = canvas(128, 112);
  g.fillStyle = "#efe7da"; g.fillRect(0, 0, 128, 112);
  const gr = g.createLinearGradient(0, 10, 0, 90);
  gr.addColorStop(0, "#f6d7a0"); gr.addColorStop(1, "#8a6a48");
  g.fillStyle = gr; g.fillRect(10, 10, 108, 80);
  g.fillStyle = "#3b2f25"; g.fillRect(62, 10, 4, 80);
  g.fillStyle = "rgba(255,240,200,0.5)"; g.fillRect(20, 20, 30, 22);
  g.fillStyle = "rgba(170,210,220,0.5)"; g.fillRect(6, 70, 116, 20);
  g.fillStyle = "#d9d0c0"; g.fillRect(4, 90, 120, 10);
  g.fillStyle = "#bdb39f"; g.fillRect(4, 100, 120, 2);
  return tex(c);
}

/** Brand signboard: house-colour panel, logo badge with the brand initial(s), and the name. */
export function signTexture(text: string, bg: string, fg: string, w = 512, h = 128, accent?: string, mark?: string, markFg?: string) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const font = (s: number) => `900 ${s}px Bungee, Impact, sans-serif`;
  let left = 30;
  if (accent) {
    g.fillStyle = accent; g.fillRect(0, h - 10, w, 10);
    const bs = h - 34;
    g.fillStyle = accent;
    g.beginPath(); g.roundRect(12, 12, bs, bs, 14); g.fill();
    if (mark) {
      g.fillStyle = markFg ?? bg;
      let ms = Math.floor(bs * 0.7);
      g.font = font(ms);
      while (g.measureText(mark).width > bs - 12 && ms > 10) g.font = font((ms -= 2));
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(mark, 12 + bs / 2, 12 + bs / 2 + 2);
    }
    left = bs + 24;
  }
  g.fillStyle = fg;
  let size = Math.floor(h * 0.42);
  g.font = font(size);
  const maxW = w - left - 16;
  while (g.measureText(text).width > maxW && size > 12) g.font = font((size -= 2));
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, left + maxW / 2, h * 0.47);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Rusted corrugated zinc sheet: vertical ridges, rust blooms, sheet overlaps. Tinted per instance. */
export function corrugatedZinc() {
  const [c, g] = canvas(128, 128);
  for (let x = 0; x < 128; x++) {
    const v = 200 + Math.sin((x / 128) * Math.PI * 32) * 45;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(x, 0, 1, 128);
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 128, y = Math.random() * 128, r = 3 + Math.random() * 12;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(110,50,20,0.55)"); gr.addColorStop(1, "rgba(110,50,20,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.fillStyle = "rgba(40,30,20,0.5)";
  g.fillRect(0, 62, 128, 2);
  noise(g, 128, 128, 800, ["#5a3a24", "#d0d0d0", "#3a2a1c"], 1);
  return tex(c, 4, 2);
}

/** Tropical weathering: rain runoff streaks from the top and rising damp at the base. */
function weather(g: CanvasRenderingContext2D, w: number, h: number) {
  for (let i = 0; i < 9; i++) {
    const x = Math.random() * w, sw = 2 + Math.random() * 6, len = h * (0.25 + Math.random() * 0.6);
    const gr = g.createLinearGradient(0, 0, 0, len);
    gr.addColorStop(0, "rgba(60,55,45,0.35)"); gr.addColorStop(1, "rgba(60,55,45,0)");
    g.fillStyle = gr; g.fillRect(x, 0, sw, len);
  }
  const d = g.createLinearGradient(0, h, 0, h * 0.8);
  d.addColorStop(0, "rgba(70,80,50,0.35)"); d.addColorStop(1, "rgba(70,80,50,0)");
  g.fillStyle = d; g.fillRect(0, h * 0.8, w, h * 0.2);
}
export { weather as _weather };
