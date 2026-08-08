use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedSet};
use near_sdk::{env, near_bindgen, require, AccountId, PanicOnDefault};
use serde::{Deserialize, Serialize};

// ─── Structures ──────────────────────────────────────────────────────────────

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct ScoreReport {
    pub account_id: String,
    pub overall_score: u8, // 0-100, higher = more squat-looking
    pub reasons: Vec<ScoreReason>,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct ScoreReason {
    pub factor: String,
    pub score: u8,
    pub detail: String,
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[near_bindgen]
#[derive(BorshSerialize, BorshDeserialize, PanicOnDefault)]
pub struct Antisquat {
    pub scores: LookupMap<AccountId, ScoreReport>,
    pub trademarks: UnorderedSet<String>,
    pub max_accounts_per_owner: u64,
}

#[near_bindgen]
impl Antisquat {
    #[init]
    pub fn new(max_accounts_per_owner: u64) -> Self {
        Self {
            scores: LookupMap::new(b"s".as_bytes()),
            trademarks: UnorderedSet::new(b"t".as_bytes()),
            max_accounts_per_owner,
        }
    }

    // ─── Public Scoring ──────────────────────────────────────────────────────

    /// Check an account and return a ScoreReport. Callable without deposit.
    pub fn check(&mut self, account_id: AccountId) -> ScoreReport {
        let account_str = account_id.as_str().to_lowercase();
        let mut reasons: Vec<ScoreReason> = Vec::new();
        let mut total: u16 = 0;

        // 1. Name length
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

        // 2. Auto-generated pattern (pure digits or letter+digits)
        if is_auto_generated(&account_str) {
            reasons.push(ScoreReason {
                factor: "auto_generated".into(),
                score: 25,
                detail: "Name matches auto-generated pattern (digits-only or letter+digits)".into(),
            });
            total += 25;
        }

        // 3. Trademark match
        let name = account_str
            .trim_end_matches(".near")
            .trim_end_matches(".testnet");
        if self.trademarks.contains(name) {
            reasons.push(ScoreReason {
                factor: "trademark".into(),
                score: 50,
                detail: format!("Name matches protected trademark: {}", name),
            });
            total += 50;
        }

        // 4. On-chain activity (via external data — currently stubbed)
        let creator = self.resolve_creator(&account_id);
        if let Some(creator) = creator {
            let count = self.owner_count(&creator);
            if count > self.max_accounts_per_owner {
                reasons.push(ScoreReason {
                    factor: "many_accounts".into(),
                    score: 35,
                    detail: format!(
                        "Creator {} owns {} accounts (max allowed: {})",
                        creator, count, self.max_accounts_per_owner
                    ),
                });
                total += 35;
            }
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

    /// Return cached report without re-computing, if it exists.
    pub fn get_report(&self, account_id: AccountId) -> Option<ScoreReport> {
        self.scores.get(&account_id)
    }

    // ─── Trademark Management ────────────────────────────────────────────────

    pub fn add_trademark(&mut self, name: String) {
        self.assert_owner();
        self.trademarks.insert(&name.to_lowercase());
    }

    pub fn remove_trademark(&mut self, name: String) {
        self.assert_owner();
        self.trademarks.remove(&name.to_lowercase());
    }

    pub fn list_trademarks(&self) -> Vec<String> {
        self.trademarks.iter().collect()
    }

    pub fn set_max_accounts(&mut self, max: u64) {
        self.assert_owner();
        self.max_accounts_per_owner = max;
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "Only contract owner can call this"
        );
    }

    /// Stub — will be wired to an indexer or cross-contract calls later.
    fn resolve_creator(&self, _account_id: &AccountId) -> Option<AccountId> {
        None
    }

    /// Stub — returns 0 until indexer data is connected.
    fn owner_count(&self, _owner: &AccountId) -> u64 {
        0
    }
}

// ─── Pure helpers ────────────────────────────────────────────────────────────

fn is_auto_generated(name: &str) -> bool {
    let name = name.trim_end_matches(".near").trim_end_matches(".testnet");
    if name.is_empty() {
        return false;
    }
    // pure digits
    if name.chars().all(|c| c.is_ascii_digit()) {
        return true;
    }
    // letter followed by only digits (e.g. a12345)
    let bytes = name.as_bytes();
    bytes.len() > 1
        && bytes[0].is_ascii_lowercase()
        && bytes[1..].iter().all(|c| c.is_ascii_digit())
}

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
}