export default class makeRequestFnc {
    static makePlatform(e) {
        return {
            platform: e.bot?.adapter?.name || e.bot?.adapter,
            platform_id: e.user_id,
        }
    }
}