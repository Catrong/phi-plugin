import axios from 'axios';

export default class TapInfo {
    static host = 'https://api.taptapdada.com';    

    /**
     * 从Taptap获取Phigros的更新日志
     * @param {number} limit - 获取更新日志的数量，默认为1
     * @returns {Promise<{version: string, versionCode: number, date: number, rawHtml: string}[]>} 更新日志列表
     */
    static async PgrUpdateInfo(limit = 1) {
        const path = '/apk/v1/list-by-app';

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
        const url = `${this.host}${path}?${query}`;

        const res = await axios.get(url);
        const info = /** @type {TapTapUpdateResponse} */ (res.data);

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

    static async PgrTapNotice(limit = 1) {
        const path = '/feed/v7/by-group';
        const xua = {
            V: '1',
            PN: 'TapTap',
            VN_CODE: '284001001',
            LANG: 'zh_CN'
        };

        const url_params = {
            'X-UA': new URLSearchParams(xua).toString(),
            type: 'official',
            group_id: '197452',
        };

        const query = new URLSearchParams(url_params).toString();
        const url = `${this.host}${path}?${query}`;

        const res = await axios.get(url);
        const info = /** @type {TapTapNoticeResponse} */ (res.data);

        if (!info.success) {
            return [];
        }

        return info.data.list.slice(0, limit).map(item => ({
            title: item.moment.topic.title,
            content: item.moment.topic.summary,
            date: item.moment.publish_time,
            url: item.moment.sharing?.url,
            image: item.moment.topic.images?.[0]?.original_url
        }));
    }
}