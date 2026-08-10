import { useState, useCallback } from "react";
import {
  checkAccountStatus,
  signIn,
  signOut,
  isSignedIn,
  getAccountId,
  addTrademark,
} from "./near/wallet";
import config from "./near/config";

const nearConfig = config();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

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

function scoreEmoji(score: number): string {
  if (score >= 70) return "\u{1F534}";
  if (score >= 40) return "\u{1F7E0}";
  if (score > 0) return "\u{1F7E1}";
  return "\u{1F7E2}";
}

// ---------------------------------------------------------------------------
// Main app
// ---------------------------------------------------------------------------

export default function App() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tmInput, setTmInput] = useState("");
  const [tmLoading, setTmLoading] = useState(false);
  const [tmMsg, setTmMsg] = useState("");

  const examples = [
    "vitalik.near",
    "google.near",
    "a12345.near",
    "ab.near",
    "microsoft.near",
  ];

  // -----------------------------------------------------------------------
  // Check account
  // -----------------------------------------------------------------------

  const handleCheck = useCallback(async () => {
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
  }, [input]);

  // -----------------------------------------------------------------------
  // Add trademark (anyone, paid 0.1 NEAR)
  // -----------------------------------------------------------------------

  const handleAddTrademark = useCallback(async () => {
    const name = tmInput.trim().toLowerCase();
    if (!name) return;
    if (!isSignedIn()) {
      setTmMsg("Please connect wallet first");
      return;
    }
    setTmLoading(true);
    setTmMsg("");
    try {
      await addTrademark(name);
      setTmMsg(`\u2705 Trademark "${name}" added (0.1 NEAR paid)`);
      setTmInput("");
    } catch (e: any) {
      setTmMsg(`\u274C ${e.message || "Failed"}`);
    } finally {
      setTmLoading(false);
    }
  }, [tmInput]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.logo}>\u{1F6E1}\uFE0F NameGuard</div>
        <p style={styles.subtitle}>
          Anti-Squatting Scoring Engine for NEAR Protocol
        </p>
      </header>

      {/* WALLET AUTH BAR */}
      <div style={styles.authBar}>
        {isSignedIn() ? (
          <span>
            Connected as <strong>{getAccountId()}</strong>
            {" \u00B7 "}
            <button style={styles.textBtn} onClick={signOut}>
              Disconnect
            </button>
          </span>
        ) : (
          <button style={styles.walletBtn} onClick={signIn}>
            \u{1F511} Connect Wallet
          </button>
        )}
      </div>

      {/* SEARCH */}
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
            style={{
              ...styles.btnPrimary,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "\u23F3 Scanning..." : "\u{1F50D} Check"}
          </button>
        </div>
        <div style={styles.examples}>
          <span style={styles.exampleLabel}>Try: </span>
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

      {/* ERROR */}
      {error && <div style={styles.error}>{error}</div>}

      {/* RESULTS */}
      {status && (
        <>
          {/* Account does not exist — available */}
          {!status.exists && (
            <div style={styles.availableCard}>
              <div style={styles.availableIcon}>\u2705</div>
              <div style={styles.availableContent}>
                <div style={styles.availableTitle}>
                  Account <strong>{status.account_id}</strong> is available!
                </div>
                <p style={styles.availableDesc}>
                  This account is not registered yet. You can claim it now.
                </p>
                <button
                  style={styles.btnPrimary}
                  onClick={() =>
                    window.open(
                      `${
                        nearConfig.walletUrl
                      }/create/${encodeURIComponent(status.account_id)}`,
                      "_blank"
                    )
                  }
                >
                  \u{1F680} Claim {status.account_id}
                </button>
              </div>
            </div>
          )}

          {/* Account exists — show score */}
          {status.exists && status.score_report && (
            <div style={styles.reportCard}>
              {/* Score badge */}
              <div style={styles.scoreSection}>
                <div
                  style={{
                    ...styles.scoreBadge,
                    backgroundColor: scoreColor(
                      status.score_report.overall_score
                    ),
                  }}
                >
                  <span style={styles.scoreBadgeNumber}>
                    {status.score_report.overall_score}
                  </span>
                  <span style={styles.scoreBadgeMax}>/100</span>
                </div>
                <div>
                  <div style={styles.scoreLabel}>
                    {scoreEmoji(status.score_report.overall_score)}{" "}
                    {scoreLabel(status.score_report.overall_score)}
                  </div>
                  <div style={styles.accountName}>
                    {status.account_id}
                  </div>
                  <div style={styles.warningBadge}>
                    \u26A0\uFE0F This account is already taken
                  </div>
                </div>
              </div>

              {/* Factors table */}
              {status.score_report.reasons.length > 0 && (
                <div style={styles.reasonsSection}>
                  <h3 style={styles.sectionTitle}>
                    \u{1F4CA} Contributing Factors
                  </h3>
                  <div style={styles.factorsList}>
                    {status.score_report.reasons.map((r, i) => (
                      <div key={i} style={styles.factorRow}>
                        <div style={styles.factorLeft}>
                          <code style={styles.factorCode}>
                            {r.factor}
                          </code>
                          <span style={styles.factorDetail}>
                            {r.detail}
                          </span>
                        </div>
                        <div
                          style={{
                            ...styles.factorScore,
                            color: scoreColor(r.score),
                          }}
                        >
                          +{r.score}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clean message */}
              {status.score_report.reasons.length === 0 && (
                <p style={styles.cleanMsg}>
                  \u2705 No suspicious factors detected. This account looks
                  legitimate.
                </p>
              )}

              {/* Suggestions */}
              {status.suggestions.length > 0 && (
                <div style={styles.suggestionsSection}>
                  <h3 style={styles.sectionTitle}>
                    \u{1F4A1} Similar Available Names
                  </h3>
                  <p style={styles.suggestionsDesc}>
                    {status.account_id} is taken, but these similar names
                    may be free:
                  </p>
                  <div style={styles.suggestionsList}>
                    {status.suggestions.map((sug, i) => (
                      <div key={i} style={styles.suggestionItem}>
                        <code style={styles.suggestionName}>
                          {sug}
                        </code>
                        <a
                          href={`${nearConfig.walletUrl}/create/${encodeURIComponent(sug)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.btnSmall}
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

          {/* Exists but no score (fallback from RPC check) */}
          {status.exists && !status.score_report && (
            <div style={styles.card}>
              <p>
                Account <strong>{status.account_id}</strong> exists on
                NEAR.
              </p>
              <p>
                Connect your wallet to get a full squatting score.
              </p>
            </div>
          )}
        </>
      )}

      {/* SCORING TABLE (info) */}
      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>\u{1F4CB} How Scoring Works</h3>
        <div style={styles.scoringTable}>
          {[
            ["name_length", "30", "1\u20132 chars (+30), 3\u20134 chars (+15)"],
            ["auto_generated", "25", "Digits-only or letter+digits"],
            ["trademark", "50", "Matches protected brand"],
          ].map(([factor, max, desc]) => (
            <div key={factor} style={styles.scoringRow}>
              <code style={styles.scoringFactor}>{factor}</code>
              <span style={styles.scoringMax}>+{max}</span>
              <span style={styles.scoringDesc}>{desc}</span>
            </div>
          ))}
        </div>
        <p style={styles.footnote}>
          Score is capped at <strong>100</strong>. Higher = more likely
          a squatter.
        </p>
      </div>

      {/* TRADEMARK ADMIN (anyone with wallet, 0.1 NEAR fee) */}
      {isSignedIn() && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>\u{1F3F7}\uFE0F Add Trademark</h3>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
            Anyone can add a protected brand name (fee: <strong>0.1 NEAR</strong>).
          </p>
          <div style={styles.inputRow}>
            <input
              value={tmInput}
              onChange={(e) => setTmInput(e.target.value)}
              placeholder="e.g. google"
              style={styles.input}
              onKeyDown={(e) =>
                e.key === "Enter" && handleAddTrademark()
              }
            />
            <button
              onClick={handleAddTrademark}
              disabled={tmLoading}
              style={{
                ...styles.btnPrimary,
                opacity: tmLoading ? 0.6 : 1,
              }}
            >
              {tmLoading ? "\u23F3" : "Add (0.1 NEAR)"}
            </button>
          </div>
          {tmMsg && (
            <p
              style={{
                fontSize: 13,
                marginTop: 8,
                color: tmMsg.startsWith("\u2705") ? "#16a34a" : "#dc2626",
              }}
            >
              {tmMsg}
            </p>
          )}
        </div>
      )}

      {/* FOOTER */}
      <footer style={styles.footer}>
        <p>
          <a
            href="https://github.com/deafmsn201111-sys/nameguard"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.footerLink}
          >
            GitHub
          </a>
          {" \u00B7 "}
          <a
            href={`${nearConfig.explorerUrl}/accounts/${nearConfig.contractId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.footerLink}
          >
            Explorer
          </a>
          {" \u00B7 "}
          <span style={styles.footerContract}>
            {nearConfig.contractId}
          </span>
          {" \u00B7 "}
          <a
            href={`${nearConfig.walletUrl}/create/nameguard.near`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.footerLink}
          >
            Get NameGuard
          </a>
        </p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
    fontWeight: 700,
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
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
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
  walletBtn: {
    padding: "8px 18px",
    fontSize: 13,
    border: "none",
    borderRadius: 8,
    backgroundColor: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
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
  btnPrimary: {
    padding: "10px 20px",
    fontSize: 15,
    border: "none",
    borderRadius: 8,
    backgroundColor: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  examples: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 12,
    alignItems: "center",
  },
  exampleLabel: {
    fontSize: 13,
    color: "#64748b",
  },
  chip: {
    padding: "4px 12px",
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    color: "#475569",
    fontSize: 12,
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
  // --- available card ---
  availableCard: {
    border: "2px solid #22c55e",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    backgroundColor: "#f0fdf4",
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
  },
  availableIcon: {
    fontSize: 28,
    flexShrink: 0,
  },
  availableContent: {
    flex: 1,
  },
  availableTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "#16a34a",
    marginBottom: 6,
  },
  availableDesc: {
    fontSize: 14,
    color: "#15803d",
    margin: "0 0 12px 0",
  },
  // --- report ---
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
    width: 80,
    height: 80,
    borderRadius: "50%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    flexShrink: 0,
  },
  scoreBadgeNumber: {
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1,
  },
  scoreBadgeMax: {
    fontSize: 11,
    opacity: 0.9,
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
  warningBadge: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
    fontWeight: 500,
  },
  reasonsSection: {
    marginTop: 8,
  },
  factorsList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  factorRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "10px 12px",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
  },
  factorLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  factorCode: {
    fontSize: 13,
    color: "#2563eb",
    fontWeight: 600,
  },
  factorDetail: {
    fontSize: 12,
    color: "#64748b",
  },
  factorScore: {
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
  },
  cleanMsg: {
    color: "#16a34a",
    fontWeight: 500,
    fontSize: 15,
    marginTop: 8,
  },
  suggestionsSection: {
    marginTop: 20,
    borderTop: "1px solid #e2e8f0",
    paddingTop: 16,
  },
  suggestionsDesc: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 12,
  },
  suggestionsList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  suggestionItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
  },
  suggestionName: {
    fontSize: 14,
    color: "#1e293b",
  },
  btnSmall: {
    padding: "6px 14px",
    fontSize: 13,
    border: "none",
    borderRadius: 8,
    backgroundColor: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    textDecoration: "none",
    display: "inline-block",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    margin: "0 0 8px 0",
    color: "#334155",
  },
  scoringTable: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  scoringRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "6px 0",
    borderBottom: "1px solid #f1f5f9",
  },
  scoringFactor: {
    fontSize: 13,
    color: "#2563eb",
    fontWeight: 600,
    minWidth: 140,
  },
  scoringMax: {
    fontSize: 14,
    fontWeight: 700,
    color: "#ea580c",
    minWidth: 40,
  },
  scoringDesc: {
    fontSize: 13,
    color: "#475569",
    flex: 1,
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
  footerLink: {
    color: "#2563eb",
    textDecoration: "none",
  },
  footerContract: {
    color: "#64748b",
  },
};