// Cloudflare Worker: "수집 즉시 실행" 버튼이 호출하는 중계 서버.
// 비밀값 GH_TOKEN(레포 하나에 Actions 쓰기 권한만 가진 fine-grained 토큰)은 Worker 비밀값으로만 저장한다. 코드와 레포에 넣지 않는다.
const OWNER = "dabin-oss", REPO = "job-board", WORKFLOW = "collect.yml";
const ALLOWED_ORIGIN = "https://dabin-oss.github.io";
const COOLDOWN_SEC = 300; // 5분 안에는 다시 실행하지 않음 (남용 방지)

const cors = (extra = {}) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  ...extra,
});

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
    if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: cors() });
    if (req.headers.get("Origin") !== ALLOWED_ORIGIN) return new Response("forbidden", { status: 403 });

    const cache = caches.default;
    const key = new Request("https://relay.local/cooldown");
    if (await cache.match(key)) {
      return new Response(JSON.stringify({ ok: false, reason: "cooldown" }), { status: 429, headers: cors({ "Content-Type": "application/json" }) });
    }
    const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "job-board-relay", "X-GitHub-Api-Version": "2022-11-28" },
      body: JSON.stringify({ ref: "main" }),
    });
    if (r.status === 204) {
      await cache.put(key, new Response("1", { headers: { "Cache-Control": `max-age=${COOLDOWN_SEC}` } }));
      return new Response(JSON.stringify({ ok: true }), { headers: cors({ "Content-Type": "application/json" }) });
    }
    return new Response(JSON.stringify({ ok: false, reason: "github " + r.status }), { status: 502, headers: cors({ "Content-Type": "application/json" }) });
  },
};
