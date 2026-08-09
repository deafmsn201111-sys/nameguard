import { useState } from "react";

interface ScoreReport { account_id: string; overall_score: number; reasons: { factor: string; score: number; detail: string }[]; }

function scoreColor(s: number): string { return s >= 70 ? "#dc2626" : s >= 40 ? "#ea580c" : s > 0 ? "#ca8a04" : "#16a34a"; }
function scoreLabel(s: number): string { return s >= 70 ? "High Risk — Likely Squatter" : s >= 40 ? "Medium Risk — Suspicious" : s > 0 ? "Low Risk" : "Clean"; }

function rpcCall(method_name: string, args: any): Promise<any> {
  return fetch("https://rpc.testnet.near.org", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: "ng",
      method: "query",
      params: {
        request_type: "call_function",
        account_id: "nameguard.testnet",
        method_name,
        args_base64: btoa(JSON.stringify(args)),
        finality: "optimistic",
      },
    }),
  }).then(r => r.json()).then(json => {
    const bytes = json.result?.result;
    if (bytes && Array.isArray(bytes)) {
      return JSON.parse(new TextDecoder().decode(new Uint8Array(bytes)));
    }
    return null;
  });
}

async function checkAccount(id: string): Promise<ScoreReport> {
  // Try cache first
  const cached = await rpcCall("get_report", { account_id: id });
  if (cached) return cached;

  // If not cached, fallback: estimate score client-side
  const name = id.toLowerCase().replace(".near", "").replace(".testnet", "");
  const reasons: { factor: string; score: number; detail: string }[] = [];
  let total = 0;

  const len = name.length;
  if (len <= 2) { reasons.push({ factor: "name_length", score: 30, detail: `Very short name (${len} chars)` }); total += 30; }
  else if (len <= 4) { reasons.push({ factor: "name_length", score: 15, detail: `Short name (${len} chars)` }); total += 15; }

  if (/^\d+$/.test(name) || /^[a-z]\d+$/.test(name)) {
    reasons.push({ factor: "auto_generated", score: 25, detail: "Matches auto-generated pattern" });
    total += 25;
  }

  // Known trademarks (cached from contract)
  const tms = ["google", "meta", "twitter", "x", "apple", "microsoft", "openai", "near", "coinbase", "binance"];
  if (tms.includes(name)) {
    reasons.push({ factor: "trademark", score: 50, detail: `Name matches protected trademark: ${name}` });
    total += 50;
  }

  return { account_id: id, overall_score: Math.min(total, 100), reasons };
}

const s: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 640, margin: "0 auto", padding: "24px 16px", fontFamily: 'system-ui, sans-serif', color: "#1a1a2e" },
  card: { border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  input: { flex: 1, padding: "10px 14px", fontSize: 15, border: "1px solid #cbd5e1", borderRadius: 8, outline: "none" },
  btn: { padding: "10px 20px", fontSize: 15, border: "none", borderRadius: 8, background: "#2563eb", color: "#fff", cursor: "pointer", fontWeight: 600 },
  chip: { padding: "4px 12px", borderRadius: 20, background: "#f1f5f9", color: "#475569", fontSize: 13, cursor: "pointer", border: "1px solid #e2e8f0" },
  badge: { width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 24, fontWeight: 700, flexShrink: 0 },
  th: { textAlign: "left", padding: "6px 8px", borderBottom: "2px solid #e2e8f0", color: "#64748b", fontWeight: 600, fontSize: 12, textTransform: "uppercase" as const },
  td: { padding: 8, borderBottom: "1px solid #f1f5f9" },
};

const examples = ["vitalik.near", "google.near", "a12345.near", "ab.near", "meta.near"];

function App() {
  const [input, setInput] = useState("");
  const [report, setReport] = useState<ScoreReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const check = async () => {
    const id = input.trim().toLowerCase();
    if (!id) return;
    setLoading(true); setErr(""); setReport(null);
    try {
      setReport(await checkAccount(id));
    } catch (e: any) {
      setErr(e.message || "Check failed");
    } finally { setLoading(false); }
  };

  return (
    <div style={s.wrap}>
      <h1 style={{ textAlign: "center", fontSize: 36, margin: 0 }}>🛡️ NameGuard</h1>
      <p style={{ textAlign: "center", color: "#64748b", marginTop: 4, fontSize: 14 }}>Anti-Squatting Scoring for NEAR</p>

      <div style={s.card}>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="e.g. vitalik.near" onKeyDown={e => e.key === "Enter" && check()} style={s.input} />
          <button onClick={check} disabled={loading} style={{ ...s.btn, opacity: loading ? 0.6 : 1 }}>{loading ? "⏳" : "🔍 Check"}</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {examples.map(ex => <span key={ex} style={s.chip} onClick={() => { setInput(ex); setReport(null); setErr(""); }}>{ex}</span>)}
        </div>
      </div>

      {err && <div style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 14 }}>{err}</div>}

      {report && (
        <div style={{ ...s.card, border: "2px solid #e2e8f0", boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div style={{ ...s.badge, background: scoreColor(report.overall_score) }}>{report.overall_score}</div>
            <div><div style={{ fontSize: 18, fontWeight: 600 }}>{scoreLabel(report.overall_score)}</div>
            <div style={{ fontSize: 14, color: "#64748b", fontFamily: "monospace" }}>{report.account_id}</div></div>
          </div>
          {report.reasons.length > 0 ? (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px 0", color: "#334155" }}>Contributing Factors</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead><tr><th style={s.th}>Factor</th><th style={s.th}>Score</th><th style={s.th}>Detail</th></tr></thead>
                <tbody>{report.reasons.map((r, i) => (
                  <tr key={i}><td style={s.td}><code>{r.factor}</code></td>
                  <td style={{ ...s.td, color: scoreColor(r.score) }}>+{r.score}</td>
                  <td style={s.td}>{r.detail}</td></tr>
                ))}</tbody>
              </table>
            </>
          ) : <p style={{ color: "#16a34a", fontWeight: 500 }}>✅ No suspicious factors detected.</p>}
        </div>
      )}

      <div style={s.card}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px 0", color: "#334155" }}>How Scoring Works</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr><th style={s.th}>Factor</th><th style={s.th}>Max</th><th style={s.th}>Detects</th></tr></thead>
          <tbody>
            {[["name_length","30","1–2 chars (+30), 3–4 chars (+15)"],["auto_generated","25","Digits-only or letter+digits"],["trademark","50","Matches protected brand"],["no_profile","15","No SocialDB profile"]].map(([f,m,d]) => (
              <tr key={f}><td style={s.td}><code>{f}</code></td><td style={s.td}>{m}</td><td style={s.td}>{d}</td></tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>Score capped at <strong>100</strong>. Higher = more likely a squatter.</p>
      </div>

      <footer style={{ textAlign: "center", fontSize: 13, color: "#94a3b8", marginTop: 32, padding: "16px 0" }}>
        <a href="https://github.com/deafmsn201111-sys/nameguard" target="_blank" style={{ color: "#2563eb" }}>GitHub</a>
        {" · "}
        <a href="https://explorer.testnet.near.org/accounts/nameguard.testnet" target="_blank" style={{ color: "#2563eb" }}>Explorer</a>
        {" · "} @nameguard.testnet
      </footer>
    </div>
  );
}

export default App;
