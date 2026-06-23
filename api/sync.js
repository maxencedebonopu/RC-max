// RecompCoach — sync tél ↔ PC (Vercel Serverless + Upstash/KV)
// À placer dans le dépôt sous : api/sync.js
module.exports = async (req, res) => {
  try {
    const env = process.env;
    const find = (re) => { for (const k in env) { if (re.test(k) && env[k]) return env[k]; } return null; };
    const BASE  = find(/(REST_API_URL|REDIS_REST_URL|KV_REST_API_URL)$/i) || find(/REST_URL$/i);
    const TOKEN = find(/(REST_API_TOKEN|REDIS_REST_TOKEN|KV_REST_API_TOKEN)$/i) || find(/REST_TOKEN$/i);
    if (!BASE || !TOKEN) {
      res.status(200).json({
        ok: false, configured: false,
        msg: "Stockage non détecté. Vérifie que la base Upstash/KV est bien CONNECTÉE au projet RC-max (et redéploie).",
        envSeen: Object.keys(env).filter(k => /KV|UPSTASH|REDIS/i.test(k))
      });
      return;
    }
    const raw  = (req.query && req.query.key) ? String(req.query.key) : "default";
    const code = raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "default";
    const rkey = "recompcoach:" + code;
    const auth = { Authorization: "Bearer " + TOKEN };
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      const payload = (body && body.app !== undefined) ? { app: body.app, ts: body.ts || Date.now() } : (body || {});
      const r = await fetch(BASE + "/set/" + encodeURIComponent(rkey), {
        method: "POST",
        headers: Object.assign({ "Content-Type": "text/plain" }, auth),
        body: JSON.stringify(payload)
      });
      res.status(200).json({ ok: r.ok, saved: r.ok });
      return;
    }
    const r = await fetch(BASE + "/get/" + encodeURIComponent(rkey), { headers: auth });
    const j = await r.json();
    let data = null;
    if (j && j.result) { try { data = JSON.parse(j.result); } catch (e) { data = null; } }
    res.status(200).json({ ok: true, configured: true, data });
  } catch (e) {
    res.status(200).json({ ok: false, error: String((e && e.message) || e) });
  }
};
