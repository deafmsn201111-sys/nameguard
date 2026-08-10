use near_sdk::store::{LookupMap, UnorderedSet};
use near_sdk::{env, near, near_bindgen, require, AccountId, NearToken, Promise};
use serde::{Deserialize, Serialize};

/// Max score cap
const MAX_SCORE: u8 = 100;

/// Suggested alternate names to generate
const SUGGESTION_COUNT: usize = 5;

/// Fee required to add a trademark (0.1 NEAR)
const TRADEMARK_FEE: NearToken = NearToken::from_near(1) / 10; // 0.1 NEAR

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

#[near(serializers = [borsh, json])]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ScoreReport {
    pub account_id: String,
    pub overall_score: u8,
    pub reasons: Vec<ScoreReason>,
}

#[near(serializers = [borsh, json])]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ScoreReason {
    pub factor: String,
    pub score: u8,
    pub detail: String,
}

#[near(serializers = [borsh, json])]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AccountStatus {
    pub account_id: String,
    pub exists: bool,
    pub score_report: Option<ScoreReport>,
    pub suggestions: Vec<String>,
}

// ---------------------------------------------------------------------------
// Contract state
// ---------------------------------------------------------------------------

#[near(contract_state)]
pub struct NameGuard {
    /// Cached scores keyed by AccountId
    pub scores: LookupMap<AccountId, ScoreReport>,
    /// Protected trademarks (UnorderedSet for O(1) lookups instead of Vec scan)
    pub trademarks: UnorderedSet<String>,
    /// Contract owner
    pub owner: AccountId,
}

impl Default for NameGuard {
    fn default() -> Self {
        Self {
            scores: LookupMap::new(b"s"),
            trademarks: UnorderedSet::new(b"t"),
            owner: "nameguard.testnet".parse().unwrap(),
        }
    }
}

