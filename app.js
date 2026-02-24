// ===== Google Sheet Config =====
const SHEET_ID = "1xCvtasjW7psaYrs_IyEzZj_QR1XGN5yvYcpJDBc08s0";
const SHEET_NAME = "score";

// ห้องที่ต้องมีปุ่ม
const CLASS_BUTTONS = [
  "ม.5/1",
  "ม.5/2",
  "ม.5/3",
  "ม.5/4",
  "ม.5/5",
  "ม.5/6",
  "ม.5/1 ลป",
];

// เต็มคะแนน
const MAX_ASSIGN = 60;
const MAX_MID = 20;
const MAX_FINAL = 20;
const MAX_TOTAL = 100;

// Charts
let avgChart = null;
let gradeChart = null;
let m5RoomAvgChart = null;
let m5GradeChart = null;

const el = (id) => document.getElementById(id);
// ===== Force remove/disable ChartDataLabels if it exists (กัน % โผล่กลางแท่ง) =====
try {
  if (window.ChartDataLabels) {
    Chart.unregister(window.ChartDataLabels);
  }
  // เผื่อมีชื่อเป็น datalabels ใน registry
  const dl = Chart.registry.plugins.get("datalabels");
  if (dl) Chart.unregister(dl);
} catch (e) {
  // ignore
}

// ปิด datalabels เป็นค่า default (เผื่อถูก register จากที่อื่น)
Chart.defaults.plugins.datalabels = { display: false };

// ===== Plugin: ตัวเลขบนกราฟแท่ง (ตัวเลขล้วน ไม่มี % แน่นอน) =====
const BarValueLabelPlugin = {
  id: "barValueLabel",
  afterDatasetsDraw(chart, args, pluginOptions) {
    const { ctx } = chart;
    const datasetIndex = pluginOptions?.datasetIndex ?? 0;
    const decimals = pluginOptions?.decimals ?? 2;

    const meta = chart.getDatasetMeta(datasetIndex);
    const data = chart.data.datasets[datasetIndex]?.data ?? [];

    ctx.save();
    ctx.font = "800 12px Sarabun, sans-serif";
    ctx.fillStyle = "rgba(15,23,42,.78)";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    meta.data.forEach((bar, i) => {
      const value = data[i];
      if (value === null || value === undefined) return;
      ctx.fillText(Number(value).toFixed(decimals), bar.x, bar.y - 6);
    });

    ctx.restore();
  },
};

// ===== Doughnut % Plugin (แสดงครบทุกชิ้น + กันหลุดกรอบ) =====
const DoughnutPercentLabelPlugin = {
  id: "doughnutPercentLabel",
  afterDatasetsDraw(chart) {
    const type = chart?.config?.type;
    if (type !== "doughnut" && type !== "pie") return;

    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const data = chart.data.datasets[0]?.data ?? [];
    const total = data.reduce((s, v) => s + (Number(v) || 0), 0);
    if (!total) return;

    const left = [];
    const right = [];

    const area = chart.chartArea;
    const top = area.top + 6;
    const bottom = area.bottom - 6;
    const leftBound = area.left + 6;
    const rightBound = area.right - 6;

    meta.data.forEach((arc, i) => {
      const valueRaw = data[i];
      const value = Number(valueRaw);

      // ✅ แสดงครบ: ถ้าเป็น NaN ค่อยข้าม
      if (!Number.isFinite(value) || value === 0) return;

      // ✅ 0 ก็ยังคำนวณได้ (จะได้ 0%)
      const percent = (value / total) * 100;
      const label = `${percent.toFixed(0)}%`;

      const angle = (arc.startAngle + arc.endAngle) / 2;
      const outerR = arc.outerRadius;

      const lineLength = outerR * 0.22; // ยืดตามขนาดกราฟ
      const padding = 18;

      const x1 = arc.x + Math.cos(angle) * (outerR + 2);
      const y1 = arc.y + Math.sin(angle) * (outerR + 2);

      const x2 = arc.x + Math.cos(angle) * (outerR + lineLength);
      const y2 = arc.y + Math.sin(angle) * (outerR + lineLength);

      const isRight = Math.cos(angle) >= 0;

      let xText = x2 + (isRight ? padding : -padding);
      let yText = y2;

      // ✅ clamp ไม่ให้หลุดกรอบ
      yText = Math.max(top, Math.min(bottom, yText));
      xText = Math.max(leftBound, Math.min(rightBound, xText));

      (isRight ? right : left).push({
        x1,
        y1,
        x2,
        y2,
        xText,
        yText,
        label,
        isRight,
      });
    });

    // ===== กันชนแนวตั้งอัตโนมัติ =====
    function resolve(arr) {
      arr.sort((a, b) => a.yText - b.yText);
      const gap = 16;

      for (let i = 1; i < arr.length; i++) {
        if (arr[i].yText - arr[i - 1].yText < gap) {
          arr[i].yText = arr[i - 1].yText + gap;
        }
      }

      // clamp รอบสองหลังดันกันชน
      for (const it of arr) {
        it.yText = Math.max(top, Math.min(bottom, it.yText));
      }
    }

    resolve(left);
    resolve(right);

    // ===== วาดเส้น + ข้อความ =====
    ctx.save();
    ctx.font = "700 12px Sarabun, sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;

    const draw = (it) => {
      // ถ้าค่าเป็น 0 เส้นจะชี้ไปจุดเดียวกันมาก อาจรก — แต่ยังแสดงได้
      ctx.beginPath();
      ctx.moveTo(it.x1, it.y1);
      ctx.lineTo(it.x2, it.y2);
      ctx.lineTo(it.xText, it.yText);
      ctx.stroke();

      ctx.textAlign = it.isRight ? "left" : "right";
      ctx.textBaseline = "middle";
      ctx.fillText(it.label, it.xText, it.yText);
    };

    left.forEach(draw);
    right.forEach(draw);

    ctx.restore();
  },
};

