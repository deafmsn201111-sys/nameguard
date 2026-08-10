import { connect, keyStores, WalletConnection, Contract } from "near-api-js";
import config from "./config";

const nearConfig = config();

let wallet: WalletConnection | null = null;

// ---------------------------------------------------------------------------
// Contract interface
// ---------------------------------------------------------------------------

interface ViewMethods {
  view_score: (args: { account_id: string; exists: boolean }) => Promise<any>;
  get_report: (args: { account_id: string }) => Promise<any>;
  list_trademarks: (args: {}) => Promise<string[]>;
  is_trademarked: (args: { name: string }) => Promise<boolean>;
  get_owner: (args: {}) => Promise<string>;
}

interface ChangeMethods {
  check_status: (args: { account_id: string; exists: boolean }) => Promise<any>;
  add_trademark: (args: { name: string }) => Promise<void>;
}

interface NameGuardContract extends Contract {
  view_score: (args: { account_id: string; exists: boolean }) => Promise<any>;
  get_report: (args: { account_id: string }) => Promise<any>;
  list_trademarks: (args: {}) => Promise<string[]>;
  is_trademarked: (args: { name: string }) => Promise<boolean>;
  get_owner: (args: {}) => Promise<string>;
  check_status: (args: { account_id: string; exists: boolean }) => Promise<any>;
  add_trademark: (args: { name: string }) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Wallet init
// ---------------------------------------------------------------------------

export async function initWallet(): Promise<WalletConnection> {
  if (wallet) return wallet;

  const keyStore = new keyStores.BrowserLocalStorageKeyStore();
  const near = await connect({
    networkId: nearConfig.networkId,
    nodeUrl: nearConfig.nodeUrl,
    walletUrl: nearConfig.walletUrl,
    helperUrl: nearConfig.helperUrl,
    headers: {},
    keyStore,
  });
  wallet = new WalletConnection(near, "nameguard");
  return wallet;
}

function getContract(account: any): NameGuardContract {
  return new Contract(account, nearConfig.contractId, {
    viewMethods: [
      "view_score",
      "get_report",
      "list_trademarks",
      "is_trademarked",
      "get_owner",
    ],
    changeMethods: [
      "check_status",
      "add_trademark",
    ],
    useLocalViewExecution: false,
  }) as unknown as NameGuardContract;
}

// ---------------------------------------------------------------------------
// Check account existence via direct RPC (no contract call)
// ---------------------------------------------------------------------------

async function accountExistsViaRpc(accountId: string): Promise<boolean> {
  try {
    const body = {
      jsonrpc: "2.0",
      id: "nameguard-check",
      method: "query",
      params: {
        request_type: "view_account",
        finality: "final",
        account_id: accountId,
      },
    };
    const resp = await fetch(nearConfig.nodeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    return json?.result?.code_hash !== undefined && json.error === undefined;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Full check: view_score (no wallet needed) + existence via RPC. */
export async function checkAccountStatus(accountId: string): Promise<any> {
  const exists = await accountExistsViaRpc(accountId);

  const keyStore = new keyStores.BrowserLocalStorageKeyStore();
  const near = await connect({
    networkId: nearConfig.networkId,
    nodeUrl: nearConfig.nodeUrl,
    walletUrl: nearConfig.walletUrl,
    helperUrl: nearConfig.helperUrl,
    headers: {},
    keyStore,
  });
  const dummyAccount = near.account("");
  const contract = getContract(dummyAccount);

  try {
    const result = await contract.view_score({
      account_id: accountId,
      exists,
    });
    return result;
  } catch (e) {
    console.error("view_score failed, falling back to basic response", e);
    return {
      account_id: accountId,
      exists,
      score_report: null,
      suggestions: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Wallet connect / disconnect
// ---------------------------------------------------------------------------

export function signIn() {
  if (!wallet) return;
  (wallet as any).requestSignIn({
    contractId: nearConfig.contractId,
    methodNames: ["check_status", "add_trademark"],
  });
}

export function signOut() {
  wallet?.signOut();
  wallet = null;
}

export function isSignedIn(): boolean {
  return wallet?.isSignedIn() ?? false;
}

export function getAccountId(): string | null {
  return wallet?.getAccountId() ?? null;
}

// ---------------------------------------------------------------------------
// Wallet-required calls (change methods)
// ---------------------------------------------------------------------------

/** Full check with wallet signature (for signed users who want tx verification). */
export async function checkStatusSigned(accountId: string): Promise<any> {
  const w = await initWallet();
  if (!w.isSignedIn()) throw new Error("Wallet not connected");

  const exists = await accountExistsViaRpc(accountId);
  const account = w.account();
  const contract = getContract(account);
  return await contract.check_status({ account_id: accountId, exists });
}

/** Add a trademark (requires wallet auth, attaches 0.1 NEAR). */
export async function addTrademark(name: string): Promise<void> {
  const w = await initWallet();
  if (!w.isSignedIn()) throw new Error("Wallet not connected");

  const account = w.account();
  const contract = getContract(account);
  await contract.add_trademark({ name });
}