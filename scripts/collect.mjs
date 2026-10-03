// 수집 스크립트: data/manual.json(직접 확인한 공고) + 사람인 API 결과를 합쳐 data/jobs.json 생성.
// 사람인 응답 필드는 공식 문서 기준 추측이라 키 승인 후 첫 실행에서 한 번 검증 필요.
import { readFileSync, writeFileSync } from "node:fs";

const KEY = process.env.SARAMIN_KEY || "";
const manual = JSON.parse(readFileSync("data/manual.json", "utf8")).jobs;
const QUERIES = ["프로덕트 디자이너", "UX UI 디자이너", "서비스 기획", "PM 프로덕트 매니저"];

function roleOf(title) {
  const r = [];
  if (/프로덕트\s*디자|product\s*design|ux\s*\/?\s*ui|ui\s*\/?\s*ux|ux\s*디자|ui\s*디자/i.test(title)) r.push(/ux|ui/i.test(title) ? "UXUI" : "PD");
  if (/pm|po|기획|product\s*(manager|owner)|프로덕트\s*매니저/i.test(title)) r.push("PM");
  return [...new Set(r)];
}
function careerOk(exp) {
  // 신입 전용, 7년 이상 시니어 전용은 제외
  const min = Number(exp?.min ?? 0), name = exp?.name || "";
  if (/^신입$/.test(name)) return false;
  if (min >= 7) return false;
  return true;
}
const norm = (s) => (s || "").toLowerCase().replace(/\(주\)|주식회사|\s|[\[\]()·\-_/]/g, "");
const dupKey = (j) => norm(j.co) + "|" + norm(j.ti).slice(0, 14);

async function saramin(q) {
  const u = new URL("https://oapi.saramin.co.kr/job-search");
  u.searchParams.set("access-key", KEY);
  u.searchParams.set("keywords", q);
  u.searchParams.set("count", "30");
  u.searchParams.set("sort", "pd");
  const res = await fetch(u, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("saramin " + res.status);
  const data = await res.json();
  return data?.jobs?.job || [];
}

function fromSaramin(x) {
  const pos = x.position || {};
  const exp = pos["experience-level"] || {};
  const title = pos.title || "";
  const role = roleOf(title);
  if (!role.length || !careerOk(exp)) return null;
  const exp1 = Number(x["expiration-timestamp"] || 0) * 1000;
  const dead = exp1 ? Math.ceil((exp1 - Date.now()) / 86400000) : null;
  if (dead !== null && dead < 0) return null;
  return {
    id: "s" + x.id, co: x.company?.detail?.name || "", ti: title, role,
    car: exp.name || "경력 미표기", tier: "?", area: pos.location?.name || "", addr: pos.location?.name || "",
    size: "규모 미확인", dead, newTag: Date.now() - Number(x["posting-timestamp"] || 0) * 1000 < 86400000,
    src: [{ n: "사람인", u: x.url }], s: [role.length ? 24 : 0, 14, 8, 8],
    why: "제목 키워드로 자동 분류한 값이에요 (추측)", note: "자동 수집 · 공고 상세는 원문에서 확인"
  };
}

// manual의 deadDate(YYYY-MM-DD)를 오늘 기준 남은 일수로 바꾸고, 지난 공고는 뺌 (한국 시간 기준)
const todayKst = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const dayDiff = (d) => Math.round((Date.parse(d) - Date.parse(todayKst)) / 86400000);
const manualLive = [];
for (const j of manual) {
  if (j.deadDate) { j.dead = dayDiff(j.deadDate); if (j.dead < 0) continue; }
  manualLive.push(j);
}

let auto = [];
if (KEY) {
  try {
    const seen = new Set();
    for (const q of QUERIES) {
      for (const x of await saramin(q)) {
        if (seen.has(x.id)) continue; seen.add(x.id);
        const j = fromSaramin(x); if (j) auto.push(j);
      }
    }
  } catch (e) { console.error("사람인 수집 실패:", e.message); }
} else console.log("SARAMIN_KEY 없음: 수동 공고만 사용");

// 합치기: 같은 공고는 하나로 묶고 출처만 늘림
const map = new Map();
for (const j of [...manualLive, ...auto]) {
  const k = dupKey(j);
  if (map.has(k)) { const t = map.get(k); for (const s of j.src) if (!t.src.some((y) => y.n === s.n)) t.src.push(s); }
  else map.set(k, j);
}
const out = { updated: new Date().toISOString(), sources: { saramin: auto.length, manual: manualLive.length }, jobs: [...map.values()] };
writeFileSync("data/jobs.json", JSON.stringify(out, null, 1));
console.log("jobs", out.jobs.length, out.sources);
