export const NETWORKS = {
  mainnet: {
    networkId: "mainnet",
    nodeUrl: "https://rpc.mainnet.near.org",
    walletUrl: "https://app.mynearwallet.com",
    helperUrl: "https://helper.mainnet.near.org",
    explorerUrl: "https://nearblocks.io",
    contractId: "nameguard.near",
  },
  testnet: {
    networkId: "testnet",
    nodeUrl: "https://rpc.testnet.near.org",
    walletUrl: "https://testnet.mynearwallet.com",
    helperUrl: "https://helper.testnet.near.org",
    explorerUrl: "https://testnet.nearblocks.io",
    contractId: "nameguard.testnet",
  },
} as const;

export type NetworkEnv = keyof typeof NETWORKS;

export interface NearConfig {
  networkId: string;
  nodeUrl: string;
  walletUrl: string;
  helperUrl: string;
  explorerUrl: string;
  contractId: string;
  appTitle: string;
  appVersion: string;
}

export default function config(): NearConfig {
  const nearEnv = import.meta.env;

  const network = nearEnv.VITE_NEAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
  const net = NETWORKS[network];

  return {
    networkId: nearEnv.VITE_NEAR_NETWORK || net.networkId,
    nodeUrl: nearEnv.VITE_NEAR_NODE_URL || net.nodeUrl,
    walletUrl: nearEnv.VITE_NEAR_WALLET_URL || net.walletUrl,
    helperUrl: nearEnv.VITE_NEAR_HELPER_URL || net.helperUrl,
    explorerUrl: nearEnv.VITE_NEAR_EXPLORER_URL || net.explorerUrl,
    contractId: nearEnv.VITE_NEAR_CONTRACT_ID || net.contractId,
    appTitle: "NameGuard",
    appVersion: "0.2.0",
  };
}