#[near]
impl NameGuard {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            scores: LookupMap::new(b"s"),
            trademarks: UnorderedSet::new(b"t"),
            owner,
        }
    }

    // -----------------------------------------------------------------------
    // Owner-only guard
    // -----------------------------------------------------------------------

    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner,
            "Only owner can call this method"
        );
    }

    // -----------------------------------------------------------------------
    // Scoring engine
    // -----------------------------------------------------------------------

    /// Compute a squatting score for `account_id` using on-chain signals.
    /// Caches the result so subsequent reads are cheap.
    pub fn check(&mut self, account_id: AccountId) -> ScoreReport {
        let account_str = account_id.as_str().to_lowercase();
        let mut reasons: Vec<ScoreReason> = Vec::new();
        let mut total: u16 = 0;

        // ---- name_length ---------------------------------------------------
        let len = account_str.len();
        if len <= 2 {
            reasons.push(ScoreReason {
                factor: "name_length".into(),
                score: 30,
                detail: format!("Account name is very short ({} chars)", len),
            });
            total += 30;
        } else if len <= 4 {
            reasons.push(ScoreReason {
                factor: "name_length".into(),
                score: 15,
                detail: format!("Account name is short ({} chars)", len),
            });
            total += 15;
        }

        // ---- auto_generated -------------------------------------------------
        if is_auto_generated(&account_str) {
            reasons.push(ScoreReason {
                factor: "auto_generated".into(),
                score: 25,
                detail: "Name matches auto-generated pattern".into(),
            });
            total += 25;
        }

        // ---- trademark ------------------------------------------------------
        let name = account_str
            .trim_end_matches(".near")
            .trim_end_matches(".testnet");
        if self.trademarks.contains(&name.to_string()) {
            reasons.push(ScoreReason {
                factor: "trademark".into(),
                score: 50,
                detail: format!("Name matches protected trademark: {}", name),
            });
            total += 50;
        }

        let overall_score = std::cmp::min(total as u8, MAX_SCORE);

        let report = ScoreReport {
            account_id: account_id.to_string(),
            overall_score,
            reasons,
        };

        // Cache the result so subsequent view calls are cheap
        self.scores.insert(account_id, report.clone());
        report
    }

    /// View the cached score report, if one exists.
    pub fn get_report(&self, account_id: AccountId) -> Option<ScoreReport> {
        self.scores.get(&account_id).cloned()
    }

    /// Combined check — score + suggestions.
    /// The frontend tells us whether the account exists (it can verify via RPC).
    pub fn check_status(
        &mut self,
        account_id: AccountId,
        exists: bool,
    ) -> AccountStatus {
        let name_str = account_id.as_str().to_lowercase();

        let score_report = if exists {
            Some(self.check(account_id.clone()))
        } else {
            None
        };

        let suggestions = generate_suggestions(&name_str, &self.trademarks);

        AccountStatus {
            account_id: account_id.to_string(),
            exists,
            score_report,
            suggestions,
        }
    }

    /// Pure view-only scoring (no storage writes).
    /// Callable via RPC with zero deposit — no wallet needed.
    pub fn view_score(&self, account_id: AccountId, exists: bool) -> AccountStatus {
        let account_str = account_id.as_str().to_lowercase();
        let mut reasons: Vec<ScoreReason> = Vec::new();
        let mut total: u16 = 0;

        let len = account_str.len();
        if len <= 2 {
            reasons.push(ScoreReason {
                factor: "name_length".into(),
                score: 30,
                detail: format!("Account name is very short ({} chars)", len),
            });
            total += 30;
        } else if len <= 4 {
            reasons.push(ScoreReason {
                factor: "name_length".into(),
                score: 15,
                detail: format!("Account name is short ({} chars)", len),
            });
            total += 15;
        }

        if is_auto_generated(&account_str) {
            reasons.push(ScoreReason {
                factor: "auto_generated".into(),
                score: 25,
                detail: "Name matches auto-generated pattern".into(),
            });
            total += 25;
        }

        let name = account_str
            .trim_end_matches(".near")
            .trim_end_matches(".testnet");
        if self.trademarks.contains(&name.to_string()) {
            reasons.push(ScoreReason {
                factor: "trademark".into(),
                score: 50,
                detail: format!("Name matches protected trademark: {}", name),
            });
            total += 50;
        }

        let overall_score = std::cmp::min(total as u8, MAX_SCORE);

        let report = if exists {
            Some(ScoreReport {
                account_id: account_id.to_string(),
                overall_score,
                reasons,
            })
        } else {
            None
        };

        let suggestions = generate_suggestions(&account_str, &self.trademarks);

        AccountStatus {
            account_id: account_id.to_string(),
            exists,
            score_report: report,
            suggestions,
        }
    }

    // -----------------------------------------------------------------------
    // Trademark management
    // -----------------------------------------------------------------------

    /// Add a protected trademark name.
    /// Anyone can call. Must attach at least 0.1 NEAR (storage + spam protection).
    #[payable]
    pub fn add_trademark(&mut self, name: String) {
        let attached = env::attached_deposit();
        require!(
            attached >= TRADEMARK_FEE,
            "Attach at least 0.1 NEAR to add a trademark"
        );

        let lower = name.to_lowercase();
        require!(!lower.is_empty(), "Trademark name cannot be empty");
        require!(
            lower.len() <= 64,
            "Trademark name too long (max 64 chars)"
        );
        require!(
            lower.chars().all(|c| {
                c.is_ascii_lowercase()
                    || c.is_ascii_digit()
                    || c == '-'
                    || c == '_'
                    || c == '.'
            }),
            "Trademark contains invalid characters"
        );

        self.trademarks.insert(lower);

        // Refund anything above the 0.1 NEAR fee back to the caller
        let refund = attached.saturating_sub(TRADEMARK_FEE);
        if refund > NearToken::from_yoctonear(0) {
            Promise::new(env::predecessor_account_id()).transfer(refund);
        }
    }

    /// Remove a protected trademark name (owner only).
    pub fn remove_trademark(&mut self, name: String) {
        self.assert_owner();
        let lower = name.to_lowercase();
        self.trademarks.remove(&lower);
    }

    /// View all trademarks (anyone can call, view method).
    pub fn list_trademarks(&self) -> Vec<String> {
        self.trademarks.iter().cloned().collect()
    }

    /// Check whether a name is trademarked (view method).
    pub fn is_trademarked(&self, name: String) -> bool {
        self.trademarks.contains(&name.to_lowercase())
    }

    // -----------------------------------------------------------------------
    // Owner admin
    // -----------------------------------------------------------------------

    /// Transfer ownership to another account.
    pub fn transfer_ownership(&mut self, new_owner: AccountId) {
        self.assert_owner();
        self.owner = new_owner;
    }

    /// View current owner.
    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/// Detect auto-generated names:
/// - All digits (e.g. "12345")
/// - Single lowercase letter followed by all digits (e.g. "a12345")
fn is_auto_generated(name: &str) -> bool {
    let name = name
        .trim_end_matches(".near")
        .trim_end_matches(".testnet");
    if name.is_empty() {
        return false;
    }
    if name.chars().all(|c| c.is_ascii_digit()) {
        return true;
    }
    let bytes = name.as_bytes();
    bytes.len() > 1
        && bytes[0].is_ascii_lowercase()
        && bytes[1..].iter().all(|c| c.is_ascii_digit())
}

