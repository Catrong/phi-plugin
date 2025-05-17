import LCHelper from "./TapTap/LCHelper.js";
import TapTapHelper from "./TapTap/TapTapHelper.js";
import QRCode from 'qrcode'

export default new class getQRcode {
    async getRequest() {
        return await TapTapHelper.requestLoginQrCode()
    }

    async getQRcode(url) {
        return await QRCode.toBuffer(url, { scale: 10 })
    }

    /**
     * @returns authorization_pending authorization_waiting
     */
    async checkQRCodeResult(request) {
        return await TapTapHelper.checkQRCodeResult(request)
    }

    async getSessionToken(result) {
        let profile = await TapTapHelper.getProfile(result.data)
        return (await LCHelper.loginAndGetToken({ ...profile.data, ...result.data })).sessionToken
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