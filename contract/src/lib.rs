use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::store::LookupMap;
use near_sdk::{env, near_bindgen, AccountId, NearToken, PanicOnDefault};

const MIN_DEPOSIT: NearToken = NearToken::from_millinear(1); // 0.001 NEAR

#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub enum ReportReason { Squatter, Impersonation, Spam, Other }

#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct Report {
    pub reporter: AccountId,
    pub reason: ReportReason,
    pub description: String,
    pub block_height: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct RiskScore {
    pub score: u8,
    pub report_count: u32,
    pub flags: Vec<String>,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    pub reports: LookupMap<AccountId, Vec<Report>>,
    pub last_report_block: LookupMap<AccountId, u64>,
    pub watchlist: LookupMap<AccountId, Vec<AccountId>>,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self {
            reports: LookupMap::new(b"r"),
            last_report_block: LookupMap::new(b"l"),
            watchlist: LookupMap::new(b"w"),
        }
    }

    pub fn get_risk_score(&self, account_id: AccountId) -> RiskScore {
        let reports = self.reports.get(&account_id).cloned().unwrap_or_default();
        let c = reports.len() as u32;
        let mut s: u8 = 0;
        let mut f: Vec<String> = Vec::new();
        if c > 0 { s += std::cmp::min(c * 10, 40) as u8; f.push(format!("Reported {}", c)); }
        if c >= 3 { s += 10; f.push("High report count".into()); }
        if reports.iter().any(|r| matches!(r.reason, ReportReason::Impersonation)) { s += 20; f.push("Impersonation".into()); }
        if reports.iter().any(|r| matches!(r.reason, ReportReason::Spam)) { s += 15; f.push("Spam".into()); }
        RiskScore { score: std::cmp::min(s, 100), report_count: c, flags: f }
    }

    pub fn get_reports(&self, account_id: AccountId) -> Vec<Report> {
        self.reports.get(&account_id).cloned().unwrap_or_default()
    }

    pub fn is_watched(&self, account_id: AccountId) -> bool {
        self.watchlist.get(&account_id).is_some()
    }

    #[payable]
    pub fn report_account(&mut self, account_id: AccountId, reason: ReportReason, description: String) {
        assert!(env::attached_deposit() >= MIN_DEPOSIT, "Min deposit 0.001 NEAR");
        let r = env::predecessor_account_id();
        assert_ne!(r, account_id, "Cannot report self");
        let mut v = self.reports.get(&account_id).cloned().unwrap_or_default();
        v.push(Report { reporter: r.clone(), reason, description, block_height: env::block_height() });
        self.reports.insert(account_id, v);
        self.last_report_block.insert(env::predecessor_account_id(), env::block_height());
    }

    #[payable]
    pub fn add_to_watchlist(&mut self, account_id: AccountId) {
        assert!(env::attached_deposit() >= MIN_DEPOSIT, "Min deposit 0.001 NEAR");
        let w = env::predecessor_account_id();
        let mut v = self.watchlist.get(&account_id).cloned().unwrap_or_default();
        if !v.contains(&w) { v.push(w); }
        self.watchlist.insert(account_id, v);
    }

    pub fn remove_from_watchlist(&mut self, account_id: AccountId) {
        let w = env::predecessor_account_id();
        if let Some(mut v) = self.watchlist.get(&account_id).cloned() {
            v.retain(|x| x != &w);
            if v.is_empty() { self.watchlist.remove(&account_id); }
            else { self.watchlist.insert(account_id, v); }
        }
    }
}