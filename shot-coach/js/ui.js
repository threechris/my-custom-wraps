import { renderShotCard } from "./overlay.js";
import { sessionTrends } from "./coach.js";
import { PROS, COMPARE_METRICS, averageMetrics } from "./pros.js";

const STATUS_META = {
  good: { icon: "✓", word: "Good" },
  warn: { icon: "△", word: "Work on" },
  bad: { icon: "✕", word: "Fix" },
  na: { icon: "—", word: "n/a" },
};

const $ = (sel) => document.querySelector(sel);

export class UI {
  constructor() {
    this.shots = [];
    this.activeTab = "live";
    this.proKey = "curry";
    this.mirrored = true;
    this.els = {
      phase: $("#phase-chip"),
      hud: $("#hud"),
      status: $("#status-msg"),
      tabs: document.querySelectorAll(".tab"),
      panels: document.querySelectorAll(".panel"),
      shotPanel: $("#panel-shot"),
      sessionPanel: $("#panel-session"),
      prosPanel: $("#panel-pros"),
    };
    for (const tab of this.els.tabs) {
      tab.addEventListener("click", () => this.showTab(tab.dataset.tab));
    }
  }

  showTab(name) {
    this.activeTab = name;
    for (const tab of this.els.tabs) {
      tab.classList.toggle("active", tab.dataset.tab === name);
      tab.setAttribute("aria-selected", tab.dataset.tab === name ? "true" : "false");
    }
    for (const p of this.els.panels) {
      p.classList.toggle("hidden", p.id !== `panel-${name}`);
    }
    if (name === "pros") this.renderPros();
    if (name === "session") this.renderSession();
  }

  setStatus(msg) {
    this.els.status.textContent = msg || "";
    this.els.status.classList.toggle("hidden", !msg);
  }

  updateLive(live, fps) {
    const phaseNames = {
      idle: "Ready", load: "Loading…", rise: "Rising…",
      follow: "Follow through!", cooldown: "—",
    };
    this.els.phase.textContent = phaseNames[live.phase] ?? "…";
    this.els.phase.dataset.phase = live.phase;
    if (live.kneeAngle != null) {
      this.els.hud.textContent =
        `knee ${Math.round(live.kneeAngle)}°  ·  elbow ${Math.round(live.elbowAngle)}°  ·  ${fps} fps`;
    }
  }

  addShot(shot, aspect) {
    this.shots.push(shot);
    this.renderShot(shot, aspect);
    this.showTab("shot");
    const badge = $("#tab-badge-shot");
    badge.textContent = this.shots.length;
    badge.classList.remove("hidden");
  }

  renderShot(shot, aspect) {
    const panel = this.els.shotPanel;
    panel.innerHTML = "";

    // Trace card
    const cardWrap = document.createElement("div");
    cardWrap.className = "trace-wrap";
    const canvas = document.createElement("canvas");
    const w = Math.min(640, panel.clientWidth || 360);
    canvas.width = w * 2; // 2x for retina
    canvas.height = Math.round((w * 2) / aspect);
    canvas.style.width = "100%";
    cardWrap.appendChild(canvas);
    panel.appendChild(cardWrap);
    renderShotCard(canvas, shot, aspect, this.mirrored);

    if (!shot.metrics.ballTracked) {
      const note = document.createElement("p");
      note.className = "muted-note";
      note.textContent =
        "Ball flight wasn't tracked on this shot — angle estimated from wrist motion. Better light or a cleaner background helps.";
      panel.appendChild(note);
    }

    // Feedback list with meters
    const list = document.createElement("div");
    list.className = "feedback-list";
    for (const f of shot.feedback) {
      if (f.status === "na" && f.value == null) continue;
      list.appendChild(this.feedbackRow(f));
    }
    panel.appendChild(list);
  }

