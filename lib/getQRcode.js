import LCHelper from "./TapTap/LCHelper.js";
import TapTapHelper from "./TapTap/TapTapHelper.js";
import QRCode from 'qrcode'

export default new class getQRcode {
    /**
     * @param {boolean} [useGlobal]
     */
    async getRequest(useGlobal = false) {
        return await TapTapHelper.requestLoginQrCode(undefined, useGlobal)
    }

    /**
     * @param {string} url
     * @param {boolean} [useGlobal]
     */
    async getQRcode(url, useGlobal = false) {
        return await QRCode.toBuffer(url, { scale: 10 })
    }

    /**
     * @param {import('./TapTap/CompleteQRCodeData.js').PartialQRCodeData} request
     * @param {boolean} [useGlobal]
     * @returns authorization_pending authorization_waiting
     */
    async checkQRCodeResult(request, useGlobal = false) {
        return await TapTapHelper.checkQRCodeResult(request, useGlobal)
    }

    /**
     * @param {{data: import('./TapTap/TapTapHelper.js').TapTapTokenData}} result
     * @param {boolean} [useGlobal]
     */
    async getSessionToken(result, useGlobal = false) {
        let profile = await TapTapHelper.getProfile(result.data, useGlobal)
        return (await LCHelper.loginAndGetToken({ ...profile.data, ...result.data }, useGlobal)).sessionToken
    }
}()


// let Partial = await TapTapHelper.requestLoginQrCode()
// console.info(Partial)

// await QRCode.toFile('qrcode.png', Partial.data.qrcode_url, { scale: 10 })

// // console.info(qrcode.create(Partial.data.qrcode_url) )

// let result = await TapTapHelper.checkQRCodeResult(new CompleteQRCodeData(Partial))

// while (!result.success) {
//     await common.sleep(1000)
//     result = await TapTapHelper.checkQRCodeResult(new CompleteQRCodeData(Partial))
//     console.info(1)
// }

// console.info(result)

// let result = {
//     kid: '',
//     access_token: '',
//     token_type: '',
//     mac_key: '',
//     mac_algorithm: '',
//     scope: ''
// }

// let profile = await TapTapHelper.getProfile(result.data)
// let profile = await TapTapHelper.getProfile(result)
// console.info(profile)


// let sessionToken = await LCHelper.loginAndGetToken({ ...profile.data, ...result })
// console.info(sessionToken)
