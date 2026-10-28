import { createRequire } from "module";
import lodash from "lodash";
import Config from "../components/Config.js";
import common from "../components/common.js";
import getInfo from "../model/game/getInfo.js";
import { originalIllPath, pluginRoot } from "../model/filesystem/path.js";
import fs from 'node:fs';
import phiPluginBase from "../components/baseClass.js";
import logger from "../components/Logger.js";
import platform from "../components/platform/index.js";
import { sendMessage } from "../model/render/message.js";
import { updateMessages, updateWords } from "../model/render/messages.js";

const require = createRequire(import.meta.url);
const { exec, execSync } = require("child_process");

// 是否在更新中
let uping = false;

/**
 * @param {string} filePath
 */
function shellPath(filePath) {
    return `"${filePath.replace(/\\/g, '/').replace(/"/g, '\\"')}"`
}

/**
 * 处理插件更新
 */
export class phiupdate extends phiPluginBase {
    constructor() {
        super({
            name: "phi-plugin更新",
            event: "message",
            priority: 1009,
            rule: [
                {
                    reg: `^[/#](pgr|PGR|屁股肉|phi|Phi|(${Config.getUserCfg('config', 'cmdhead')}))(\\s*)(强制|qz)?(更新|gx)$`,
                    fnc: "update",
                },
                {
                    reg: `^[#/](pgr|PGR|屁股肉|phi|Phi|(${Config.getUserCfg('config', 'cmdhead')}))(\\s*)(下载|更新|gx|down|up)\\s*(曲绘|ill)$`,
                    fnc: "ill_update",
                },
            ],
        });
    }

    /**
     * rule - 更新phi-plugin
     * @returns
     */
    async update() {
        if (!this.e.isMaster) {
            sendMessage(this.e, updateMessages.update.noPermission)
            return false;
        }

        /** 检查是否正在更新中 */
        if (uping) {
            await sendMessage(this.e, updateMessages.update.updating)
            return;
        }

        /** 检查git安装 */
        if (!(await this.checkGit())) return;

        const isForce = this.e.msg.includes("强制") || this.e.msg.includes("qz");

        /** 执行更新 */
        var ifrestart

        try {
            ifrestart = await this.runUpdate(isForce);
        } catch (err) {
            sendMessage(this.e, updateMessages.update.failed(err))
            console.error(err)
        }

        if (Config.getUserCfg('config', 'autoPullPhiIll')) {
            try {
                await this.ill_update()
            } catch (err) {
                sendMessage(this.e, updateMessages.update.illFailed(err))
                console.error(err)
            }
        }


        /** 是否需要重启 */
        if (this.isUp) {
            if (ifrestart) {
                await sendMessage(this.e, updateMessages.update.restarting)
                setTimeout(() => this.restart(), 2000)
            } else {
                getInfo.init()
                await sendMessage(this.e, updateMessages.update.updatedNoRestart)
            }
        }
    }

    restart() {
        platform.restartBot(this.e)
    }

    /**
     * 更新
     * @param {boolean} isForce 是否为强制更新
     * @returns
     */
    async runUpdate(isForce) {
        const repoPath = shellPath(pluginRoot);
        let command = `git -C ${repoPath} pull --no-rebase`;
        if (isForce) {
            command = [
                `git -C ${repoPath} fetch --all --prune`,
                `git -C ${repoPath} reset --hard origin/main`,
                // 即使 .gitignore 被用户修改，也不能让强制更新删除已安装主题。
                `git -C ${repoPath} clean -fd -e resources/themes/`
            ].join(" && ");
            sendMessage(this.e, updateMessages.update.forceStarting);
        } else {
            sendMessage(this.e, updateMessages.update.starting);
        }
        /** 获取上次提交的commitId，用于获取日志时判断新增的更新日志 */
        this.oldCommitId = await this.getcommitId("phi-plugin");
        uping = true;
        let ret = await this.execSync(command);
        uping = false;

        if (ret.error) {
            logger.mark(`${this.e.logFnc} 更新失败：phi-plugin`);
            this.gitErr(ret.error, ret.stdout);
            return false;
        }

        /** 获取插件提交的最新时间 */
        let time = await this.getTime("phi-plugin");

        var ifrestart = false

        if (/(Already up[ -]to[ -]date|已经是最新的)/.test(ret.stdout)) {
            await sendMessage(this.e, updateMessages.update.upToDate(time));
        } else {
            await sendMessage(this.e, updateMessages.update.current(time));
            this.isUp = true;
            /** 获取phi-plugin的更新日志 */
            ifrestart = await this.getLog("phi-plugin");
        }

        logger.mark(`${this.e.logFnc} 最后更新时间：${time}`);

        return ifrestart;
    }

