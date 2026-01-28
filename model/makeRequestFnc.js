import fCompute from './fCompute.js'

export default class makeRequestFnc {
    /**
     * 
     * @param {import('../components/baseClass.js').botEvent} e 
     * @returns {import('./makeRequest.js').platformAuth}
     */
    static makePlatform(e) {
        return {
            platform: fCompute.getAdapterName(e),
            platform_id: typeof e.user_id == 'string' ? e.user_id.replace('', ':') : `${e.user_id}`,
        }
    }
}