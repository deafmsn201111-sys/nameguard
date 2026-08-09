export default function config() {
  const nearEnv = import.meta.env;

  return {
    networkId: nearEnv.VITE_NEAR_NETWORK || "testnet",
    nodeUrl: nearEnv.VITE_NEAR_NODE_URL || "https://rpc.testnet.near.org",
    walletUrl: nearEnv.VITE_NEAR_WALLET_URL || "https://testnet.mynearwallet.com",
    explorerUrl: nearEnv.VITE_NEAR_EXPLORER_URL || "https://testnet.nearblocks.io",
    contractId: nearEnv.VITE_NEAR_CONTRACT_ID || "nameguard.testnet",
    appTitle: "NameGuard",
    appVersion: "0.1.0",
  };
}