    /**
     * 获取phi-plugin的更新日志
     * @param {string} plugin 插件名称
     * @returns
     */
    async getLog(plugin = "") {
        let cm = `cd ${shellPath(pluginRoot)} && git log  -20 --oneline --pretty=format:"%h||[%cd]  %s" --date=format:"%m-%d %H:%M"`;

        let logAll;
        try {
            logAll = await execSync(cm, { encoding: "utf-8" });
        } catch (error) {
            // @ts-ignore
            logger.error(error.toString());
            // @ts-ignore
            this.reply(error.toString());
        }

        if (!logAll) return false;

        logAll = logAll.split("\n");

        /**检测是否需要重启 */
        var ifrestart = false

        let log = [];
        for (let str of logAll) {
            // @ts-ignore
            str = str.split("||");
            if (str[0] == this.oldCommitId) break;
            if (str[1].includes("Merge branch")) continue;
            log.push(str[1]);
            if (!(str[1].includes('√') || str[1].includes('✓'))) {
                ifrestart = true
            }
        }

        log.reverse()

        let line = log.length;

        if (line <= 0) return false;
        log.unshift(updateWords.log.header(line));

        if (!Config.getUserCfg('config', 'isGuild')) {
            log.push(updateWords.log.moreInfo);
            await sendMessage(this.e, updateMessages.log.forward(await common.makeForwardMsg(this.e, log, updateWords.log.header(line))))
        } else {
            await sendMessage(this.e, updateMessages.log.text(log))
        }

        return ifrestart;
    }

    /**
     * 获取上次提交的commitId
     * @param {string} plugin 插件名称
     * @returns
     */
    async getcommitId(plugin = "") {
        let cm = `git -C ${shellPath(pluginRoot)} rev-parse --short HEAD`;

        let commitId = await execSync(cm, { encoding: "utf-8" });
        commitId = lodash.trim(commitId);

        return commitId;
    }

    /**
     * 获取本次更新插件的最后一次提交时间
     * @param {string} plugin 插件名称
     * @returns
     */
    async getTime(plugin = "") {
        let cm = `cd ${shellPath(pluginRoot)} && git log -1 --oneline --pretty=format:"%cd" --date=format:"%m-%d %H:%M"`;

        let time = "";
        try {
            time = await execSync(cm, { encoding: "utf-8" });
            time = lodash.trim(time);
        } catch (error) {
            // @ts-ignore
            logger.error(error.toString());
            time = updateWords.time.failed;
        }
        return time;
    }


    /**
     * rule - 更新曲绘
     * @returns
     */
    async ill_update() {
        if (!this.e.isMaster) {
            sendMessage(this.e, updateMessages.ill_update.noPermission)
            return false;
        }

        /** 检查是否正在更新中 */
        if (uping) {
            await sendMessage(this.e, updateMessages.ill_update.updating)
            return;
        }

        /** 检查git安装 */
        if (!(await this.checkGit())) return;

        const isForce = 1


        if (!fs.existsSync(`${originalIllPath}/.git`)) {
            /**执行安装 */
            await this.ill_clone()
        } else {
            /** 执行更新 */
            await this.ill_runUpdate();
        }


        /** 是否成功 */
        if (this.isUp) {
            await sendMessage(this.e, updateMessages.ill_update.finished)
        }
    }

