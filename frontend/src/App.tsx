import React, { useState } from "react";
import { checkAccount, signIn, signOut, isSignedIn, getAccountId } from "./near/wallet";

interface ScoreReport {
  account_id: string;
  overall_score: number;
  reasons: { factor: string; score: number; detail: string }[];
}

function scoreColor(score: number): string {
  if (score >= 70) return "red";
  if (score >= 40) return "orange";
  if (score > 0) return "yellow";
  return "green";
}

function App() {
  const [input, setInput] = useState("");
  const [report, setReport] = useState<ScoreReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCheck = async () => {
    const id = input.trim().toLowerCase();
    if (!id) return;
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const result = await checkAccount(id);
      setReport(result);
    } catch (e: any) {
      setError(e.message || "Check failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>🛡️ NameGuard</h1>
      <p>Anti-squatting score for NEAR accounts</p>

      <div style={{ marginBottom: 16 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. example.near"
          onKeyDown={(e) => e.key === "Enter" && handleCheck()}
          style={{ width: "70%", padding: 8, fontSize: 16 }}
        />
        <button onClick={handleCheck} disabled={loading} style={{ padding: "8px 16px", fontSize: 16, marginLeft: 8 }}>
          {loading ? "Checking..." : "Check"}
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {report && (
        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, marginTop: 8 }}>
          <h2 style={{ color: scoreColor(report.overall_score) }}>
            Score: {report.overall_score}/100
          </h2>
          <p><strong>Account:</strong> {report.account_id}</p>
          <ul>
            {report.reasons.map((r, i) => (
              <li key={i}>
                <strong>{r.factor}:</strong> +{r.score} — {r.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      <hr style={{ margin: "32px 0" }} />
      <div>
        {isSignedIn() ? (
          <div>
            <p>Signed in as <strong>{getAccountId()}</strong></p>
            <button onClick={signOut}>Sign Out</button>
          </div>
        ) : (
          <button onClick={signIn}>Connect NEAR Wallet</button>
        )}
      </div>
    </div>
  );
}

export default App;