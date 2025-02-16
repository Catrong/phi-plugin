import plugin from "../../../lib/plugins/plugin.js";
import { createRequire } from "module";
import lodash from "lodash";
import { Restart } from '../../other/restart.js'
import Config from "../components/Config.js";
import common from "../../../lib/common/common.js";
import getInfo from "../model/getInfo.js";
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { exec, execSync } = require("child_process");

// 是否在更新中
let uping = false;

/**
 * 处理插件更新
 */
export class phiupdate extends plugin {
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
                    reg: `^[#/](pgr|PGR|屁股肉|phi|Phi|(${Config.getUserCfg('config', 'cmdhead')}))(\\s*)(下载|更新|gx|down|up)\s*(曲绘|ill)$`,
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
            this.reply("无权限");
            return false;
        }

        /** 检查是否正在更新中 */
        if (uping) {
            await this.reply("已有命令更新中..请勿重复操作");
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
            this.e.reply("phi-plugin更新失败QAQ!" + err)
            console.error(err)
        }

        if (Config.getUserCfg('config', 'autoPullPhiIll')) {
            try {
                await this.ill_update()
            } catch (err) {
                this.e.reply("曲绘文件更新失败QAQ!" + err)
                console.error(err)
            }
        }


        /** 是否需要重启 */
        if (this.isUp) {
            if (ifrestart) {
                await this.reply("更新完毕，正在重启云崽以应用更新")
                setTimeout(() => this.restart(), 2000)
            } else {
                getInfo.init()
                await this.reply("更新完毕，本次更新不需要进行重启")
            }
        }
    }

    restart() {
        new Restart(this.e).restart()
    }

    /**
     * 更新
     * @param {boolean} isForce 是否为强制更新
     * @returns
     */
    async runUpdate(isForce) {
        let command = "git -C ./plugins/phi-plugin/ pull --no-rebase";
        if (isForce) {
            command = `git -C ./plugins/phi-plugin/ checkout . && ${command}`;
            this.e.reply("正在执行强制更新操作，请稍等");
        } else {
            this.e.reply("正在执行更新操作，请稍等");
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
            await this.reply(`phi-plugin已经是最新版本\n最后更新时间：${time}`);
        } else {
            await this.reply(`phi-plugin\n最后更新时间：${time}`);
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
        let cm = `cd ./plugins/${plugin}/ && git log  -20 --oneline --pretty=format:"%h||[%cd]  %s" --date=format:"%m-%d %H:%M"`;

        let logAll;
        try {
            logAll = await execSync(cm, { encoding: "utf-8" });
        } catch (error) {
            logger.error(error.toString());
            this.reply(error.toString());
        }

        if (!logAll) return false;

        logAll = logAll.split("\n");

        /**检测是否需要重启 */
        var ifrestart = false

        let log = [];
        for (let str of logAll) {
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

        if (!Config.getUserCfg('config', 'isGuild')) {
            log.push("更多详细信息，请前往github查看\nhttps://github.com/Catrong/phi-plugin");
        }


        await this.reply(await common.makeForwardMsg(this.e, log, `phi-plugin更新日志，共${line}条`))
        return ifrestart;
    }

    /**
     * 获取上次提交的commitId
     * @param {string} plugin 插件名称
     * @returns
     */
    async getcommitId(plugin = "") {
        let cm = `git -C ./plugins/${plugin}/ rev-parse --short HEAD`;

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
        let cm = `cd ./plugins/${plugin}/ && git log -1 --oneline --pretty=format:"%cd" --date=format:"%m-%d %H:%M"`;

        let time = "";
        try {
            time = await execSync(cm, { encoding: "utf-8" });
            time = lodash.trim(time);
        } catch (error) {
            logger.error(error.toString());
            time = "获取时间失败";
        }
        return time;
    }


    /**
     * rule - 更新曲绘
     * @returns
     */
    async ill_update() {
        if (!this.e.isMaster) {
            this.reply("无权限");
            return false;
        }

        /** 检查是否正在更新中 */
        if (uping) {
            await this.reply("已有命令更新中..请勿重复操作");
            return;
        }

        /** 检查git安装 */
        if (!(await this.checkGit())) return;

        const isForce = 1


        if (!fs.existsSync('./plugins/phi-plugin/resources/original_ill/.git')) {
            /**执行安装 */
            await this.ill_clone()
        } else {
            /** 执行更新 */
            await this.ill_runUpdate(isForce);
        }


        /** 是否成功 */
        if (this.isUp) {
            await this.reply("更新完毕")
        }
    }

    async ill_clone() {
        let command = "git clone https://gitee.com/Steveeee-e/phi-plugin-ill.git ./plugins/phi-plugin/resources/original_ill/ --depth=1";

        this.e.reply("开始下载曲绘文件");

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
            await this.reply(`曲绘文件已经是最新版本\n最后更新时间：${time}`);
        } else {
            await this.reply(`phi-plugin-ill\n最后更新时间：${time}`);
            this.isUp = true;
            /** 获取phi-plugin-ill的更新日志 */
            let log = await this.ill_getLog();
            await this.reply(log);
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
            var gitCfg = fs.readFileSync(`./plugins/phi-plugin/resources/original_ill/.git/config`, "utf8")

            // console.info(gitCfg)

            gitCfg = gitCfg.replace('https://ghproxy.com/https://github.com/Catrong/phi-plugin-ill', 'https://gitee.com/Steveeee-e/phi-plugin-ill.git')
            // console.info(gitCfg)

            fs.writeFileSync(`./plugins/phi-plugin/resources/original_ill/.git/config`, gitCfg, "utf8")
        } catch (err) {
            logger.error(err)
        }


        let command = "git -C ./plugins/phi-plugin/resources/original_ill/ pull --no-rebase";
        command = `git -C ./plugins/phi-plugin/resources/original_ill/ checkout . && ${command}`;
        this.e.reply("正在更新曲绘文件，请勿重复执行");

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
            await this.reply(`曲绘文件已经是最新版本\n最后更新时间：${time}`);
        } else {
            await this.reply(`phi-plugin-ill\n最后更新时间：${time}`);
            this.isUp = true;
            /** 获取phi-plugin-ill的更新日志 */
            let log = await this.ill_getLog();
            await this.reply(log);
        }

        logger.mark(`${this.e.logFnc} 最后更新时间：${time}`);

        return true;
    }

    /**
     * 获取phi-plugin-ill的更新日志
     * @param {string} plugin 插件名称
     * @returns
     */
    async ill_getLog() {
        let cm = `cd ./plugins/phi-plugin/resources/original_ill/ && git log  -20 --oneline --pretty=format:"%h||[%cd]  %s" --date=format:"%m-%d %H:%M"`;

        let logAll;
        try {
            logAll = await execSync(cm, { encoding: "utf-8" });
        } catch (error) {
            logger.error(error.toString());
            this.reply(error.toString());
        }

        if (!logAll) return false;

        logAll = logAll.split("\n");

        let log = [];
        for (let str of logAll) {
            str = str.split("||");
            if (str[0] == this.oldCommitId) break;
            if (str[1].includes("Merge branch")) continue;
            log.push(str[1]);
        }
        if (!Config.getUserCfg('config', 'isGuild')) {
            log.push("更多详细信息，请前往github查看\nhttps://github.com/Catrong/phi-plugin-ill");
        }

        let line = log.length;

        if (line <= 1) return "";


        log = await common.makeForwardMsg(this.e, log, `phi-plugin-ill更新日志，共${line - 1}条`)
        return log;
    }

    /**
     * 获取上次提交的commitId
     * @param {string} plugin 插件名称
     * @returns
     */
    async ill_getcommitId() {
        let cm = `git -C ./plugins/phi-plugin/resources/original_ill/ rev-parse --short HEAD`;

        let commitId = await execSync(cm, { encoding: "utf-8" });
        commitId = lodash.trim(commitId);

        return commitId;
    }

    /**
     * 获取本次更新插件的最后一次提交时间
     * @param {string} plugin 插件名称
     * @returns
     */
    async ill_getTime() {
        let cm = `cd ./plugins/phi-plugin/resources/original_ill/ && git log -1 --oneline --pretty=format:"%cd" --date=format:"%m-%d %H:%M"`;

        let time = "";
        try {
            time = await execSync(cm, { encoding: "utf-8" });
            time = lodash.trim(time);
        } catch (error) {
            logger.error(error.toString());
            time = "获取时间失败";
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
        let msg = "更新失败！";
        let errMsg = err.toString();
        stdout = stdout.toString();

        if (errMsg.includes("Timed out")) {
            let remote = errMsg.match(/'(.+?)'/g)[0].replace(/'/g, "");
            await this.reply(msg + `\n连接超时：${remote}`);
            return;
        }

        if (/Failed to connect|unable to access/g.test(errMsg)) {
            let remote = errMsg.match(/'(.+?)'/g)[0].replace(/'/g, "");
            await this.reply(msg + `\n连接失败：${remote}`);
            return;
        }

        if (errMsg.includes("be overwritten by merge")) {
            await this.reply(
                msg +
                `存在冲突：\n${errMsg}\n` +
                "请解决冲突后再更新，或者执行#强制更新，放弃本地修改"
            );
            return;
        }

        if (stdout.includes("CONFLICT")) {
            await this.reply([
                msg + "存在冲突\n",
                errMsg,
                stdout,
                "\n请解决冲突后再更新，或者执行#强制更新，放弃本地修改",
            ]);
            return;
        }

        await this.reply([errMsg, stdout]);
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
            await this.reply("请先安装git");
            return false;
        }
        return true;
    }
}