    async ill_clone() {
        let command = `git clone ${this.getDownIllUrl()} ${shellPath(originalIllPath)} --depth=1`;

        sendMessage(this.e, updateMessages.ill.startingClone)

        uping = true;
        let ret = await this.execSync(command);
        uping = false;
        if (ret.error) {
            logger.mark(`${this.e.logFnc} 曲绘文件更新失败QAQ!`);
            this.gitErr(ret.error, ret.stdout);
            return false;
        }

        /** 获取插件提交的最新时间 */
        let time = await this.ill_getTime();

        if (/(Already up[ -]to[ -]date|已经是最新的)/.test(ret.stdout)) {
            await sendMessage(this.e, updateMessages.ill.upToDate(time))
        } else {
            await sendMessage(this.e, updateMessages.ill.current(time));
            this.isUp = true;
            /** 获取phi-plugin-ill的更新日志 */
            let log = await this.ill_getLog();
            await sendMessage(this.e, updateMessages.ill.log(log))
        }

        logger.mark(`${this.e.logFnc} 最后更新时间：${time}`);

        return true;

    }

    /**
     * 更新
     * @returns
     */
    async ill_runUpdate() {

        try {
            var gitCfg = fs.readFileSync(`${originalIllPath}/.git/config`, "utf8")

            // console.info(gitCfg)

            gitCfg = gitCfg.replace(/url\s*=\s*(.*)/, `url = ${this.getDownIllUrl()}`)
            // console.info(gitCfg)

            fs.writeFileSync(`${originalIllPath}/.git/config`, gitCfg, "utf8")
        } catch (err) {
            logger.error(err)
        }


        let repoPath = shellPath(originalIllPath);
        // --depth=1 把历史截断回单个提交；但被截断的旧提交仍被 reflog 引用而保持可达，
        // 必须先清掉 reflog 再 repack，才能真正丢弃它们，否则 .git 会随每次更新持续变大。
        let command = [
            `git -C ${repoPath} fetch --all --prune --depth=1`,
            `git -C ${repoPath} reset --hard origin/main`,
            `git -C ${repoPath} clean -fd`,
            `git -C ${repoPath} reflog expire --expire=now --expire-unreachable=now --all`,
            `git -C ${repoPath} repack -a -d -q`
        ].join(" && ");
        sendMessage(this.e, updateMessages.ill.startingUpdate)

        /** 获取上次提交的commitId，用于获取日志时判断新增的更新日志 */
        this.oldCommitId = await this.ill_getcommitId();
        uping = true;
        let ret = await this.execSync(command);
        uping = false;

        if (ret.error) {
            logger.mark(`${this.e.logFnc} 曲绘文件更新失败QAQ!`);
            this.gitErr(ret.error, ret.stdout);
            return false;
        }

        /** 获取插件提交的最新时间 */
        let time = await this.ill_getTime();

        if (/(Already up[ -]to[ -]date|已经是最新的)/.test(ret.stdout)) {
            await sendMessage(this.e, updateMessages.ill.upToDate(time))
        } else {
            await sendMessage(this.e, updateMessages.ill.current(time));
            this.isUp = true;
            /** 获取phi-plugin-ill的更新日志 */
            let log = await this.ill_getLog();
            await sendMessage(this.e, updateMessages.ill.log(log))
        }

        logger.mark(`${this.e.logFnc} 最后更新时间：${time}`);

        return true;
    }

    getDownIllUrl() {
        const downIllUrl = String(Config.getUserCfg('config', 'downIllUrl') || '').trim()
        let url
        try {
            url = new URL(downIllUrl)
        } catch (err) {
            return downIllUrl
        }
        if (url.hostname !== 'github.com') {
            return downIllUrl
        }

        const githubProxy = Config.getUserCfg('config', 'githubProxy')
        if (githubProxy === false || githubProxy === 'false' || githubProxy === '') {
            return downIllUrl
        }
        if (!githubProxy) {
            return downIllUrl
        }
        return `${String(githubProxy).replace(/\/$/, '')}/${downIllUrl}`
    }

