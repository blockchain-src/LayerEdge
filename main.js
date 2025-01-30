import fs from 'fs/promises';
import axios from "axios";
import chalk from "chalk";
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { Wallet } from "ethers";

const logger = {
    verbose: true, 
    
    _formatTimestamp() {
        return chalk.gray(`[${new Date().toLocaleTimeString()}]`);
    },

    _getLevelStyle(level) {
        const styles = {
            info: chalk.blueBright.bold,
            warn: chalk.yellowBright.bold,
            error: chalk.redBright.bold,
            success: chalk.greenBright.bold,
            debug: chalk.magentaBright.bold,
            verbose: chalk.cyan.bold
        };
        return styles[level] || chalk.white;
    },

    _formatError(error) {
        if (!error) return '';
        
        let errorDetails = '';
        if (axios.isAxiosError(error)) {
            errorDetails = `
            状态: ${error.response?.status || 'N/A'}
            状态文本: ${error.response?.statusText || 'N/A'}
            URL: ${error.config?.url || 'N/A'}
            方法: ${error.config?.method?.toUpperCase() || 'N/A'}
            响应数据: ${JSON.stringify(error.response?.data || {}, null, 2)}
            头信息: ${JSON.stringify(error.config?.headers || {}, null, 2)}`;
        }
        return `${error.message}${errorDetails}`;
    },

    log(level, message, value = '', error = null) {
        const timestamp = this._formatTimestamp();
        const levelStyle = this._getLevelStyle(level);
        const levelTag = levelStyle(`[${level.toUpperCase()}]`);
        const header = chalk.cyan('◆ LayerEdge 自动机器人');

        let formattedMessage = `${header} ${timestamp} ${levelTag} ${message}`;
        
        if (value) {
            const valueStyle = level === 'error' ? chalk.red : 
                             level === 'warn' ? chalk.yellow : 
                             chalk.green;
            formattedMessage += ` ${valueStyle(value)}`;
        }

        if (error && this.verbose) {
            formattedMessage += `\n${chalk.red(this._formatError(error))}`;
        }

        console.log(formattedMessage);
    },

    info: (message, value = '') => logger.log('info', message, value),
    warn: (message, value = '') => logger.log('warn', message, value),
    error: (message, value = '', error = null) => logger.log('error', message, value, error),
    success: (message, value = '') => logger.log('success', message, value),
    debug: (message, value = '') => logger.log('debug', message, value),
    verbose: (message, value = '') => logger.verbose && logger.log('verbose', message, value),

    progress(wallet, step, status) {
        const progressStyle = status === 'success' 
            ? chalk.green('✔') 
            : status === 'failed' 
            ? chalk.red('✘') 
            : chalk.yellow('➤');
        
        console.log(
            chalk.cyan('◆ LayerEdge 自动机器人'),
            chalk.gray(`[${new Date().toLocaleTimeString()}]`),
            chalk.blueBright(`[进度]`),
            `${progressStyle} ${wallet} - ${step}`
        );
    }
};

// 增强的请求处理器
class RequestHandler {
    static async makeRequest(config, retries = 30, backoffMs = 2000) {
        for (let i = 0; i < retries; i++) {
            try {
                logger.verbose(`尝试请求 (${i + 1}/${retries})`, `URL: ${config.url}`);
                const response = await axios(config);
                logger.verbose(`请求成功`, `状态: ${response.status}`);
                return response;
            } catch (error) {
                const isLastRetry = i === retries - 1;
                const status = error.response?.status;
                
                // 对500错误的特殊处理
                if (status === 500) {
                    logger.error(`服务器错误 (500)`, `尝试 ${i + 1}/${retries}`, error);
                    if (isLastRetry) break;
                    
                    // 对500错误进行指数退避
                    const waitTime = backoffMs * Math.pow(1.5, i);
                    logger.warn(`等待 ${waitTime/1000}秒后重试...`);
                    await delay(waitTime/1000);
                    continue;
                }

                if (isLastRetry) {
                    logger.error(`达到最大重试次数`, '', error);
                    return null;
                }

                logger.warn(`请求失败`, `尝试 ${i + 1}/${retries}`, error);
                await delay(2);
            }
        }
        return null;
    }
}

