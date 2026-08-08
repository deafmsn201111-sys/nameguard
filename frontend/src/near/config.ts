export default function config() {
  return {
    accountId: process.env.NEAR_ACCOUNT_ID || "nameguard.near",
    contractId: process.env.NEAR_CONTRACT_ID || "nameguard.near",
    networkId: process.env.NEAR_NETWORK || "testnet",
    nodeUrl: process.env.NEAR_NODE_URL || "https://rpc.testnet.near.org",
    walletUrl: process.env.NEAR_WALLET_URL || "https://testnet.mynearwallet.com",
    explorerUrl: process.env.NEAR_EXPLORER_URL || "https://testnet.nearblocks.io",
  };
}