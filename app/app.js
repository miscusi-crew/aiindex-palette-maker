"use strict";
const KEY = "palette-maker-saved";
const $ = (id) => document.getElementById(id);
let colors = Array(5).fill("#cccccc");
let locked = Array(5).fill(false);
let saved = load();

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* private mode */ }
}

function hsl(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}

const rand = (a, b) => a + Math.random() * (b - a);

/** Hues for a scheme around a random base hue; lightness spreads from dark to light. */
function generate() {
  const schemes = ["analogous", "complementary", "triadic", "mono"];
  const scheme = $("scheme").value === "any" ? schemes[Math.floor(Math.random() * schemes.length)] : $("scheme").value;
  const base = rand(0, 360);
  const offsets = {
    analogous: [-40, -20, 0, 20, 40],
    complementary: [0, 10, 180, 190, 0],
    triadic: [0, 120, 240, 0, 120],
    mono: [0, 0, 0, 0, 0],
  }[scheme];
  const lights = [22, 38, 55, 72, 88].sort(() => (scheme === "mono" ? 0 : Math.random() - 0.5));
  colors = colors.map((c, i) => {
    if (locked[i]) return c;
    const s = scheme === "mono" ? rand(35, 60) : rand(45, 80);
    return hsl((base + offsets[i] + rand(-6, 6) + 360) % 360, s, lights[i] + rand(-4, 4));
  });
  render();
}

/** Black or white text, whichever reads better on this colour. */
function textOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#111111" : "#ffffff";
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Some embedded pages can't use the Clipboard API; fall back to a hidden text field.
    const t = document.createElement("textarea");
    t.value = text;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.append(t);
    t.select();
    const ok = document.execCommand("copy");
    t.remove();
    if (!ok) throw new Error("copy failed");
  }
}

function render() {
  $("palette").replaceChildren(
    ...colors.map((c, i) => {
      const sw = document.createElement("div");
      sw.className = "swatch";
      sw.style.background = c;
      sw.style.color = textOn(c);
      const hex = document.createElement("button");
      hex.className = "hex";
      hex.style.cssText = "border:0;background:transparent;color:inherit;font:inherit;font-weight:700";
      hex.textContent = c.toUpperCase();
      hex.setAttribute("aria-label", `Copy ${c.toUpperCase()}`);
      hex.addEventListener("click", async () => {
        try {
          await copy(c.toUpperCase());
          $("msg").textContent = `Copied ${c.toUpperCase()}`;
        } catch {
          $("msg").textContent = `Couldn't copy. The code is ${c.toUpperCase()}.`;
        }
      });
      const lock = document.createElement("button");
      lock.className = "lock";
      lock.textContent = locked[i] ? "Locked" : "Lock";
      lock.setAttribute("aria-pressed", String(locked[i]));
      lock.addEventListener("click", () => {
        locked[i] = !locked[i];
        render();
      });
      sw.append(hex, lock);
      return sw;
    }),
  );
  renderSaved();
}

function renderSaved() {
  if (!saved.length) {
    const p = document.createElement("p");
    p.className = "sub";
    p.textContent = "Nothing saved yet.";
    $("saved").replaceChildren(p);
    return;
  }
  $("saved").replaceChildren(
    ...saved.map((pal, i) => {
      const row = document.createElement("div");
      row.className = "mini";
      const chips = document.createElement("button");
      chips.className = "chips";
      chips.setAttribute("aria-label", `Load palette ${pal.join(", ")}`);
      for (const c of pal) {
        const s = document.createElement("span");
        s.style.background = c;
        chips.append(s);
      }
      chips.addEventListener("click", () => {
        colors = [...pal];
        locked = Array(5).fill(false);
        render();
      });
      const x = document.createElement("button");
      x.className = "x";
      x.textContent = "✕";
      x.setAttribute("aria-label", "Delete this palette");
      x.addEventListener("click", () => {
        saved.splice(i, 1);
        persist();
        renderSaved();
      });
      row.append(chips, x);
      return row;
    }),
  );
}

$("gen").addEventListener("click", generate);
$("save").addEventListener("click", () => {
  if (saved.some((p) => p.join() === colors.join())) {
    $("msg").textContent = "Already saved.";
    return;
  }
  saved.unshift([...colors]);
  saved = saved.slice(0, 30);
  persist();
  renderSaved();
  $("msg").textContent = "Saved.";
});
document.addEventListener("keydown", (e) => {
  if (e.key === " " && (e.target === document.body || e.target.closest(".palette"))) {
    e.preventDefault();
    generate();
  }
});
generate();