// 辅助函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms * 1000));
}

async function saveToFile(filename, data) {
    try {
        await fs.appendFile(filename, `${data}\n`, 'utf-8');
        logger.info(`数据保存到 ${filename}`);
    } catch (error) {
        logger.error(`保存数据到 ${filename} 失败: ${error.message}`);
    }
}

async function readFile(pathFile) {
    try {
        const datas = await fs.readFile(pathFile, 'utf8');
        return datas.split('\n')
            .map(data => data.trim())
            .filter(data => data.length > 0);
    } catch (error) {
        logger.error(`读取文件错误: ${error.message}`);
        return [];
    }
}

const newAgent = (proxy = null) => {
    if (proxy) {
        if (proxy.startsWith('http://')) {
            return new HttpsProxyAgent(proxy);
        } else if (proxy.startsWith('socks4://') || proxy.startsWith('socks5://')) {
            return new SocksProxyAgent(proxy);
        } else {
            logger.warn(`不支持的代理类型: ${proxy}`);
            return null;
        }
    }
    return null;
};

// 增强的 LayerEdge 连接类
class LayerEdgeConnection {
    constructor(proxy = null, privateKey = null, refCode = "knYyWnsE") {
        this.refCode = refCode;
        this.proxy = proxy;
        this.retryCount = 30;

        // 浏览器样式的头信息
        this.headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://layeredge.io',
            'Referer': 'https://layeredge.io/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"'
        };

        this.axiosConfig = {
            ...(this.proxy && { httpsAgent: newAgent(this.proxy) }),
            timeout: 60000,
            headers: this.headers,
            validateStatus: (status) => {
                return status < 500;
            }
        };

        this.wallet = privateKey
            ? new Wallet(privateKey)
            : Wallet.createRandom();
            
        logger.verbose(`初始化 LayerEdgeConnection`, 
            `钱包: ${this.wallet.address}\n代理: ${this.proxy || '无'}`);
    }

    async makeRequest(method, url, config = {}) {
        const finalConfig = {
            method,
            url,
            ...this.axiosConfig,
            ...config,
            headers: {
                ...this.headers,
                ...(config.headers || {})
            }
        };
        
        return await RequestHandler.makeRequest(finalConfig, this.retryCount);
    }

    async checkInvite() {
        const inviteData = {
            invite_code: this.refCode,
        };

        const response = await this.makeRequest(
            "post",
            "https://referralapi.layeredge.io/api/referral/verify-referral-code",
            { data: inviteData }
        );

        if (response && response.data && response.data.data.valid === true) {
            logger.info("邀请码有效", response.data);
            return true;
        } else {
            logger.error("检查邀请码失败");
            return false;
        }
    }

    async registerWallet() {
        const registerData = {
            walletAddress: this.wallet.address,
        };

        const response = await this.makeRequest(
            "post",
            `https://referralapi.layeredge.io/api/referral/register-wallet/${this.refCode}`,
            { data: registerData }
        );

        if (response && response.data) {
            logger.info("钱包成功注册", response.data);
            return true;
        } else {
            logger.error("注册钱包失败", "错误");
            return false;
        }
    }

    async connectNode() {
        const timestamp = Date.now();
        const message = `节点激活请求 ${this.wallet.address} 在 ${timestamp}`;
        const sign = await this.wallet.signMessage(message);

        const dataSign = {
            sign: sign,
            timestamp: timestamp,
        };

        // 为POST请求添加特定的内容类型头
        const config = {
            data: dataSign,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const response = await this.makeRequest(
            "post",
            `https://referralapi.layeredge.io/api/light-node/node-action/${this.wallet.address}/start`,
            config
        );

        if (response && response.data && response.data.message === "node action executed successfully") {
            logger.info("节点连接成功", response.data);
            return true;
        } else {
            logger.info("连接节点失败");
            return false;
        }
    }

    async stopNode() {
        const timestamp = Date.now();
        const message = `节点停用请求 ${this.wallet.address} 在 ${timestamp}`;
        const sign = await this.wallet.signMessage(message);

        const dataSign = {
            sign: sign,
            timestamp: timestamp,
        };

        const response = await this.makeRequest(
            "post",
            `https://referralapi.layeredge.io/api/light-node/node-action/${this.wallet.address}/stop`,
            { data: dataSign }
        );

        if (response && response.data) {
            logger.info("停止节点并领取积分结果:", response.data);
            return true;
        } else {
            logger.error("停止节点并领取积分失败");
            return false;
        }
    }

    async checkNodeStatus() {
        const response = await this.makeRequest(
            "get",
            `https://referralapi.layeredge.io/api/light-node/node-status/${this.wallet.address}`
        );

        if (response && response.data && response.data.data.startTimestamp !== null) {
            logger.info("节点状态运行中", response.data);
            return true;
        } else {
            logger.error("节点未运行，尝试启动节点...");
            return false;
        }
    }

    async checkNodePoints() {
        const response = await this.makeRequest(
            "get",
            `https://referralapi.layeredge.io/api/referral/wallet-details/${this.wallet.address}`
        );

        if (response && response.data) {
            logger.info(`${this.wallet.address} 总积分:`, response.data.data?.nodePoints || 0);
            return true;
        } else {
            logger.error("检查总积分失败..");
            return false;
        }
    }
}

