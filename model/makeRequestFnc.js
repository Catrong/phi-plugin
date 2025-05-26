export default class makeRequestFnc {
    static makePlatform(e) {
        return {
            platform: e.bot?.adapter?.name,
            platform_id: e.user_id,
        }
    }
}