  feedbackRow(f) {
    const row = document.createElement("div");
    row.className = `feedback-row status-${f.status}`;
    const meta = STATUS_META[f.status];

    const head = document.createElement("div");
    head.className = "feedback-head";
    head.innerHTML =
      `<span class="status-chip status-${f.status}"><span class="icon">${meta.icon}</span>${meta.word}</span>` +
      `<span class="feedback-label">${f.label}</span>` +
      (f.value != null && typeof f.value !== "boolean"
        ? `<span class="feedback-value">${f.value}${f.unit}</span>`
        : "");
    row.appendChild(head);

    // Meter: good-range band + value marker on a fixed scale.
    if (f.scale && f.good && f.value != null && typeof f.value === "number") {
      row.appendChild(meterBar(f.value, f.scale, f.good, f.status));
    }

    const text = document.createElement("p");
    text.className = "feedback-text";
    text.textContent = f.text;
    row.appendChild(text);
    return row;
  }

  renderSession() {
    const panel = this.els.sessionPanel;
    panel.innerHTML = "";
    if (this.shots.length === 0) {
      panel.innerHTML = `<p class="muted-note">No shots yet this session. Get in frame side-on and let it fly.</p>`;
      return;
    }

    // Stat tiles
    const tiles = document.createElement("div");
    tiles.className = "stat-tiles";
    const angles = this.shots.map((s) => s.metrics.releaseAngleDeg).filter((v) => v != null);
    const times = this.shots.map((s) => s.metrics.dipToReleaseMs).filter((v) => v != null);
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    tiles.appendChild(statTile("Shots", String(this.shots.length)));
    tiles.appendChild(statTile("Avg release angle", angles.length ? `${Math.round(avg(angles))}°` : "—"));
    tiles.appendChild(statTile("Avg dip → release", times.length ? `${(avg(times) / 1000).toFixed(2)}s` : "—"));
    panel.appendChild(tiles);

    // Recurring issues
    const trends = sessionTrends(this.shots);
    const h = document.createElement("h3");
    h.textContent = "Recurring focus areas";
    panel.appendChild(h);
    if (trends.length === 0) {
      panel.insertAdjacentHTML("beforeend", `<p class="muted-note">Nothing recurring — keep stacking reps.</p>`);
    } else {
      const ul = document.createElement("ul");
      ul.className = "trend-list";
      for (const t of trends) {
        const li = document.createElement("li");
        li.innerHTML = `<span class="status-chip status-warn"><span class="icon">△</span>${t.count}/${t.total} shots</span> ${t.label}`;
        ul.appendChild(li);
      }
      panel.appendChild(ul);
    }

    // Shot log
    const h2 = document.createElement("h3");
    h2.textContent = "Shot log";
    panel.appendChild(h2);
    const table = document.createElement("table");
    table.className = "shot-table";
    table.innerHTML = `<thead><tr><th>#</th><th>Angle</th><th>Dip→rel</th><th>Knee</th><th>Issues</th></tr></thead>`;
    const tbody = document.createElement("tbody");
    this.shots.forEach((s, i) => {
      const issues = s.feedback.filter((f) => f.status === "bad" || f.status === "warn").length;
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td>${i + 1}</td>` +
        `<td>${s.metrics.releaseAngleDeg != null ? s.metrics.releaseAngleDeg + "°" : "—"}</td>` +
        `<td>${s.metrics.dipToReleaseMs != null ? (s.metrics.dipToReleaseMs / 1000).toFixed(2) + "s" : "—"}</td>` +
        `<td>${s.metrics.kneeBendDeg != null ? s.metrics.kneeBendDeg + "°" : "—"}</td>` +
        `<td>${issues === 0 ? "clean" : issues}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    panel.appendChild(table);
  }

  renderPros() {
    const panel = this.els.prosPanel;
    panel.innerHTML = "";

    // Pro selector
    const sel = document.createElement("div");
    sel.className = "pro-select";
    for (const [key, pro] of Object.entries(PROS)) {
      const b = document.createElement("button");
      b.className = "pro-btn" + (key === this.proKey ? " active" : "");
      b.textContent = pro.name;
      b.addEventListener("click", () => {
        this.proKey = key;
        this.renderPros();
      });
      sel.appendChild(b);
    }
    panel.appendChild(sel);

    const pro = PROS[this.proKey];
    const blurb = document.createElement("p");
    blurb.className = "pro-blurb";
    blurb.textContent = pro.blurb;
    panel.appendChild(blurb);

    const sig = document.createElement("ul");
    sig.className = "pro-signature";
    for (const s of pro.signature) {
      const li = document.createElement("li");
      li.textContent = s;
      sig.appendChild(li);
    }
    panel.appendChild(sig);

    const h = document.createElement("h3");
    h.textContent = this.shots.length
      ? `You (avg of ${this.shots.length} shot${this.shots.length > 1 ? "s" : ""}) vs ${pro.name}`
      : `Take some shots to compare with ${pro.name}`;
    panel.appendChild(h);

    if (this.shots.length) {
      // Legend — two series, identity never by color alone (labels ride each row).
      const legend = document.createElement("div");
      legend.className = "legend";
      legend.innerHTML =
        `<span class="legend-item"><span class="swatch you"></span>You</span>` +
        `<span class="legend-item"><span class="swatch pro"></span>${pro.name}</span>`;
      panel.appendChild(legend);

      const mine = averageMetrics(this.shots);
      const rows = document.createElement("div");
      rows.className = "compare-rows";
      for (const cm of COMPARE_METRICS) {
        const you = mine[cm.key];
        const them = pro.metrics[cm.key];
        if (you == null && them == null) continue;
        rows.appendChild(compareRow(cm, you, them, pro.name));
      }
      panel.appendChild(rows);

      const note = document.createElement("p");
      note.className = "muted-note";
      note.textContent =
        "Pro values are estimates compiled from public shot analyses and tracking data — use them as a direction, not a target to copy exactly. The best shot is the one you can repeat.";
      panel.appendChild(note);
    }
  }
}

function statTile(label, value) {
  const el = document.createElement("div");
  el.className = "stat-tile";
  el.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value">${value}</div>`;
  return el;
}

// A meter: fixed scale, good-range band, and a dot marker at the value.
function meterBar(value, scale, good, status) {
  const wrap = document.createElement("div");
  wrap.className = "meter";
  const pct = (v) => `${Math.max(0, Math.min(100, ((v - scale.min) / (scale.max - scale.min)) * 100))}%`;
  const band = document.createElement("div");
  band.className = "meter-band";
  band.style.left = pct(good[0]);
  band.style.width = `calc(${pct(good[1])} - ${pct(good[0])})`;
  const marker = document.createElement("div");
  marker.className = `meter-marker status-${status}`;
  marker.style.left = pct(value);
  wrap.appendChild(band);
  wrap.appendChild(marker);
  return wrap;
}

// Comparison row: one scale, two dot markers (you vs pro) + explicit values.
function compareRow(cm, you, them, proName) {
  const row = document.createElement("div");
  row.className = "compare-row";
  const youTxt = you != null ? formatVal(you, cm) : "—";
  const themTxt = them != null ? formatVal(them, cm) : "—";
  row.innerHTML =
    `<div class="compare-head"><span class="feedback-label">${cm.label}</span>` +
    `<span class="compare-vals"><span class="you-val">${youTxt}</span> · <span class="pro-val">${themTxt}</span></span></div>`;
  const track = document.createElement("div");
  track.className = "compare-track";
  const pct = (v) => `${Math.max(1, Math.min(99, ((v - cm.min) / (cm.max - cm.min)) * 100))}%`;
  if (them != null) {
    const d = document.createElement("div");
    d.className = "compare-dot pro";
    d.style.left = pct(them);
    d.title = `${proName}: ${themTxt}`;
    track.appendChild(d);
  }
  if (you != null) {
    const d = document.createElement("div");
    d.className = "compare-dot you";
    d.style.left = pct(you);
    d.title = `You: ${youTxt}`;
    track.appendChild(d);
  }
  row.appendChild(track);
  return row;
}

function formatVal(v, cm) {
  if (cm.unit === "ms") return `${(v / 1000).toFixed(2)}s`;
  if (cm.unit === "°") return `${Math.round(v)}°`;
  return (+v).toFixed(2);
}
