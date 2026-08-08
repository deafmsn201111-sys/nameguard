import { connect, keyStores, WalletConnection } from "near-api-js";
import config from "./config";

const nearConfig = config();

let wallet: WalletConnection | null = null;

export async function initWallet(): Promise<WalletConnection> {
  if (wallet) return wallet;

  const keyStore = new keyStores.BrowserLocalStorageKeyStore();
  const near = await connect({ ...nearConfig, keyStore, headers: {} });
  wallet = new WalletConnection(near, "nameguard");
  return wallet;
}

export async function checkAccount(accountId: string): Promise<any> {
  const w = await initWallet();
  const contract = new w.account().contract({
    contractId: nearConfig.contractId,
    viewMethods: ["get_report"],
    changeMethods: ["check"],
  });

  // Try cached first
  const cached = await (contract as any).get_report({ account_id: accountId });
  if (cached) return cached;

  // Compute fresh score
  return await (contract as any).check({ account_id: accountId });
}

export function signIn() {
  if (!wallet) return;
  wallet.requestSignIn({ contractId: nearConfig.contractId });
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