// 主应用程序
async function readWallets() {
    try {
        await fs.access("wallets.txt");
        const data = await fs.readFile("wallets.txt", "utf-8");
        const lines = data.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const wallets = lines.map(line => {
            const [address, privateKey] = line.split(',');
            if (!address || !privateKey) {
                throw new Error(`无效的钱包格式: ${line}`);
            }
            return { address: address.trim(), privateKey: privateKey.trim() };
        });

        return wallets;
    } catch (err) {
        if (err.code === 'ENOENT') {
            logger.info("wallets.txt 文件未找到");
        } else {
            logger.error(`读取 wallets.txt 文件失败: ${err.message}`);
        }
        return [];
    }
}

async function run() {
    console.log(banner);
    logger.info('启动 Layer Edge 自动机器人', '初始化中...');
    
    try {
        const proxies = await readFile('proxy.txt');
        let wallets = await readWallets();
        
        if (proxies.length === 0) {
            logger.warn('无代理', '运行时不支持代理');
        }
        
        if (wallets.length === 0) {
            throw new Error('未配置钱包');
        }

        logger.info('配置已加载', `钱包: ${wallets.length}, 代理: ${proxies.length}`);

        while (true) {
            for (let i = 0; i < wallets.length; i++) {
                const wallet = wallets[i];
                const proxy = proxies[i % proxies.length] || null;
                const { address, privateKey } = wallet;
                
                try {
                    logger.verbose(`处理钱包 ${i + 1}/${wallets.length}`, address);
                    const socket = new LayerEdgeConnection(proxy, privateKey);
                    
                    logger.progress(address, '钱包处理开始', 'start');
                    logger.info(`钱包详情`, `地址: ${address}, 代理: ${proxy || '无代理'}`);

                    logger.progress(address, '检查节点状态', 'processing');
                    const isRunning = await socket.checkNodeStatus();

                    if (isRunning) {
                        logger.progress(address, '领取节点积分', 'processing');
                        await socket.stopNode();
                    }

                    logger.progress(address, '重新连接节点', 'processing');
                    await socket.connectNode();

                    logger.progress(address, '检查节点积分', 'processing');
                    await socket.checkNodePoints();

                    logger.progress(address, '钱包处理完成', 'success');
                } catch (error) {
                    logger.error(`处理钱包 ${address} 失败`, '', error);
                    logger.progress(address, '钱包处理失败', 'failed');
                    await delay(5); // 等待5秒后处理下一个钱包
                }
            }
            
            logger.warn('循环完成', '等待1小时后再次运行...');
            await delay(60 * 60);
        }
    } catch (error) {
        logger.error('发生致命错误', '', error);
        process.exit(1);
    }
}

run();
