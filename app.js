// ===== Config =====
const SHEET_ID = "1xCvtasjW7psaYrs_IyEzZj_QR1XGN5yvYcpJDBc08s0";
const SHEET_NAME = "score";

// ปุ่มห้องตามที่ผู้ใช้ระบุ (จะกรองเฉพาะที่มีในข้อมูลอีกที)
const CLASS_BUTTONS = [
  "ม.5/1",
  "ม.5/2",
  "ม.5/3",
  "ม.5/4",
  "ม.5/5",
  "ม.5/6",
  "ม.5/1 ลป.",
];

// max คะแนน
const MAX_ASSIGN = 60;
const MAX_MID = 20;
const MAX_FINAL = 20;
const MAX_TOTAL = 100;

// Charts
let avgChart = null;
let gradeChart = null;

const el = (id) => document.getElementById(id);

function nowThaiString() {
  const d = new Date();
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

// ===== Data fetching (Google Sheets via gviz CSV) =====
// URL รูปแบบ: /gviz/tq?tqx=out:csv&sheet=score
function buildCsvUrl() {
  const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`;
  const params = new URLSearchParams({
    tqx: "out:csv",
    sheet: SHEET_NAME,
  });
  return `${base}?${params.toString()}`;
}

async function fetchCsv() {
  const url = buildCsvUrl();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("โหลดข้อมูลไม่สำเร็จ: " + res.status);
  }
  return await res.text();
}

// CSV parser (รองรับค่ามีเครื่องหมายคำพูด)
function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cur.trim());
      cur = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur.trim());
      cur = "";
      // กันบรรทัดว่าง
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur.trim());
    if (row.some((v) => v !== "")) rows.push(row);
  }
  return rows;
}

// ===== Domain logic =====
function toNumber(x) {
  const n = Number(String(x).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function calcTotal(a, m, f) {
  return a + m + f;
}

function calcGrade(total) {
  if (total >= 80) return "4";
  if (total >= 75) return "3.5";
  if (total >= 70) return "3";
  return "ปรับปรุง";
}

function summarize(classRows) {
  const n = classRows.length;
  const sumA = classRows.reduce((s, r) => s + r.assignment, 0);
  const sumM = classRows.reduce((s, r) => s + r.mid, 0);
  const sumF = classRows.reduce((s, r) => s + r.final, 0);
  const sumT = classRows.reduce((s, r) => s + r.total, 0);

  const avgA = n ? sumA / n : 0;
  const avgM = n ? sumM / n : 0;
  const avgF = n ? sumF / n : 0;
  const avgT = n ? sumT / n : 0;

  const g4 = classRows.filter((r) => r.total >= 80).length;
  const g35 = classRows.filter((r) => r.total >= 75 && r.total <= 79).length;
  const g3 = classRows.filter((r) => r.total >= 70 && r.total <= 74).length;
  const improve = classRows.filter((r) => r.total < 70).length;

  return {
    n,
    avgA,
    avgM,
    avgF,
    avgT,
    gradeDist: { g4, g35, g3, improve },
    // ตามที่ต้องการในภาพรวม:
    g4Count: g4,
    g3to35Count: g35 + g3,
    below3Count: improve,
  };
}

// ===== UI render =====
function renderClassButtons(allRows, onPick) {
  const container = el("classButtons");
  container.innerHTML = "";

  const available = new Set(allRows.map((r) => r.className));
  // ใช้ปุ่มตามรายการผู้ใช้ แต่แสดงเฉพาะที่มีจริงในชีต (กันกดแล้วว่าง)
  const list = CLASS_BUTTONS.filter((c) => available.has(c));

  // fallback: ถ้ารายการที่ผู้ใช้ให้มาไม่ตรงข้อมูลเลย ให้สร้างจากข้อมูลจริง
  const finalList = list.length ? list : Array.from(available).sort();

  finalList.forEach((cls, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn" + (idx === 0 ? " btn--active" : "");
    b.innerHTML = `<i class="fa-solid fa-chalkboard-user"></i>${cls}`;
    b.addEventListener("click", () => {
      [...container.querySelectorAll(".btn")].forEach((x) =>
        x.classList.remove("btn--active"),
      );
      b.classList.add("btn--active");
      onPick(cls);
    });
    container.appendChild(b);
  });

  return finalList[0];
}

function setSummaryUI(cls, s) {
  el("roomTitle").textContent = cls ? `(${cls})` : "";
  el("statCount").textContent = s.n.toLocaleString("th-TH");
  el("statAvg").textContent = s.avgT.toFixed(2);
  el("statG4").textContent = s.g4Count.toLocaleString("th-TH");
  el("statG3to35").textContent = s.g3to35Count.toLocaleString("th-TH");
  el("statBelow3").textContent = s.below3Count.toLocaleString("th-TH");
}

function destroyCharts() {
  if (avgChart) {
    avgChart.destroy();
    avgChart = null;
  }
  if (gradeChart) {
    gradeChart.destroy();
    gradeChart = null;
  }
}

function renderAvgChart(s) {
  const ctx = el("avgChart");

  avgChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["งานที่มอบหมาย", "กลางภาค", "ปลายภาค", "คะแนนรวม"],
      datasets: [
        {
          label: "คะแนนเฉลี่ย",
          data: [s.avgA, s.avgM, s.avgF, s.avgT],
          borderWidth: 1,
          borderRadius: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ` เฉลี่ย ${item.raw.toFixed(2)} คะแนน`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 100,
          ticks: { stepSize: 10 },
        },
      },
    },
  });
}

function renderGradeChart(s) {
  const ctx = el("gradeChart");
  const d = s.gradeDist;

  gradeChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: [
        "เกรด 4 (80–100)",
        "เกรด 3.5 (75–79)",
        "เกรด 3 (70–74)",
        "ต้องปรับปรุง (<70)",
      ],
      datasets: [
        {
          data: [d.g4, d.g35, d.g3, d.improve],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
      },
      cutout: "62%",
    },
  });
}

function renderStudentBars(classRows) {
  const host = el("studentList");
  host.innerHTML = "";

  // เรียงตามเลขที่
  const rows = [...classRows].sort((a, b) => a.number - b.number);

  for (const r of rows) {
    const row = document.createElement("div");
    row.className = "row";

    const left = document.createElement("div");
    left.className = "left";
    left.innerHTML = `
      <div class="no">เลขที่ ${r.number}</div>
      <div class="name">${escapeHtml(r.name)}</div>
    `;

    const bar = document.createElement("div");
    bar.className = "bar";

    // คิดเป็นสัดส่วนจาก 100 เพื่อทำแท่งรวมเป็น 1 แท่ง (แบ่ง 3 ส่วน)
    const wA = Math.max(0, Math.min(100, (r.assignment / MAX_TOTAL) * 100));
    const wM = Math.max(0, Math.min(100, (r.mid / MAX_TOTAL) * 100));
    const wF = Math.max(0, Math.min(100, (r.final / MAX_TOTAL) * 100));

    const makeSeg = (cls, widthPercent, labelText, tooltipText) => {
      const seg = document.createElement("div");
      seg.className = `seg ${cls}`;
      seg.style.width = `${widthPercent}%`;
      seg.title = tooltipText;

      // ถ้าแคบมาก ซ่อนตัวเลขบนแท่ง (แต่ยังมี tooltip)
      if (widthPercent < 7) seg.classList.add("seg--tiny");

      // แสดงตัวเลขคะแนนบนแท่ง
      seg.textContent = labelText;
      return seg;
    };

    const segA = makeSeg(
      "seg--a",
      wA,
      `${r.assignment.toFixed(0)}`,
      `งานที่มอบหมาย: ${r.assignment}/${MAX_ASSIGN}`,
    );

    const segM = makeSeg(
      "seg--m",
      wM,
      `${r.mid.toFixed(0)}`,
      `กลางภาค: ${r.mid}/${MAX_MID}`,
    );

    const segF = makeSeg(
      "seg--f",
      wF,
      `${r.final.toFixed(0)}`,
      `ปลายภาค: ${r.final}/${MAX_FINAL}`,
    );

    bar.append(segA, segM, segF);

    const right = document.createElement("div");
    right.className = "right";
    const gradeClass =
      r.grade === "4"
        ? "grade--4"
        : r.grade === "3.5"
          ? "grade--35"
          : r.grade === "3"
            ? "grade--3"
            : "grade--imp";

    right.innerHTML = `
  <div class="total">${r.total.toFixed(0)} / ${MAX_TOTAL}</div>
  <div class="grade-chip ${gradeClass}">
    <i class="fa-solid fa-graduation-cap"></i>
    เกรด ${r.grade}
  </div>
`;

    row.append(left, bar, right);
    host.appendChild(row);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== App bootstrap =====
let ALL = [];

function filterByClass(cls) {
  return ALL.filter((r) => r.className === cls);
}

function parseRows(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim());
  const idx = (name) =>
    header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const iClass = idx("Class");
  const iNumber = idx("Number");
  const iName = idx("Name");
  const iAssign = idx("Assignment");
  const iMid = idx("Mid");
  const iFinal = idx("Final");

  if ([iClass, iNumber, iName, iAssign, iMid, iFinal].some((i) => i < 0)) {
    throw new Error(
      "หัวตารางไม่ตรงตามที่คาดหวัง (ต้องมี: Class, Number, Name, Assignment, Mid, Final)",
    );
  }

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const className = row[iClass]?.trim();
    if (!className) continue;

    const number = toNumber(row[iNumber]);
    const name = row[iName]?.trim() ?? "";

    const assignment = toNumber(row[iAssign]);
    const mid = toNumber(row[iMid]);
    const final = toNumber(row[iFinal]);

    const total = calcTotal(assignment, mid, final);
    const grade = calcGrade(total);

    out.push({ className, number, name, assignment, mid, final, total, grade });
  }
  return out;
}

function renderForClass(cls) {
  const classRows = filterByClass(cls);
  const s = summarize(classRows);

  setSummaryUI(cls, s);
  destroyCharts();
  renderAvgChart(s);
  renderGradeChart(s);
  renderStudentBars(classRows);

  el("lastUpdated").textContent = `อัปเดตล่าสุด: ${nowThaiString()}`;
}

async function load() {
  // loading state (เบา ๆ)
  el("lastUpdated").textContent = "กำลังโหลดข้อมูล…";

  const csv = await fetchCsv();
  ALL = parseRows(csv);

  const first = renderClassButtons(ALL, renderForClass);
  renderForClass(first);

  el("refreshBtn").addEventListener("click", async () => {
    try {
      el("refreshBtn").disabled = true;
      el("refreshBtn").innerHTML =
        `<i class="fa-solid fa-spinner fa-spin"></i> กำลังรีเฟรช`;
      const csv2 = await fetchCsv();
      ALL = parseRows(csv2);
      // รีเรนเดอร์ห้องที่กำลัง active
      const activeBtn = document.querySelector(
        "#classButtons .btn.btn--active",
      );
      const cls = activeBtn ? activeBtn.textContent.trim() : first;
      renderForClass(cls);
    } catch (err) {
      alert(err.message);
    } finally {
      el("refreshBtn").disabled = false;
      el("refreshBtn").innerHTML =
        `<i class="fa-solid fa-rotate"></i> รีเฟรชข้อมูล`;
    }
  });
}

load().catch((err) => {
  console.error(err);
  el("lastUpdated").textContent = "โหลดข้อมูลไม่สำเร็จ";
  alert(
    "โหลดข้อมูลไม่สำเร็จ\n\n" +
      "เช็คว่าแชร์ Google Sheet เป็น Anyone with the link (Viewer) และชื่อชีตเป็น 'score'\n\n" +
      "รายละเอียด: " +
      err.message,
  );
});