/// Generate alternative name suggestions, excluding protected trademarks.
fn generate_suggestions(name: &str, trademarks: &UnorderedSet<String>) -> Vec<String> {
    let base = name
        .trim_end_matches(".near")
        .trim_end_matches(".testnet")
        .trim_end_matches(".tgz");

    let mut suggestions = Vec::new();

    let suffixes = ["1", "01", "real", "official", "near"];
    for sfx in &suffixes {
        let candidate = format!("{}{}.near", base, sfx);
        if !suggestions.contains(&candidate) {
            suggestions.push(candidate);
        }
        if suggestions.len() >= SUGGESTION_COUNT {
            break;
        }
    }

    if suggestions.len() < SUGGESTION_COUNT {
        let alt_names = [
            format!("{}_{}.near", base, "near"),
            format!("{}-{}.near", base, "near"),
            format!("{}{}.near", base, "near"),
        ];
        for c in &alt_names {
            if !suggestions.contains(c) {
                suggestions.push(c.clone());
            }
            if suggestions.len() >= SUGGESTION_COUNT {
                break;
            }
        }
    }

    suggestions.retain(|s| {
        let sug_base = s.trim_end_matches(".near");
        !trademarks.contains(&sug_base.to_string())
    });

    if base.len() <= 3 && suggestions.len() < SUGGESTION_COUNT {
        let prefixes = ["get", "use", "the", "my", "its"];
        for p in &prefixes {
            let candidate = format!("{}{}.near", p, base);
            if !suggestions.contains(&candidate) {
                suggestions.push(candidate);
            }
            if suggestions.len() >= SUGGESTION_COUNT {
                break;
            }
        }
    }

    suggestions.truncate(SUGGESTION_COUNT);
    suggestions
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{test_env, VMContextBuilder};
    use near_sdk::{testing_env, AccountId};

    /// Helper: set up context + contract, and return (builder, contract).
    /// Builder can be used to modify context (e.g. attach deposit) between calls.
    fn setup() -> (VMContextBuilder, NameGuard) {
        let mut builder = VMContextBuilder::new();
        test_env::set_current_account_id(
            "nameguard.testnet".parse::<AccountId>().unwrap(),
        );
        test_env::set_predecessor_account_id(
            "nameguard.testnet".parse::<AccountId>().unwrap(),
        );
        test_env::set_signer_account_id(
            "nameguard.testnet".parse::<AccountId>().unwrap(),
        );
        testing_env!(builder.build());

        let contract = NameGuard::new("nameguard.testnet".parse().unwrap());
        (builder, contract)
    }

    /// Attach 0.1 NEAR deposit then call add_trademark (helper for tests).
    fn add_tm(builder: &mut VMContextBuilder, contract: &mut NameGuard, name: &str) {
        builder.attached_deposit(TRADEMARK_FEE);
        testing_env!(builder.build());
        contract.add_trademark(name.to_string());
        // Reset deposit for subsequent calls
        builder.attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(builder.build());
    }

    #[test]
    fn test_auto_generated() {
        assert!(is_auto_generated("12345"));
        assert!(is_auto_generated("a12345"));
        assert!(is_auto_generated("test123.near"));
        assert!(is_auto_generated("12345.near"));
        assert!(!is_auto_generated("vitalik.near"));
        assert!(!is_auto_generated("hello.near"));
    }

    #[test]
    fn test_score_calculation() {
        let (mut builder, mut contract) = setup();
        add_tm(&mut builder, &mut contract, "google");

        let report = contract.check("vitalik.near".parse().unwrap());
        assert_eq!(report.overall_score, 0);

        let report = contract.check("google.near".parse().unwrap());
        assert_eq!(report.overall_score, 50);

        let report = contract.check("a12345.near".parse().unwrap());
        assert_eq!(report.overall_score, 40);
    }

    #[test]
    fn test_very_short_name() {
        let (_, mut contract) = setup();
        let report = contract.check("ab.near".parse().unwrap());
        assert_eq!(report.overall_score, 30);
    }

    #[test]
    fn test_short_name_3_to_4_chars() {
        let (_, mut contract) = setup();
        let report = contract.check("abcd.near".parse().unwrap());
        assert_eq!(report.overall_score, 15);
    }

    #[test]
    fn test_view_score() {
        let (_, contract) = setup();
        let status = contract.view_score("google.near".parse().unwrap(), true);
        assert!(status.exists);
        assert!(status.score_report.is_some());
        assert_eq!(status.score_report.unwrap().overall_score, 0);
    }

    #[test]
    fn test_is_trademarked() {
        let (mut builder, mut contract) = setup();
        add_tm(&mut builder, &mut contract, "Google");
        assert!(contract.is_trademarked("google".to_string()));
        assert!(contract.is_trademarked("Google".to_string()));
        assert!(!contract.is_trademarked("vitalik".to_string()));
    }

    #[test]
    fn test_transfer_ownership() {
        let (_, mut contract) = setup();
        assert_eq!(contract.get_owner().to_string(), "nameguard.testnet");
        contract.transfer_ownership("newowner.near".parse().unwrap());
        assert_eq!(contract.get_owner().to_string(), "newowner.near");
    }

    #[test]
    #[should_panic(expected = "Attach at least 0.1 NEAR")]
    fn test_add_trademark_fails_without_deposit() {
        let (_, mut contract) = setup();
        contract.add_trademark("test".to_string());
    }
}