// ===== Plugin: ลบ/ทับข้อความกลางโดนัท (รันตอนท้ายสุด) =====
const RemoveDoughnutCenterText = {
  id: "removeDoughnutCenterText",
  afterDraw(chart, args, pluginOptions) {
    const type = chart?.config?.type;
    if (type !== "doughnut" && type !== "pie") return;

    // ถ้าปิดไว้ ไม่ทำงาน
    if (chart?.options?.plugins?.removeDoughnutCenterText === false) return;

    const meta = chart.getDatasetMeta(0);
    if (!meta?.data?.length) return;

    const arc = meta.data[0];
    const x = arc.x;
    const y = arc.y;

    // ===== Pro Auto Radius =====
    const inner = arc.innerRadius || 0;

    // คำนวณแบบอัตโนมัติ (12% ของ innerRadius)
    const autoExtra = inner * 0.15;

    // เผื่อขั้นต่ำกันรอย (อย่างน้อย 18px)
    const safeExtra = Math.max(autoExtra, 18);

    const r = inner + safeExtra;

    // สีพื้นหลัง: ใช้พื้นหลังของ canvas parent (เนียน)
    let bg = pluginOptions?.bgColor;
    if (!bg) {
      const parent = chart.canvas?.parentElement;
      bg = parent ? getComputedStyle(parent).backgroundColor : "#ffffff";
      if (!bg || bg === "rgba(0, 0, 0, 0)") bg = "#ffffff";
    }

    const { ctx } = chart;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();
  },
};

Chart.register(
  BarValueLabelPlugin,
  DoughnutPercentLabelPlugin,
  RemoveDoughnutCenterText,
);