    /**
     * 获取phi-plugin-ill的更新日志
     * @returns
     */
    async ill_getLog() {
        let cm = `cd ${shellPath(originalIllPath)} && git log  -20 --oneline --pretty=format:"%h||[%cd]  %s" --date=format:"%m-%d %H:%M"`;

        let logAll;
        try {
            logAll = await execSync(cm, { encoding: "utf-8" });
        } catch (error) {
            // @ts-ignore
            logger.error(error.toString());
            // @ts-ignore
            this.reply(error.toString());
        }

        if (!logAll) return false;

        logAll = logAll.split("\n");

        let log = [];
        for (let str of logAll) {
            // @ts-ignore
            str = str.split("||");
            if (str[0] == this.oldCommitId) break;
            if (str[1].includes("Merge branch")) continue;
            log.push(str[1]);
        }
        if (!Config.getUserCfg('config', 'isGuild')) {
            log.push(updateWords.log.moreInfo);
        }

        let line = log.length;

        if (line <= 1) return "";


        log = await common.makeForwardMsg(this.e, log, updateWords.log.illHeader(line - 1))
        return log;
    }

    /**
     * 获取上次提交的commitId
     * @returns
     */
    async ill_getcommitId() {
        let cm = `git -C ${shellPath(originalIllPath)} rev-parse --short HEAD`;

        let commitId = await execSync(cm, { encoding: "utf-8" });
        commitId = lodash.trim(commitId);

        return commitId;
    }

    /**
     * 获取本次更新插件的最后一次提交时间
     * @returns
     */
    async ill_getTime() {
        let cm = `cd ${shellPath(originalIllPath)} && git log -1 --oneline --pretty=format:"%cd" --date=format:"%m-%d %H:%M"`;

        let time = "";
        try {
            time = await execSync(cm, { encoding: "utf-8" });
            time = lodash.trim(time);
        } catch (error) {
            // @ts-ignore
            logger.error(error.toString());
            time = updateWords.time.failed;
        }
        return time;
    }

    /**
     * 处理更新失败的相关函数
     * @param {string} err
     * @param {string} stdout
     * @returns
     */
    async gitErr(err, stdout) {
        let errMsg = err.toString();
        stdout = stdout.toString();

        if (errMsg.includes("Timed out")) {
            // @ts-ignore
            let remote = errMsg.match(/'(.+?)'/g)[0].replace(/'/g, "");
            await sendMessage(this.e, updateMessages.gitErr.timeout(remote));
            return;
        }

        if (/Failed to connect|unable to access/g.test(errMsg)) {
            // @ts-ignore
            let remote = errMsg.match(/'(.+?)'/g)[0].replace(/'/g, "");
            await sendMessage(this.e, updateMessages.gitErr.connectFailed(remote));
            return;
        }

        if (errMsg.includes("be overwritten by merge")) {
            await sendMessage(this.e, updateMessages.gitErr.conflict(errMsg));
            return;
        }

        if (stdout.includes("CONFLICT")) {
            // @ts-ignore
            await sendMessage(this.e, updateMessages.gitErr.conflictWithOutput(errMsg, stdout));
            return;
        }

        // @ts-ignore
        await sendMessage(this.e, updateMessages.gitErr.output(errMsg, stdout));
    }

    /**
     * 异步执行git相关命令
     * @param {string} cmd git命令
     * @returns
     */
    async execSync(cmd) {
        return new Promise((resolve, reject) => {
            exec(cmd, { windowsHide: true }, (error, stdout, stderr) => {
                resolve({ error, stdout, stderr });
            });
        });
    }

    /**
     * 检查git是否安装
     * @returns
     */
    async checkGit() {
        let ret = await execSync("git --version", { encoding: "utf-8" });
        if (!ret || !ret.includes("git version")) {
            await sendMessage(this.e, updateMessages.checkGit.gitMissing)
            return false;
        }
        return true;
    }
}
