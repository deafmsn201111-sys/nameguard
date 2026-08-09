import React, { useState } from "react";
import {
  checkAccountStatus,
  signIn,
  signOut,
  isSignedIn,
  getAccountId,
} from "./near/wallet";

interface ScoreReport {
  account_id: string;
  overall_score: number;
  reasons: { factor: string; score: number; detail: string }[];
}

interface AccountStatus {
  account_id: string;
  exists: boolean;
  score_report: ScoreReport | null;
  suggestions: string[];
}

function scoreColor(score: number): string {
  if (score >= 70) return "#dc2626";
  if (score >= 40) return "#ea580c";
  if (score > 0) return "#ca8a04";
  return "#16a34a";
}

function scoreLabel(score: number): string {
  if (score >= 70) return "High Risk — Likely Squatter";
  if (score >= 40) return "Medium Risk — Suspicious";
  if (score > 0) return "Low Risk";
  return "Clean — Looks Legitimate";
}

function App() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCheck = async () => {
    const id = input.trim().toLowerCase();
    if (!id) return;
    const fullId = id.includes(".") ? id : `${id}.near`;
    setLoading(true);
    setError("");
    setStatus(null);
    try {
      const result = await checkAccountStatus(fullId);
      setStatus(result);
    } catch (e: any) {
      setError(e.message || "Check failed. Try connecting wallet.");
    } finally {
      setLoading(false);
    }
  };

  const examples = ["vitalik.near", "google.near", "a12345.near", "ab.near"];

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>🛡️ NameGuard</h1>
        <p style={styles.subtitle}>
          Anti-Squatting Scoring Engine for NEAR Protocol
        </p>
      </header>

      <div style={styles.authBar}>
        {isSignedIn() ? (
          <span>
            Signed in as <strong>{getAccountId()}</strong>
            {" · "}
            <button style={styles.textBtn} onClick={signOut}>
              Sign Out
            </button>
          </span>
        ) : (
          <button style={styles.textBtn} onClick={signIn}>
            🔑 Connect Wallet
          </button>
        )}
      </div>

      <div style={styles.card}>
        <label style={styles.label}>Check a NEAR account</label>
        <div style={styles.inputRow}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. vitalik.near"
            onKeyDown={(e) => e.key === "Enter" && handleCheck()}
            style={styles.input}
          />
          <button
            onClick={handleCheck}
            disabled={loading}
            style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "⏳" : "🔍 Check"}
          </button>
        </div>
        <div style={styles.examples}>
          {examples.map((ex) => (
            <span
              key={ex}
              style={styles.chip}
              onClick={() => {
                setInput(ex);
                setStatus(null);
                setError("");
              }}
            >
              {ex}
            </span>
          ))}
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {status && (
        <>
          {!status.exists && (
            <div
              style={{
                ...styles.card,
                backgroundColor: "#f0fdf4",
                border: "2px solid #22c55e",
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#16a34a",
                  marginBottom: 8,
                }}
              >
                ✅ Account <strong>{status.account_id}</strong> is available!
              </div>
              <button
                style={styles.btn}
                onClick={() =>
                  window.open(
                    `https://testnet.mynearwallet.com/create/${status.account_id}`,
                    "_blank"
                  )
                }
              >
                🚀 Claim {status.account_id}
              </button>
            </div>
          )}

          {status.exists && status.score_report && (
            <div style={styles.reportCard}>
              <div style={styles.scoreSection}>
                <div
                  style={{
                    ...styles.scoreBadge,
                    backgroundColor: scoreColor(status.score_report.overall_score),
                  }}
                >
                  {status.score_report.overall_score}
                </div>
                <div>
                  <div style={styles.scoreLabel}>
                    {scoreLabel(status.score_report.overall_score)}
                  </div>
                  <div style={styles.accountName}>{status.account_id}</div>
                  <div
                    style={{ fontSize: 13, color: "#ef4444", marginTop: 4 }}
                  >
                    ⚠️ This account is already taken
                  </div>
                </div>
              </div>

              {status.score_report.reasons.length > 0 && (
                <div style={styles.reasonsSection}>
                  <h3 style={styles.sectionTitle}>Contributing Factors</h3>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Factor</th>
                        <th style={styles.th}>Score</th>
                        <th style={styles.th}>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.score_report.reasons.map((r, i) => (
                        <tr key={i}>
                          <td style={styles.td}>
                            <code>{r.factor}</code>
                          </td>
                          <td
                            style={{ ...styles.td, color: scoreColor(r.score) }}
                          >
                            +{r.score}
                          </td>
                          <td style={styles.td}>{r.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {status.score_report.reasons.length === 0 && (
                <p style={styles.cleanMsg}>
                  ✅ No suspicious factors detected. This account looks clean.
                </p>
              )}

              {status.suggestions.length > 0 && (
                <div
                  style={{
                    marginTop: 20,
                    borderTop: "1px solid #e2e8f0",
                    paddingTop: 16,
                  }}
                >
                  <h3 style={styles.sectionTitle}>
                    💡 Similar Available Names
                  </h3>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#64748b",
                      marginBottom: 12,
                    }}
                  >
                    {status.account_id} is taken, but these similar names may
                    be free:
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {status.suggestions.map((sug, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          backgroundColor: "#f8fafc",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <code style={{ fontSize: 14, color: "#1e293b" }}>
                          {sug}
                        </code>
                        <a
                          href={`https://testnet.mynearwallet.com/create/${sug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            ...styles.btn,
                            padding: "6px 14px",
                            fontSize: 13,
                            textDecoration: "none",
                          }}
                        >
                          Claim
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>How Scoring Works</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Factor</th>
              <th style={styles.th}>Max</th>
              <th style={styles.th}>Detects</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["name_length", "30", "1–2 chars (+30), 3–4 chars (+15)"],
              ["auto_generated", "25", "Digits-only or letter+digits"],
              ["trademark", "50", "Matches protected brand"],
              ["no_profile", "15", "No SocialDB profile"],
            ].map(([f, max, desc]) => (
              <tr key={f}>
                <td style={styles.td}>
                  <code>{f}</code>
                </td>
                <td style={styles.td}>{max}</td>
                <td style={styles.td}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={styles.footnote}>
          Score is capped at <strong>100</strong>. Higher = more likely a
          squatter.
        </p>
      </div>

      <footer style={styles.footer}>
        <p>
          <a
            href="https://github.com/deafmsn201111-sys/nameguard"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          {" · "}
          <a
            href="https://explorer.testnet.near.org/accounts/nameguard.testnet"
            target="_blank"
            rel="noopener noreferrer"
          >
            Explorer
          </a>
          {" · "}
          @nameguard.testnet
        </p>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 680,
    margin: "0 auto",
    padding: "24px 16px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: "#1a1a2e",
  },
  header: {
    textAlign: "center",
    marginBottom: 24,
  },
  logo: {
    fontSize: 36,
    margin: 0,
  },
  subtitle: {
    color: "#64748b",
    marginTop: 4,
    fontSize: 14,
  },
  authBar: {
    textAlign: "right",
    fontSize: 13,
    color: "#64748b",
    marginBottom: 16,
  },
  textBtn: {
    background: "none",
    border: "none",
    color: "#2563eb",
    cursor: "pointer",
    fontSize: 13,
    padding: 0,
    textDecoration: "underline",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    backgroundColor: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  label: {
    fontWeight: 600,
    fontSize: 14,
    marginBottom: 8,
    display: "block",
  },
  inputRow: {
    display: "flex",
    gap: 8,
  },
  input: {
    flex: 1,
    padding: "10px 14px",
    fontSize: 15,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    outline: "none",
  },
  btn: {
    padding: "10px 20px",
    fontSize: 15,
    border: "none",
    borderRadius: 8,
    backgroundColor: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  examples: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 12,
  },
  chip: {
    padding: "4px 12px",
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    color: "#475569",
    fontSize: 13,
    cursor: "pointer",
    border: "1px solid #e2e8f0",
  },
  error: {
    backgroundColor: "#fef2f2",
    color: "#dc2626",
    borderRadius: 8,
    padding: "10px 16px",
    marginBottom: 16,
    fontSize: 14,
  },
  reportCard: {
    border: "2px solid #e2e8f0",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    backgroundColor: "#ffffff",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
  },
  scoreSection: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  scoreBadge: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: 24,
    fontWeight: 700,
    flexShrink: 0,
  },
  scoreLabel: {
    fontSize: 18,
    fontWeight: 600,
  },
  accountName: {
    fontSize: 14,
    color: "#64748b",
    fontFamily: "monospace",
  },
  reasonsSection: {},
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    margin: "0 0 8px 0",
    color: "#334155",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 14,
  },
  th: {
    textAlign: "left",
    padding: "6px 8px",
    borderBottom: "2px solid #e2e8f0",
    color: "#64748b",
    fontWeight: 600,
    fontSize: 12,
    textTransform: "uppercase" as const,
  },
  td: {
    padding: "8px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
  },
  cleanMsg: {
    color: "#16a34a",
    fontWeight: 500,
    fontSize: 15,
  },
  footnote: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 8,
  },
  footer: {
    textAlign: "center",
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 32,
    padding: "16px 0",
  },
};

export default App;