import dotenv from 'dotenv';
import { bip39, BigNumber } from "@okxweb3/crypto-lib";
import { EthWallet } from "@okxweb3/coin-ethereum";
import fetch from 'node-fetch';  // 使用 import 代替 require
import { ethers } from 'ethers';  // 导入 ethers

dotenv.config();

// 环境变量
const API_KEY = process.env.API_KEY;
const SECRET_KEY = process.env.SECRET_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY; // 私钥
const RECEIVER_ADDRESS = process.env.RECEIVER_ADDRESS; // 接收地址
const CHAIN_ID = parseInt(process.env.CHAIN_ID, 10); // Sepolia Chain ID
const TRANSFER_AMOUNT = process.env.TRANSFER_AMOUNT; // 转账金额（ETH）

// 主函数
async function sendTransaction() {
  const wallet = new EthWallet();

  // 检查接收地址有效性
  const isValid = await wallet.validAddress({ address: RECEIVER_ADDRESS });
  if (!isValid.isValid) {
    throw new Error("接收地址无效: " + RECEIVER_ADDRESS);
  }
  console.log("接收地址有效:", RECEIVER_ADDRESS);

  // 获取 nonce 和 gas 信息
  const { nonce, gasPrice, gasLimit } = await fetchSignInfo();

  // 构建交易参数
  const transactionParams = {
    privateKey: PRIVATE_KEY,
    data: {
      to: RECEIVER_ADDRESS,
      value: new BigNumber(ethers.parseEther(TRANSFER_AMOUNT).toString()), // 转账金额
      nonce: new BigNumber(nonce), // 从 OKX API 获取的 nonce
      gasPrice: new BigNumber(gasPrice), // 从 OKX API 获取的 gasPrice
      gasLimit: new BigNumber(gasLimit), // 从 OKX API 获取的 gasLimit
      chainId: CHAIN_ID, // Sepolia Chain ID
    },
  };

  console.log("正在签名交易...");
  const signedTx = await wallet.signTransaction(transactionParams);
  console.log("已签名交易:", signedTx);

  // 广播交易
  const broadcastResponse = await broadcastTransaction(signedTx);
  console.log("交易广播响应:", broadcastResponse);
}

// 获取交易所需的 nonce、gasPrice 和 gasLimit
async function fetchSignInfo() {
  const apiRequestUrl = `https://www.okx.com/api/v5/wallet/pre-transaction/sign-info`;

  const postSignInfoBody = {
    chainIndex: CHAIN_ID.toString(),
    fromAddr: await getAddressFromPrivateKey(),
    toAddr: RECEIVER_ADDRESS,
    txAmount: ethers.parseEther(TRANSFER_AMOUNT).toString(),
    extJson: {}, // 其他扩展信息可选
  };

  const response = await fetch(apiRequestUrl, {
    method: "post",
    headers: {
      "OK-ACCESS-KEY": API_KEY,
      "OK-ACCESS-SIGN": generateSignature(),
      "OK-ACCESS-TIMESTAMP": new Date().toISOString(),
      "OK-ACCESS-PASSPHRASE": SECRET_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(postSignInfoBody),
  });

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error("获取签名信息失败: " + data.msg);
  }

  return {
    nonce: data.data.nonce,
    gasPrice: data.data.gasPrice,
    gasLimit: data.data.gasLimit,
  };
}

// 获取发送地址
async function getAddressFromPrivateKey() {
  const wallet = new EthWallet();
  const derivedAddress = await wallet.getNewAddress({ privateKey: PRIVATE_KEY });
  return derivedAddress.address;
}

// 广播交易
async function broadcastTransaction(signedTx) {
  const apiRequestUrl = `https://www.okx.com/api/v5/wallet/pre-transaction/broadcast-transaction`;

  const response = await fetch(apiRequestUrl, {
    method: "post",
    headers: {
      "OK-ACCESS-KEY": API_KEY,
      "OK-ACCESS-SIGN": generateSignature(),
      "OK-ACCESS-TIMESTAMP": new Date().toISOString(),
      "OK-ACCESS-PASSPHRASE": SECRET_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ signedTx }),
  });

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error("交易广播失败: " + data.msg);
  }
  return data;
}

// 生成 API 签名
function generateSignature() {
  // 根据 OKX API 签名规则生成签名
  // 示例：HmacSHA256(API_KEY + TIMESTAMP + SECRET_KEY)
  // 注意此处需实现
}

// 执行交易
sendTransaction().catch(console.error);
