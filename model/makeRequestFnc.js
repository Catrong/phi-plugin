import fCompute from './fCompute.js'
import send from './send.js'
import logger from '../components/Logger.js'
import { getPhiApiUserMessage, hasPhiApiUserMessage } from './botApiAuth.js'

export default class makeRequestFnc {
    /**
     * 
    * @param {import('../components/baseClass.js').botEvent } e
     * @returns {import('./makeRequest.js').platformAuth}
     */
    static makePlatform(e) {
        return {
            platform: fCompute.getAdapterName(e),
            platform_id: typeof e.user_id == 'string' ? e.user_id.replace('', ':') : `${e.user_id}`,
            _local_user_id: `${e.user_id}`,
        }
    }

    /**
     * @param {any} err
     * @returns {string}
     */
    static getErrorMessage(err) {
        return err?.message || err?.cause || err?.code || String(err) || '未知错误'
    }

    /**
     * @param {any} err
     * @param {string[]} ignoreMessages
     * @returns {boolean}
     */
    static shouldIgnoreError(err, ignoreMessages = []) {
        if (!ignoreMessages.length) {
            return false
        }
        const errMsg = makeRequestFnc.getErrorMessage(err)
        return ignoreMessages.includes(errMsg)
    }

    /**
     * 统一处理 API 请求错误
     * @param {import('../components/baseClass.js').botEvent} e
     * @param {any} err
     * @param {{
     *  errorPrefix?: string,
     *  notifyUser?: boolean,
     *  logTag?: string,
     *  loggerLevel?: 'warn'|'error',
     *  ignoreMessages?: string[]
     * }} [options]
     * @returns {void}
     */
    static handleApiError(e, err, options = {}) {
        const {
            errorPrefix = '',
            notifyUser = false,
            logTag = '',
            loggerLevel = 'warn',
            ignoreMessages = []
        } = options

        if (makeRequestFnc.shouldIgnoreError(err, ignoreMessages)) {
            return
        }

        const errMsg = makeRequestFnc.getErrorMessage(err)

        let issusMsg = hasPhiApiUserMessage(err) ? getPhiApiUserMessage(err) : null;

        const status = err?.status ?? (typeof err?.code === 'number' ? err.code : undefined)
        if (status !== undefined) {
            if (status === 403 && !issusMsg) {
                issusMsg = `API访问被拒绝。${errMsg ? `${errMsg}` : '请检查你的设置是否正确启用了API访问权限。'}`;
            } else if (status >= 500 && !issusMsg) {
                issusMsg = `API访问发生服务器错误。${errMsg ? `${errMsg}` : '请稍后再试，或联系管理员。'}`;
            }
        }

        if (notifyUser || issusMsg) {
            send.send_with_At(e, `${errorPrefix}\n${issusMsg || `错误信息：${errMsg}`}`)
        }

        if (logTag) {
            logger[loggerLevel](`[phi-plugin] ${logTag}`, err)
        }
    }

    /**
     * 统一发起 API 请求并处理错误
     * @template T
    * @param {import('../components/baseClass.js').botEvent} e
     * @param {() => Promise<T>} requestFn
     * @param {{
     *  errorPrefix?: string,
     *  notifyUser?: boolean,
     *  logTag?: string,
     *  loggerLevel?: 'warn'|'error',
     *  ignoreMessages?: string[]
     * }} [options]
     * @returns {Promise<T | null>}
     */
    static async requestApi(e, requestFn, options = {}) {
        try {
            return await requestFn()
        } catch (err) {
            makeRequestFnc.handleApiError(e, err, options)
            return null
        }
    }
}