// ===== Utilities =====
function nowThaiString() {
  const d = new Date();
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function buildCsvUrl() {
  const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`;
  const params = new URLSearchParams({ tqx: "out:csv", sheet: SHEET_NAME });
  return `${base}?${params.toString()}`;
}

async function fetchCsv() {
  const res = await fetch(buildCsvUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ: " + res.status);
  return await res.text();
}

// CSV parser รองรับเครื่องหมายคำพูด
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

function toNumber(x) {
  const n = Number(String(x ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function calcGrade(total) {
  if (total >= 80) return "4";
  if (total >= 75) return "3.5";
  if (total >= 70) return "3";
  return "ปรับปรุง";
}

function destroyChart(ch) {
  if (ch) ch.destroy();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== Parse rows -> objects =====
// ต้องมีหัวตาราง: Class, Number, Name, Assignment, Mid, Final
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
      "หัวตารางไม่ตรง (ต้องมี: Class, Number, Name, Assignment, Mid, Final)",
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

    const total = assignment + mid + final;
    const grade = calcGrade(total);

    out.push({ className, number, name, assignment, mid, final, total, grade });
  }
  return out;
}

// ===== Summary =====
function summarize(rows) {
  const n = rows.length;
  const sumA = rows.reduce((s, r) => s + r.assignment, 0);
  const sumM = rows.reduce((s, r) => s + r.mid, 0);
  const sumF = rows.reduce((s, r) => s + r.final, 0);
  const sumT = rows.reduce((s, r) => s + r.total, 0);

  const avgA = n ? sumA / n : 0;
  const avgM = n ? sumM / n : 0;
  const avgF = n ? sumF / n : 0;
  const avgT = n ? sumT / n : 0;

  const g4 = rows.filter((r) => r.total >= 80).length;
  const g35 = rows.filter((r) => r.total >= 75 && r.total <= 79).length;
  const g3 = rows.filter((r) => r.total >= 70 && r.total <= 74).length;
  const improve = rows.filter((r) => r.total < 70).length;

  return {
    n,
    avgA,
    avgM,
    avgF,
    avgT,
    gradeDist: { g4, g35, g3, improve },
    g4Count: g4,
    g3to35Count: g35 + g3,
    below3Count: improve,
  };
}

function summarizeAllM5(all) {
  const n = all.length;
  const avgT = n ? all.reduce((s, r) => s + r.total, 0) / n : 0;
  const g4 = all.filter((r) => r.total >= 80).length;
  const g35 = all.filter((r) => r.total >= 75 && r.total <= 79).length;
  const g3 = all.filter((r) => r.total >= 70 && r.total <= 74).length;
  const improve = all.filter((r) => r.total < 70).length;
  return { n, avgT, g4, g35, g3, improve };
}

// ===== State =====
let ALL = [];

// ===== UI =====
function renderClassButtons(allRows, onPick) {
  const container = el("classButtons");
  container.innerHTML = "";

  const available = new Set(allRows.map((r) => r.className));
  const list = CLASS_BUTTONS.filter((c) => available.has(c));
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

function setRoomSummaryUI(cls, s) {
  el("roomTitle").textContent = cls ? `(${cls})` : "";
  el("statCount").textContent = s.n.toLocaleString("th-TH");
  el("statAvg").textContent = s.avgT.toFixed(2);
  el("statG4").textContent = s.g4Count.toLocaleString("th-TH");
  el("statG3to35").textContent = s.g3to35Count.toLocaleString("th-TH");
  el("statBelow3").textContent = s.below3Count.toLocaleString("th-TH");
}

// ===== Charts (NO percent on bar charts) =====
function renderAvgChart(s) {
  const ctx = el("avgChart");
  destroyChart(avgChart);

  avgChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["งานที่มอบหมาย", "กลางภาค", "ปลายภาค", "คะแนนรวม"],
      datasets: [
        {
          label: "คะแนนเฉลี่ย",
          // ✅ คะแนนเฉลี่ยจริง ไม่คิดเปอร์เซ็นต์
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
        datalabels: { display: false }, // ✅ บังคับปิด
        doughnutPercentLabel: false, // ✅ กันไม่ให้ plugin นี้ทำงานในกราฟแท่ง
        /*tooltip: {
          callbacks: { label: (item) => `${Number(item.raw).toFixed(2)}` },
        }, // ตัวเลขล้วน*/
        barValueLabel: { decimals: 2 }, // ตัวเลขล้วนบนหัวแท่ง
      },
      scales: {
        y: { beginAtZero: true, suggestedMax: 100, ticks: { stepSize: 10 } },
      },
    },
  });
}

function renderGradeChart(s) {
  const ctx = el("gradeChart");
  destroyChart(gradeChart);

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
      datasets: [{ data: [d.g4, d.g35, d.g3, d.improve], borderWidth: 1 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        doughnutPercentLabel: {},
        removeDoughnutCenterText: {}, // ✅ ลบตัวเลขกลางวง
      },
      cutout: "62%",
    },
  });
}

function renderM5RoomAverageChart() {
  const ctx = el("m5RoomAvgChart");
  destroyChart(m5RoomAvgChart);

  const grouped = {};
  for (const r of ALL) {
    (grouped[r.className] ||= []).push(r.total);
  }

  const labels = Object.keys(grouped).sort();
  const data = labels.map((cls) => {
    const arr = grouped[cls];
    return arr.reduce((s, x) => s + x, 0) / arr.length; // คะแนนเฉลี่ย (ตัวเลขล้วน)
  });

  m5RoomAvgChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "คะแนนเฉลี่ยแต่ละห้อง",
          data,
          borderRadius: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: { display: false }, // ✅ บังคับปิด % กลางแท่ง
        doughnutPercentLabel: false, // ✅ กันไม่ให้ plugin นี้ทำงานในกราฟแท่ง
        /*tooltip: {
          callbacks: { label: (item) => `${Number(item.raw).toFixed(2)}` },
        }, // ตัวเลขล้วน*/
        barValueLabel: { decimals: 2 }, // ✅ ไม่มี % ไม่มี label อื่น
      },
      scales: {
        y: { beginAtZero: true, max: 100 },
      },
    },
  });
}

function renderM5GradeChart() {
  const ctx = el("m5GradeChart");
  destroyChart(m5GradeChart);

  const s = summarizeAllM5(ALL);
  m5GradeChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["เกรด 4", "เกรด 3.5", "เกรด 3", "ปรับปรุง"],
      datasets: [{ data: [s.g4, s.g35, s.g3, s.improve], borderWidth: 1 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        doughnutPercentLabel: {},
        removeDoughnutCenterText: {},
      },
      cutout: "60%",
    },
  });
}

// ===== Student list =====
function renderStudentBars(classRows) {
  const host = el("studentList");
  host.innerHTML = "";

  const rows = [...classRows].sort((a, b) => a.number - b.number);

  const makeSeg = (cls, widthPercent, labelText, tooltipText) => {
    const seg = document.createElement("div");
    seg.className = `seg ${cls}`;
    seg.style.width = `${widthPercent}%`;
    seg.title = tooltipText;
    if (widthPercent < 7) seg.classList.add("seg--tiny");
    seg.textContent = labelText;
    return seg;
  };

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

    const wA = Math.max(0, Math.min(100, (r.assignment / MAX_TOTAL) * 100));
    const wM = Math.max(0, Math.min(100, (r.mid / MAX_TOTAL) * 100));
    const wF = Math.max(0, Math.min(100, (r.final / MAX_TOTAL) * 100));

    bar.append(
      makeSeg(
        "seg--a",
        wA,
        `${r.assignment.toFixed(0)}`,
        `งานที่มอบหมาย: ${r.assignment}/${MAX_ASSIGN}`,
      ),
      makeSeg(
        "seg--m",
        wM,
        `${r.mid.toFixed(0)}`,
        `กลางภาค: ${r.mid}/${MAX_MID}`,
      ),
      makeSeg(
        "seg--f",
        wF,
        `${r.final.toFixed(0)}`,
        `ปลายภาค: ${r.final}/${MAX_FINAL}`,
      ),
    );

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

function renderForClass(cls) {
  const classRows = ALL.filter((r) => r.className === cls);
  const s = summarize(classRows);

  setRoomSummaryUI(cls, s);
  renderAvgChart(s);
  renderGradeChart(s);
  renderStudentBars(classRows);

  el("lastUpdated").textContent = `อัปเดตล่าสุด: ${nowThaiString()}`;
}

// ===== Load =====
async function load() {
  el("lastUpdated").textContent = "กำลังโหลดข้อมูล…";

  const csv = await fetchCsv();
  ALL = parseRows(csv);

  // M5 overview
  const m5 = summarizeAllM5(ALL);
  el("m5Count").textContent = m5.n.toLocaleString("th-TH");
  el("m5Avg").textContent = m5.avgT.toFixed(2);
  el("m5G4").textContent = m5.g4.toLocaleString("th-TH");
  renderM5RoomAverageChart();
  renderM5GradeChart();

  // Class buttons + default room
  const first = renderClassButtons(ALL, renderForClass);
  renderForClass(first);

  // Refresh
  el("refreshBtn").addEventListener("click", async () => {
    try {
      el("refreshBtn").disabled = true;
      el("refreshBtn").innerHTML =
        `<i class="fa-solid fa-spinner fa-spin"></i> กำลังรีเฟรช`;

      const csv2 = await fetchCsv();
      ALL = parseRows(csv2);

      const m5n = summarizeAllM5(ALL);
      el("m5Count").textContent = m5n.n.toLocaleString("th-TH");
      el("m5Avg").textContent = m5n.avgT.toFixed(2);
      el("m5G4").textContent = m5n.g4.toLocaleString("th-TH");
      renderM5RoomAverageChart();
      renderM5GradeChart();

      const activeBtn = document.querySelector(
        "#classButtons .btn.btn--active",
      );
      const cls = activeBtn ? activeBtn.textContent.trim() : first;
      renderForClass(cls);
    } catch (err) {
      console.error(err);
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
      "ตรวจสอบว่าแชร์ Google Sheet เป็น Anyone with the link (Viewer) และชื่อชีตเป็น 'score'\n\n" +
      "รายละเอียด: " +
      err.message,
  );
});
