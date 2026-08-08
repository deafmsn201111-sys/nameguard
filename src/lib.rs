use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupMap;
use near_sdk::{env, ext_contract, near_bindgen, require, AccountId, Gas, NearToken, Promise};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

// ─── Constants ───────────────────────────────────────────────────────────────

const SOCIAL_DB: &str = "social.near";
const GAS_FOR_CALL: Gas = Gas::from_tgas(20);

// ─── Structures ──────────────────────────────────────────────────────────────

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Debug)]
pub struct ScoreReport {
    pub account_id: String,
    pub overall_score: u8,
    pub reasons: Vec<ScoreReason>,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Debug)]
pub struct ScoreReason {
    pub factor: String,
    pub score: u8,
    pub detail: String,
}

// ─── Cross-contract interface ────────────────────────────────────────────────

#[ext_contract(ext_self)]
trait ExtSelf {
    fn handle_social_result(&mut self, account_id: AccountId, #[callback_unwrap] result: String) -> ScoreReport;
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[near_bindgen(contract_state(key = b"STATE"))]
#[derive(BorshSerialize, BorshDeserialize)]
pub struct NameGuard {
    pub scores: LookupMap<AccountId, ScoreReport>,
    pub trademarks: Vec<String>,
    pub max_accounts_per_owner: u64,
}

impl Default for NameGuard {
    fn default() -> Self {
        Self {
            scores: LookupMap::new(b"s"),
            trademarks: Vec::new(),
            max_accounts_per_owner: 5,
        }
    }
}

#[near_bindgen]
impl NameGuard {
    #[init]
    pub fn new(max_accounts_per_owner: u64) -> Self {
        Self {
            scores: LookupMap::new(b"s"),
            trademarks: Vec::new(),
            max_accounts_per_owner,
        }
    }

    // ─── Scoring ─────────────────────────────────────────────────────────────

    pub fn check(&mut self, account_id: AccountId) -> ScoreReport {
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
        let tm_set: HashSet<&str> = self.trademarks.iter().map(|s| s.as_str()).collect();
        if tm_set.contains(name) {
            reasons.push(ScoreReason {
                factor: "trademark".into(),
                score: 50,
                detail: format!("Name matches protected trademark: {}", name),
            });
            total += 50;
        }

        let overall_score = std::cmp::min(total as u8, 100);

        let report = ScoreReport {
            account_id: account_id.to_string(),
            overall_score,
            reasons,
        };

        self.scores.insert(&account_id, &report);
        report
    }

    pub fn get_report(&self, account_id: AccountId) -> Option<ScoreReport> {
        self.scores.get(&account_id)
    }

    // ─── On-chain Lookup (SocialDB) ──────────────────────────────────────────

    pub fn check_with_lookup(&mut self, account_id: AccountId) -> Promise {
        let report = self.check(account_id.clone());
        self.scores.insert(&account_id, &report);

        let args = near_sdk::serde_json::json!({
            "keys": [format!("{}/profile/**", account_id)]
        });

        Promise::new(SOCIAL_DB.parse().unwrap())
            .function_call(
                "get".to_string(),
                near_sdk::serde_json::to_vec(&args).unwrap(),
                NearToken::from_yoctonear(0),
                GAS_FOR_CALL,
            )
            .then(ext_self::ext(env::current_account_id())
                .handle_social_result(account_id))
    }

    #[private]
    pub fn handle_social_result(&mut self, account_id: AccountId, result: String) -> ScoreReport {
        let mut report = self.scores.get(&account_id).unwrap_or(ScoreReport {
            account_id: account_id.to_string(),
            overall_score: 0,
            reasons: vec![],
        });

        if result == "null" || result.trim().is_empty() {
            report.overall_score = std::cmp::min(report.overall_score + 15, 100);
            report.reasons.push(ScoreReason {
                factor: "no_profile".into(),
                score: 15,
                detail: "Account has no profile on SocialDB".into(),
            });
        }

        self.scores.insert(&account_id, &report);
        report
    }

    // ─── Trademark Management ────────────────────────────────────────────────

    pub fn add_trademark(&mut self, name: String) {
        self.assert_owner();
        let lower = name.to_lowercase();
        if !self.trademarks.contains(&lower) {
            self.trademarks.push(lower);
        }
    }

    pub fn remove_trademark(&mut self, name: String) {
        self.assert_owner();
        self.trademarks.retain(|t| t != &name.to_lowercase());
    }

    pub fn list_trademarks(&self) -> Vec<String> {
        self.trademarks.clone()
    }

    pub fn set_max_accounts(&mut self, max: u64) {
        self.assert_owner();
        self.max_accounts_per_owner = max;
    }

    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "Only owner can call this"
        );
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn is_auto_generated(name: &str) -> bool {
    let name = name.trim_end_matches(".near").trim_end_matches(".testnet");
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

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

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
        let mut contract = NameGuard::new(5);
        contract.add_trademark("google".to_string());

        let report = contract.check("vitalik.near".parse().unwrap());
        assert_eq!(report.overall_score, 0);

        let report = contract.check("google.near".parse().unwrap());
        assert_eq!(report.overall_score, 50);

        let report = contract.check("a12345.near".parse().unwrap());
        assert_eq!(report.overall_score, 40); // 15 (short) + 25 (auto)
    }
}