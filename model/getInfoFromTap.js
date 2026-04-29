export default class TapInfo {
    /**
     * 从Taptap获取Phigros的更新日志
     * @param {number} limit - 获取更新日志的数量，默认为1
     * @returns {Promise<{version: string, versionCode: number, date: number, rawHtml: string}[]>} 更新日志列表
     */
    static async PgrUpdateInfo(limit = 1) {
        const baseUrl = 'https://api.taptapdada.com/apk/v1/list-by-app';

        // 构建X-UA参数
        const xua = {
            V: '1',
            PN: 'TapTap',
            VN_CODE: '283021001',
            LANG: 'zh_CN'
        };

        const url_params = {
            limit: String(limit),
            'X-UA': new URLSearchParams(xua).toString(),
            from: '0',
            app_id: '165287'
        };

        const query = new URLSearchParams(url_params).toString();
        const url = `${baseUrl}?${query}`;

        const res = await fetch(url);
        const info = /** @type {TapTapUpdateResponse} */ (await res.json());

        if (!info.success) {
            return [];
        }

        return info.data.list.map(item => ({
            version: item.version_label,
            versionCode: item.version_code,
            date: item.update_date,
            rawHtml: item.whatsnew.text
        }));
    }
}