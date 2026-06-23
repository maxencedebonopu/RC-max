// RecompCoach — sync tél ↔ PC (Vercel Serverless + stockage Upstash/KV)
// À placer dans le dépôt sous : api/sync.js
// Variables d'environnement injectées automatiquement par Vercel quand tu connectes
// un stockage Upstash Redis / Vercel KV au projet.
module.exports = async (req, res) => {
  const BASE  = process.env.KV_REST_API_URL  || process.env.UPSTASH_REDIS_REST_URL;
  const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!BASE || !TOKEN) {
    res.status(500).json({ ok:false, error:"Stockage non configuré (variables Upstash/KV manquantes). Connecte un stockage au projet sur Vercel." });
    return;
  }
  const raw  = (req.query && req.query.key) ? String(req.query.key) : "default";
  const code = raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "default";
  const rkey = "recompcoach:" + code;
  const auth = { Authorization: "Bearer " + TOKEN };
  try {
    if (req.method === "GET") {
      const r = await fetch(BASE + "/get/" + encodeURIComponent(rkey), { headers: auth });
      const j = await r.json();
      let data = null;
      if (j && j.result) { try { data = JSON.parse(j.result); } catch (e) { data = null; } }
      res.status(200).json({ ok:true, data });
      return;
    }
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      const payload = (body && body.app !== undefined) ? { app: body.app, ts: body.ts || Date.now() } : (body || {});
      const val = JSON.stringify(payload);
      await fetch(BASE + "/set/" + encodeURIComponent(rkey), {
        method: "POST",
        headers: Object.assign({ "Content-Type": "text/plain" }, auth),
        body: val
      });
      res.status(200).json({ ok:true, saved:true });
      return;
    }
    res.status(405).json({ ok:false, error:"method" });
  } catch (e) {
    res.status(500).json({ ok:false, error: String((e && e.message) || e) });
  }
};
