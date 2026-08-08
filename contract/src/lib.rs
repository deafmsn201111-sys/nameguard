use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{UnorderedMap, UnorderedSet};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, Balance, BlockHeight, PanicOnDefault};

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════

const MIN_DEPOSIT: Balance = 1_000_000_000_000_000_000_000; // 0.001 NEAR
const ONE_DAY: BlockHeight = 86400; // ~1 day in NEAR blocks

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub enum ReportReason {
    Squatter,
    Impersonation,
    Spam,
    Other,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct Report {
    pub reporter: AccountId,
    pub reason: ReportReason,
    pub description: String,
    pub block_height: BlockHeight,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct RiskScore {
    pub score: u8,
    pub age_days: u64,
    pub report_count: u32,
    pub flags: Vec<String>,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    pub reports: UnorderedMap<AccountId, Vec<Report>>,
    pub last_report_block: UnorderedMap<AccountId, BlockHeight>,
    pub watchlist: UnorderedMap<AccountId, UnorderedSet<AccountId>>,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self {
            reports: UnorderedMap::new(b"r"),
            last_report_block: UnorderedMap::new(b"l"),
            watchlist: UnorderedMap::new(b"w"),
        }
    }

    // ─── Read (free) ────────────────────────────────────────

    pub fn get_risk_score(&self, account_id: AccountId) -> RiskScore {
        let reports = self.reports.get(&account_id).unwrap_or_default();
        let report_count = reports.len() as u32;

        let mut score: u8 = 0;
        let mut flags: Vec<String> = Vec::new();

        if report_count > 0 {
            let points = std::cmp::min(report_count * 10, 40);
            score += points as u8;
            flags.push(format!("Reported {} times", report_count));
        }
        if report_count >= 3 {
            score += 10;
            flags.push("High report count".to_string());
        }
        let has_impersonation = reports.iter().any(|r| matches!(r.reason, ReportReason::Impersonation));
        if has_impersonation {
            score += 20;
            flags.push("Impersonation reports".to_string());
        }
        let has_spam = reports.iter().any(|r| matches!(r.reason, ReportReason::Spam));
        if has_spam {
            score += 15;
            flags.push("Spam activity reported".to_string());
        }

        RiskScore {
            score: std::cmp::min(score, 100),
            age_days: 0, // filled client-side via NearBlocks API
            report_count,
            flags,
        }
    }

    pub fn get_reports(&self, account_id: AccountId) -> Vec<Report> {
        self.reports.get(&account_id).unwrap_or_default()
    }

    pub fn is_watched(&self, account_id: AccountId) -> bool {
        self.watchlist.contains_key(&account_id)
    }

    pub fn get_watchers(&self, account_id: AccountId) -> Vec<AccountId> {
        if let Some(watchers) = self.watchlist.get(&account_id) {
            watchers.to_vec()
        } else {
            vec![]
        }
    }

    // ─── Write (requires deposit) ───────────────────────────

    #[payable]
    pub fn report_account(&mut self, account_id: AccountId, reason: ReportReason, description: String) {
        let deposit = env::attached_deposit();
        assert!(deposit >= MIN_DEPOSIT, "Minimum deposit is 0.001 NEAR");

        let reporter = env::predecessor_account_id();
        assert_ne!(reporter, account_id, "Cannot report yourself");

        let mut reports = self.reports.get(&account_id).unwrap_or_default();
        reports.push(Report {
            reporter: reporter.clone(),
            reason,
            description,
            block_height: env::block_index(),
        });
        self.reports.insert(&account_id, &reports);
        self.last_report_block.insert(&reporter, &env::block_index());

        env::log_str(format!("Report submitted by {}", reporter).as_str());
    }

    #[payable]
    pub fn add_to_watchlist(&mut self, account_id: AccountId) {
        let deposit = env::attached_deposit();
        assert!(deposit >= MIN_DEPOSIT, "Minimum deposit is 0.001 NEAR");

        let watcher = env::predecessor_account_id();
        let mut watchers = self.watchlist.get(&account_id).unwrap_or_else(|| {
            UnorderedSet::new(format!("ws_{}", account_id).as_bytes().to_vec())
        });
        watchers.insert(&watcher);
        self.watchlist.insert(&account_id, &watchers);
    }

    pub fn remove_from_watchlist(&mut self, account_id: AccountId) {
        let watcher = env::predecessor_account_id();
        if let Some(mut watchers) = self.watchlist.get(&account_id) {
            watchers.remove(&watcher);
            if watchers.is_empty() {
                self.watchlist.remove(&account_id);
            } else {
                self.watchlist.insert(&account_id, &watchers);
            }
        }
    }
}

// ═══════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn get_context(predecessor: AccountId, deposit: Balance) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor);
        builder.attached_deposit(deposit);
        builder
    }

    #[test]
    fn test_new_contract() {
        let context = get_context("alice.near".parse().unwrap(), 0);
        testing_env!(context.build());
        let contract = Contract::new();
        let risk = contract.get_risk_score("bob.near".parse().unwrap());
        assert_eq!(risk.score, 0);
        assert_eq!(risk.report_count, 0);
    }

    #[test]
    fn test_report_account() {
        let mut contract = Contract::new();
        let context = get_context("alice.near".parse().unwrap(), MIN_DEPOSIT);
        testing_env!(context.build());
        contract.report_account(
            "bob.near".parse().unwrap(),
            ReportReason::Squatter,
            "Registered 50+ domains in one day".to_string(),
        );
        let risk = contract.get_risk_score("bob.near".parse().unwrap());
        assert!(risk.score > 0);
        assert_eq!(risk.report_count, 1);
    }

    #[test]
    fn test_report_multiple() {
        let mut contract = Contract::new();
        let accounts = vec!["alice.near", "carol.near", "dave.near"];
        for (i, acc) in accounts.iter().enumerate() {
            let context = get_context(acc.parse().unwrap(), MIN_DEPOSIT);
            testing_env!(context.build());
            contract.report_account(
                "bob.near".parse().unwrap(),
                if i == 1 { ReportReason::Impersonation } else { ReportReason::Squatter },
                "test".to_string(),
            );
        }
        let risk = contract.get_risk_score("bob.near".parse().unwrap());
        assert!(risk.score >= 30, "Score should be >= 30, got {}", risk.score);
        assert!(risk.flags.iter().any(|f| f.contains("Reported")));
    }

    #[test]
    fn test_watchlist() {
        let mut contract = Contract::new();
        let context = get_context("alice.near".parse().unwrap(), MIN_DEPOSIT);
        testing_env!(context.build());
        contract.add_to_watchlist("bob.near".parse().unwrap());
        assert!(contract.is_watched("bob.near".parse().unwrap()));
        assert_eq!(contract.get_watchers("bob.near".parse().unwrap()).len(), 1);
        contract.remove_from_watchlist("bob.near".parse().unwrap());
        assert!(!contract.is_watched("bob.near".parse().unwrap()));
    }

    #[test]
    #[should_panic(expected = "Cannot report yourself")]
    fn test_cannot_report_self() {
        let mut contract = Contract::new();
        let context = get_context("alice.near".parse().unwrap(), MIN_DEPOSIT);
        testing_env!(context.build());
        contract.report_account("alice.near".parse().unwrap(), ReportReason::Squatter, "self".to_string());
    }
}