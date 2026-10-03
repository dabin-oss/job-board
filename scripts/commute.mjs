// 통근 시간 계산: 카카오 로컬(주소 좌표) + ODsay(대중교통 소요시간).
// 결과는 data/commute-cache.json에 주소별로 저장해 재호출을 막음. ODsay 무료는 하루 30회라 한 번에 최대 MAX_NEW건만 새로 계산.
// API 응답 필드는 공식 문서 기억 기반이라 키 발급 후 첫 실행에서 검증 필요 (추측).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const KAKAO = process.env.KAKAO_REST_KEY || "";
const ODSAY = process.env.ODSAY_KEY || "";
const MAX_NEW = 8;
const cachePath = "data/commute-cache.json";
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
const data = JSON.parse(readFileSync("data/jobs.json", "utf8"));

const kakaoGet = async (url) => {
  const r = await fetch(url, { headers: { Authorization: "KakaoAK " + KAKAO } });
  if (!r.ok) throw new Error("kakao " + r.status);
  return r.json();
};
async function geocode(q) {
  const base = "https://dapi.kakao.com/v2/local/search/";
  let d = await kakaoGet(base + "address.json?query=" + encodeURIComponent(q));
  if (!d.documents?.length) d = await kakaoGet(base + "keyword.json?query=" + encodeURIComponent(q));
  const x = d.documents?.[0];
  return x ? { x: Number(x.x), y: Number(x.y) } : null;
}
async function transitMin(o, p) {
  const u = `https://api.odsay.com/v1/api/searchPubTransPathT?SX=${o.x}&SY=${o.y}&EX=${p.x}&EY=${p.y}&apiKey=${encodeURIComponent(ODSAY)}`;
  const d = await (await fetch(u)).json();
  const t = d?.result?.path?.[0]?.info?.totalTime;
  return typeof t === "number" ? t : null;
}
async function driveMin(o, p) {
  const d = await kakaoGet(`https://apis-navi.kakaomobility.com/v1/directions?origin=${o.x},${o.y}&destination=${p.x},${p.y}`);
  const s = d?.routes?.[0]?.summary?.duration;
  return typeof s === "number" ? Math.round(s / 60) : null;
}
const tierOf = (m) => (m <= 15 ? "0" : m <= 30 ? "1" : m <= 60 ? "2" : "X");
const stationName = (addr) => addr.replace(/\(.*?\)/g, "").trim();

if (KAKAO && ODSAY) {
  const home = await geocode("애오개역 5호선");
  let used = 0;
  for (const j of data.jobs) {
    const key = stationName(j.addr || j.area || "");
    if (!key || /원격/.test(key)) continue;
    if (!cache[key] && used < MAX_NEW) {
      try {
        const p = await geocode(key);
        if (p && home) {
          const c = { transit: await transitMin(home, p) };
          used++;
          cache[key] = c;
        }
      } catch (e) { console.error("통근 계산 실패:", key, e.message); }
    }
  }
  writeFileSync(cachePath, JSON.stringify(cache, null, 1));
} else console.log("KAKAO_REST_KEY 또는 ODSAY_KEY 없음: 캐시만 적용");
writeFileSync(cachePath, JSON.stringify(cache, null, 1));

for (const j of data.jobs) {
  const key = stationName(j.addr || j.area || "");
  const c = cache[key];
  if (!c) continue;
  const t = c.transit != null ? tierOf(c.transit) : null;
  if (t) { j.tier = t; j.min = c.transit; j.mode = t === "0" ? "도보" : "대중교통"; }
}
writeFileSync("data/jobs.json", JSON.stringify(data, null, 1));
console.log("통근 반영 완료", Object.keys(cache).length, "주소 캐시");
