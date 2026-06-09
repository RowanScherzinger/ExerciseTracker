const API = "/api";

// ── State ──────────────────────────────────────────────────────────────────
let state = {
  schedule: [],
  currentDay: null,
  currentDayDetail: null,
  exercises: {},
  plan: null,
  phase: null,
};

// ── Helpers ────────────────────────────────────────────────────────────────
function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function monthLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ── Status icon + colour ───────────────────────────────────────────────────
const STATUS_ICON = {
  completed: "✓",
  partial: "◑",
  scheduled: "○",
  missed: "✕",
  rest: "",
  "rescheduled-here": "↷",
};

const STATUS_LABEL = {
  completed: "Completed",
  partial: "In progress",
  scheduled: "Scheduled",
  missed: "Missed",
  rest: "Rest day",
  "rescheduled-here": "Rescheduled here",
};

// ── Calendar rendering ─────────────────────────────────────────────────────
function groupByWeeks(schedule) {
  if (!schedule.length) return [];

  // Find the Monday on or before the first date
  const firstDate = new Date(schedule[0].date + "T00:00:00Z");
  const dow = firstDate.getUTCDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const firstMonday = new Date(firstDate);
  firstMonday.setUTCDate(firstDate.getUTCDate() + mondayOffset);

  const dateMap = new Map(schedule.map((d) => [d.date, d]));
  const weeks = [];
  let cursor = new Date(firstMonday);

  // How many weeks do we need?
  const lastDate = new Date(schedule[schedule.length - 1].date + "T00:00:00Z");
  while (cursor <= lastDate) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      week.push(dateMap.get(dateStr) ?? { date: dateStr, workoutType: null, status: "rest", completedExercises: [], totalExercises: 0, _outOfRange: true });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function renderCalendar(schedule) {
  const container = document.getElementById("calendar-body");
  container.innerHTML = "";

  const weeks = groupByWeeks(schedule);
  const t = today();
  let lastMonth = null;

  for (const week of weeks) {
    // Month label on the first day of the week if month changes
    const firstDayOfWeek = week.find((d) => !d._outOfRange);
    if (firstDayOfWeek) {
      const m = monthLabel(firstDayOfWeek.date);
      if (m !== lastMonth) {
        lastMonth = m;
        const lbl = document.createElement("div");
        lbl.className = "month-label";
        lbl.textContent = m;
        container.appendChild(lbl);
      }
    }

    const row = document.createElement("div");
    row.className = "week-row";

    for (const day of week) {
      const cell = document.createElement("div");
      const isToday = day.date === t;
      const isRest = day.status === "rest" && day.workoutType === null;
      const outOfRange = day._outOfRange;

      cell.className = "day-cell" + (isToday ? " today" : "") + (isRest ? " rest" : "") + (outOfRange ? " rest" : "");
      if (isToday) cell.classList.add("today-anchor");

      // Day number
      const d = new Date(day.date + "T00:00:00Z");
      const dayNumEl = document.createElement("div");
      dayNumEl.className = "day-num";
      dayNumEl.textContent = d.getUTCDate();
      cell.appendChild(dayNumEl);

      // Workout type badge
      const typeEl = document.createElement("div");
      typeEl.className = "day-type";
      if (day.workoutType) {
        typeEl.classList.add(`type-${day.workoutType}`);
        typeEl.textContent = day.workoutType;
      } else {
        typeEl.classList.add("type-rest");
        typeEl.textContent = "–";
      }
      cell.appendChild(typeEl);

      // Status icon
      if (!isRest && !outOfRange) {
        const iconEl = document.createElement("div");
        iconEl.className = "day-status-icon";
        iconEl.textContent = STATUS_ICON[day.status] ?? "";
        if (day.status === "completed") iconEl.style.color = "var(--green)";
        else if (day.status === "missed") iconEl.style.color = "var(--red)";
        else if (day.status === "partial") iconEl.style.color = "var(--amber)";
        else if (day.status === "rescheduled-here") iconEl.style.color = "var(--accent)";
        else iconEl.style.color = "var(--text2)";
        cell.appendChild(iconEl);

        // Progress bar
        if (day.totalExercises > 0) {
          const pct = day.totalExercises > 0 ? (day.completedExercises.length / day.totalExercises) * 100 : 0;
          const wrap = document.createElement("div");
          wrap.className = "progress-bar-wrap";
          const fill = document.createElement("div");
          fill.className = "progress-bar-fill" + (pct > 0 && pct < 100 ? " partial" : "");
          fill.style.width = pct + "%";
          wrap.appendChild(fill);
          cell.appendChild(wrap);
        }
      }

      if (!outOfRange && day.workoutType) {
        cell.addEventListener("click", () => openDayDetail(day.date));
      }

      row.appendChild(cell);
    }

    container.appendChild(row);
  }

  // Scroll today into view
  const todayEl = container.querySelector(".today-anchor");
  if (todayEl) {
    setTimeout(() => todayEl.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }
}

// ── Day detail view ────────────────────────────────────────────────────────
async function openDayDetail(date) {
  showView("detail");
  document.getElementById("detail-content").innerHTML = '<div class="loading">Loading…</div>';

  try {
    const detail = await api(`/schedule/${date}`);
    state.currentDayDetail = detail;
    renderDayDetail(detail);
  } catch (e) {
    document.getElementById("detail-content").innerHTML = '<div class="loading">Failed to load session.</div>';
  }
}

function renderDayDetail(detail) {
  const container = document.getElementById("detail-content");
  container.innerHTML = "";

  const { date, workoutType, status, workoutDetail, phase, completedExercises, totalExercises, rescheduledFrom } = detail;

  // Header
  const header = document.createElement("div");
  header.className = "detail-header";

  const backBtn = document.createElement("button");
  backBtn.className = "back-btn";
  backBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Calendar`;
  backBtn.addEventListener("click", () => showView("calendar"));

  const title = document.createElement("div");
  title.className = "detail-title";
  title.textContent = formatDate(date);

  const meta = document.createElement("div");
  meta.className = "detail-meta";

  if (workoutDetail) {
    const wkChip = document.createElement("span");
    wkChip.className = "meta-chip";
    wkChip.textContent = `Day ${workoutType} · ${workoutDetail.durationMin} min`;
    meta.appendChild(wkChip);
  }

  if (phase) {
    const phaseChip = document.createElement("span");
    phaseChip.className = "meta-chip";
    phaseChip.textContent = phase.name;
    meta.appendChild(phaseChip);
  }

  const statusChip = document.createElement("span");
  statusChip.className = `meta-chip status-${status}`;
  statusChip.textContent = STATUS_LABEL[status] ?? status;
  meta.appendChild(statusChip);

  if (rescheduledFrom) {
    const rsChip = document.createElement("span");
    rsChip.className = "meta-chip";
    rsChip.textContent = `↷ from ${formatShortDate(rescheduledFrom)}`;
    meta.appendChild(rsChip);
  }

  header.appendChild(backBtn);
  header.appendChild(title);
  header.appendChild(meta);
  container.appendChild(header);

  if (!workoutDetail) {
    const msg = document.createElement("div");
    msg.className = "loading";
    msg.textContent = "Rest day — no session scheduled.";
    container.appendChild(msg);
    return;
  }

  // Warm-up note
  const warmupLabel = document.createElement("div");
  warmupLabel.className = "section-label";
  warmupLabel.textContent = "Warm-Up (6–7 min)";
  container.appendChild(warmupLabel);

  const warmupNote = document.createElement("div");
  warmupNote.style.cssText = "padding: 0 16px 8px; font-size: 0.82rem; color: var(--text2); line-height: 1.4;";
  warmupNote.textContent = "Cat-Cow · Hip Flexor Stretch (30s/side) · Glute Bridge × 15 · Hip Circles × 10 · Thoracic Rotation × 8 · Jumping Jacks 60s";
  container.appendChild(warmupNote);

  // Main exercises
  const exLabel = document.createElement("div");
  exLabel.className = "section-label";
  exLabel.textContent = "Main Session";
  container.appendChild(exLabel);

  const list = document.createElement("div");
  list.className = "exercise-list";

  for (const ex of workoutDetail.exercises) {
    const card = buildExerciseCard(ex, completedExercises.includes(ex.exerciseId), date, workoutType, completedExercises, workoutDetail.exercises);
    list.appendChild(card);
  }

  container.appendChild(list);

  // Action bar
  const actionBar = document.createElement("div");
  actionBar.className = "action-bar";

  if (status === "missed") {
    const reschedBtn = document.createElement("button");
    reschedBtn.className = "btn btn-secondary";
    reschedBtn.textContent = "Reschedule missed session";
    reschedBtn.addEventListener("click", () => openRescheduleModal(date, workoutType));
    actionBar.appendChild(reschedBtn);
  }

  if (status !== "completed" && status !== "rest") {
    const doneBtn = document.createElement("button");
    doneBtn.className = "btn btn-primary";
    doneBtn.id = "mark-all-done";
    const remaining = totalExercises - completedExercises.length;
    doneBtn.textContent = remaining === 0 ? "Session Complete ✓" : `Mark All Done (${remaining} remaining)`;
    if (remaining === 0) doneBtn.disabled = true;
    doneBtn.addEventListener("click", () => markAllDone(date, workoutType, workoutDetail.exercises));
    actionBar.appendChild(doneBtn);
  } else if (status === "completed") {
    const doneMsg = document.createElement("div");
    doneMsg.style.cssText = "text-align: center; font-size: 0.9rem; color: var(--green); font-weight: 600; padding: 8px 0;";
    doneMsg.textContent = "✓ Session complete";
    actionBar.appendChild(doneMsg);
  }

  container.appendChild(actionBar);
}

function buildExerciseCard(ex, isDone, date, workoutType, completedExercises, allExercises) {
  const card = document.createElement("div");
  card.className = "exercise-card" + (isDone ? " done" : "");
  card.dataset.exerciseId = ex.exerciseId;

  const hdr = document.createElement("div");
  hdr.className = "exercise-card-header";

  const check = document.createElement("div");
  check.className = "exercise-check" + (isDone ? " checked" : "");
  check.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7L5.5 10L11.5 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  check.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleExercise(date, workoutType, ex.exerciseId, completedExercises, allExercises);
  });

  const info = document.createElement("div");
  info.className = "exercise-info";

  const name = document.createElement("div");
  name.className = "exercise-name";
  name.textContent = ex.exercise?.name ?? ex.exerciseId;

  const spec = document.createElement("div");
  spec.className = "exercise-spec";
  spec.textContent = buildSpecText(ex);

  info.appendChild(name);
  info.appendChild(spec);

  const expandIcon = document.createElement("div");
  expandIcon.className = "expand-icon";
  expandIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  hdr.appendChild(check);
  hdr.appendChild(info);
  hdr.appendChild(expandIcon);
  card.appendChild(hdr);

  // Cue section (expandable)
  if (ex.exercise) {
    const cue = document.createElement("div");
    cue.className = "exercise-cue";

    const short = document.createElement("div");
    short.className = "cue-short";
    short.textContent = ex.exercise.cueShort;

    const full = document.createElement("div");
    full.className = "cue-full";
    full.textContent = ex.exercise.cueFull ?? "";

    cue.appendChild(short);
    if (ex.exercise.cueFull) cue.appendChild(full);
    card.appendChild(cue);

    hdr.addEventListener("click", () => {
      card.classList.toggle("expanded");
      cue.classList.toggle("visible");
    });
  }

  return card;
}

function buildSpecText(ex) {
  const parts = [];
  if (ex.sets && ex.reps) {
    parts.push(`${ex.sets} × ${ex.reps} reps`);
  } else if (ex.sets && ex.durationSec) {
    parts.push(`${ex.sets} × ${ex.durationSec}s`);
  }
  if (ex.weightKg && ex.weightKg > 0) {
    parts.push(`@ ${ex.weightKg} kg`);
  }
  if (ex.exercise?.isPerSide) parts.push("per side");
  if (ex.restSec && ex.restSec > 0) parts.push(`${ex.restSec}s rest`);
  return parts.join(" · ");
}

// ── Toggle exercise completion ─────────────────────────────────────────────
async function toggleExercise(date, workoutType, exerciseId, currentCompleted, allExercises) {
  const isNowDone = !currentCompleted.includes(exerciseId);
  const newCompleted = isNowDone
    ? [...currentCompleted, exerciseId]
    : currentCompleted.filter((id) => id !== exerciseId);

  try {
    await api(`/completions`, {
      method: "POST",
      body: JSON.stringify({ date, workoutType, completedExercises: newCompleted }),
    });

    // Refresh detail view
    const detail = await api(`/schedule/${date}`);
    state.currentDayDetail = detail;
    renderDayDetail(detail);

    // Refresh calendar in background
    refreshSchedule();
  } catch (e) {
    console.error("Failed to toggle exercise", e);
  }
}

async function markAllDone(date, workoutType, exercises) {
  const allIds = exercises.map((e) => e.exerciseId);
  try {
    await api(`/completions`, {
      method: "POST",
      body: JSON.stringify({ date, workoutType, completedExercises: allIds }),
    });
    const detail = await api(`/schedule/${date}`);
    state.currentDayDetail = detail;
    renderDayDetail(detail);
    refreshSchedule();
  } catch (e) {
    console.error("Failed to mark all done", e);
  }
}

// ── Reschedule modal ───────────────────────────────────────────────────────
let rescheduleContext = null;

async function openRescheduleModal(originalDate, workoutType) {
  rescheduleContext = { originalDate, workoutType };
  const modal = document.getElementById("reschedule-modal");
  const list = document.getElementById("rest-days-list");

  list.innerHTML = '<div class="loading">Loading available days…</div>';
  modal.classList.add("open");

  document.getElementById("reschedule-subtitle").textContent = `Moving Day ${workoutType} from ${formatShortDate(originalDate)}`;

  try {
    const days = await api("/reschedule/available-days");
    list.innerHTML = "";

    if (!days.length) {
      list.innerHTML = '<div class="loading" style="padding:12px">No rest days available in the next 60 days.</div>';
      return;
    }

    for (const d of days) {
      const opt = document.createElement("div");
      opt.className = "rest-day-option";
      opt.textContent = formatDate(d);
      opt.dataset.date = d;
      opt.addEventListener("click", () => {
        document.querySelectorAll(".rest-day-option").forEach((el) => el.classList.remove("selected"));
        opt.classList.add("selected");
      });
      list.appendChild(opt);
    }
  } catch (e) {
    list.innerHTML = '<div class="loading">Failed to load available days.</div>';
  }
}

document.getElementById("reschedule-cancel").addEventListener("click", () => {
  document.getElementById("reschedule-modal").classList.remove("open");
});

document.getElementById("reschedule-confirm").addEventListener("click", async () => {
  const selected = document.querySelector(".rest-day-option.selected");
  if (!selected) return;

  const { originalDate, workoutType } = rescheduleContext;
  const rescheduledTo = selected.dataset.date;

  try {
    await api("/reschedule", {
      method: "POST",
      body: JSON.stringify({ originalDate, rescheduledTo, workoutType, reason: "missed" }),
    });
    document.getElementById("reschedule-modal").classList.remove("open");
    // Refresh
    const detail = await api(`/schedule/${originalDate}`);
    renderDayDetail(detail);
    refreshSchedule();
  } catch (e) {
    alert("Failed to reschedule. The target day may already be taken.");
  }
});

// ── View switching ─────────────────────────────────────────────────────────
function showView(name) {
  document.getElementById("view-calendar").classList.toggle("active", name === "calendar");
  document.getElementById("view-detail").classList.toggle("active", name === "detail");
}

// ── Bootstrap ─────────────────────────────────────────────────────────────
async function refreshSchedule() {
  const t = today();
  const from = addDays(t, -21);
  const to = addDays(t, 35);

  const [schedule, planData] = await Promise.all([
    api(`/schedule?from=${from}&to=${to}`),
    api(`/plan`),
  ]);

  state.schedule = schedule;
  state.plan = planData.plan;
  state.phase = planData.currentPhase;

  renderCalendar(schedule);

  document.getElementById("phase-chip").textContent = planData.currentPhase?.name ?? "";
}

async function init() {
  showView("calendar");
  document.getElementById("calendar-body").innerHTML = '<div class="loading">Loading your plan…</div>';

  try {
    await refreshSchedule();
  } catch (e) {
    document.getElementById("calendar-body").innerHTML = '<div class="loading">Could not connect to server. Is it running?</div>';
  }
}

init();
