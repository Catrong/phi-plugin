import fCompute from './fCompute.js'

export default class makeRequestFnc {
    static makePlatform(e) {
        return {
            platform: fCompute.getAdapterName(e),
            platform_id: e.user_id,
        }
    }
}