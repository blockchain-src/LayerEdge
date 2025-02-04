require('dotenv').config(); // 加载 .env 文件
const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');

// 从 .env 文件中加载 API 配置信息
const api_config = {
  api_key: process.env.OKX_API_KEY,
  secret_key: process.env.OKX_SECRET_KEY,
  passphrase: process.env.OKX_PASSPHRASE,
  project: process.env.OKX_PROJECT
};

function preHash(timestamp, method, request_path, params) {
  let query_string = '';
  if (method === 'GET' && params) {
    query_string = '?' + querystring.stringify(params);
  }
  return timestamp + method + request_path + query_string;
}

function sign(message, secret_key) {
  const hmac = crypto.createHmac('sha256', secret_key);
  hmac.update(message);
  return hmac.digest('base64');
}

function createSignature(method, request_path, params) {
  const timestamp = new Date().toISOString().slice(0, -5) + 'Z';
  const message = preHash(timestamp, method, request_path, params);
  const signature = sign(message, api_config.secret_key);
  return { signature, timestamp };
}

function sendGetRequest(request_path, params) {
  const { signature, timestamp } = createSignature("GET", request_path, params);

  const headers = {
    'OK-ACCESS-KEY': api_config.api_key,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': api_config.passphrase,
    'OK-ACCESS-PROJECT': api_config.project
  };

  const options = {
    hostname: 'www.okx.com',
    path: request_path + (params ? `?${querystring.stringify(params)}` : ''),
    method: 'GET',
    headers: headers
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      try {
        const parsedData = JSON.parse(data);
        console.log("Response:", parsedData);
      } catch (error) {
        console.error("Error parsing response:", error);
      }
    });
  });

  req.on('error', (error) => {
    console.error("Request error:", error);
  });

  req.end();
}

// 查询全量 Token 和 DeFi 资产总余额
const address = "0x21473194e9f975d1a84486d5050d7770af735bbb"; // 替换为目标地址
const request_path = '/api/v5/wallet/asset/total-value-by-address';
const params = {
  address: address,
  chains: 1, // 指定链 ID（1 表示以太坊主网）
  assetType: 0 // 查询 Token 和 DeFi 资产
};

// 发起 GET 请求
sendGetRequest(request_path, params);
