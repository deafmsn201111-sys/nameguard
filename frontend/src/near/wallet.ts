import { connect, keyStores, WalletConnection, Contract } from "near-api-js";
import config from "./config";

const nearConfig = config();

let wallet: WalletConnection | null = null;

interface NameGuardContract extends Contract {
  get_report: (args: { account_id: string }) => Promise<any>;
  check: (args: { account_id: string }) => Promise<any>;
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
    changeMethods: ["check"],
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

  // Read-only check without signing
  const keyStore = new keyStores.BrowserLocalStorageKeyStore();
  const near = await connect({ ...nearConfig, keyStore, headers: {} });
  const account = near.account("");
  const contract = getContract(account);
  return await contract.get_report({ account_id: accountId });
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