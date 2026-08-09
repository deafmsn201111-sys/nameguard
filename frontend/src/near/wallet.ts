import { connect, keyStores, WalletConnection, Contract } from "near-api-js";
import config from "./config";

const nearConfig = config();

let wallet: WalletConnection | null = null;

interface NameGuardContract extends Contract {
  get_report: (args: { account_id: string }) => Promise<any>;
  check: (args: { account_id: string }) => Promise<any>;
  check_status: (args: { account_id: string }) => Promise<any>;
}

export async function initWallet(): Promise<WalletConnection> {
  if (wallet) return wallet;

  const keyStore = new keyStores.BrowserLocalStorageKeyStore();
  const near = await connect({ ...nearConfig, keyStore, headers: {} });
  wallet = new WalletConnection(near, "nameguard");
  return wallet;
}

function getContract(account: any): NameGuardContract {
  return new Contract(account, nearConfig.contractId, {
    viewMethods: ["get_report"],
    changeMethods: ["check", "check_status"],
    useLocalViewExecution: false,
  }) as NameGuardContract;
}

export async function checkAccount(accountId: string): Promise<any> {
  const w = await initWallet();

  if (w.isSignedIn()) {
    const account = w.account();
    const contract = getContract(account);
    const cached = await contract.get_report({ account_id: accountId });
    if (cached) return cached;
    return await contract.check({ account_id: accountId });
  }

  const keyStore = new keyStores.BrowserLocalStorageKeyStore();
  const near = await connect({ ...nearConfig, keyStore, headers: {} });
  const account = near.account("");
  const contract = getContract(account);
  return await contract.get_report({ account_id: accountId });
}

export async function checkAccountStatus(accountId: string): Promise<any> {
  const w = await initWallet();

  if (w.isSignedIn()) {
    const account = w.account();
    const contract = getContract(account);
    return await contract.check_status({ account_id: accountId });
  }

  const keyStore = new keyStores.BrowserLocalStorageKeyStore();
  const near = await connect({ ...nearConfig, keyStore, headers: {} });
  const account = near.account("");
  const contract = getContract(account);

  try {
    const report = await contract.get_report({ account_id: accountId });
    return {
      account_id: accountId,
      exists: true,
      score_report: report || null,
      suggestions: [],
    };
  } catch {
    return {
      account_id: accountId,
      exists: false,
      score_report: null,
      suggestions: [],
    };
  }
}

export function signIn() {
  if (!wallet) return;
  (wallet as any).requestSignIn({ contractId: nearConfig.contractId });
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