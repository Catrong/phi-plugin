import LCHelper from "./LCHelper.js";
import TapTapHelper from "./TapTapHelper.js";
import QRCode from 'qrcode'
import common from "../../../../lib/common/common.js";

// export default new class getQRcode {
//     async getRequest() {
//         return await TapTapHelper.requestLoginQrCode()
//     }

//     async getQRcode(url) {
//         return await QRCode.toBuffer(url, { scale: 10 })
//     }

//     async checkQRCodeResult(request) {
//         return await TapTapHelper.checkQRCodeResult(request)
//     }

//     async getProfile(result) {
//         return await TapTapHelper.getProfile(result.data)
//     }

//     async getSessionToken(profile, result) {
//         return await LCHelper.loginAndGetToken({ ...profile.data, ...result.data })
//     }
// }()


let Partial = await TapTapHelper.requestLoginQrCode()
console.info(Partial)

// await QRCode.toFile('qrcode.png', Partial.data.qrcode_url, { scale: 10 })

// // console.info(qrcode.create(Partial.data.qrcode_url) )

// let result = await TapTapHelper.checkQRCodeResult(Partial)

// while (!result.success) {
//     await common.sleep(2000)
//     result = await TapTapHelper.checkQRCodeResult(Partial)
//     console.info(result)
// }

// console.info(result)

// // let result = {
// //     kid: '1/O_I6HWAwQyDprWXujXgC65ZxipruCZAe_EcR565m7Zek6oLalJtLzH1K_cJyPX_4Mue0QgLp5RQfr4mf4FhYWavnNkyy_YnZqJDwDn4YEP2kcZny9aoIGUH_QFpVL9awF7AAq1iQCHketsTCzWUfzyVDaald526BVrYAiQUzasXQn29sY19oVoAJwJpxjlYBTX1Jr7PXrFOBreYlg213hRtzYnFcX3RHIkpZO9Qo86jPxfIqR7wHdh74sD0ZZ-808Rf5hg3ITfPa30a7h36XUhd1ikpVHGsbG0nYm5mb8JKc2C5Qq0mbGCIap5YVtHLL2BUbKpniDKwiWgsbpcRBDw',
// //     access_token: '1/O_I6HWAwQyDprWXujXgC65ZxipruCZAe_EcR565m7Zek6oLalJtLzH1K_cJyPX_4Mue0QgLp5RQfr4mf4FhYWavnNkyy_YnZqJDwDn4YEP2kcZny9aoIGUH_QFpVL9awF7AAq1iQCHketsTCzWUfzyVDaald526BVrYAiQUzasXQn29sY19oVoAJwJpxjlYBTX1Jr7PXrFOBreYlg213hRtzYnFcX3RHIkpZO9Qo86jPxfIqR7wHdh74sD0ZZ-808Rf5hg3ITfPa30a7h36XUhd1ikpVHGsbG0nYm5mb8JKc2C5Qq0mbGCIap5YVtHLL2BUbKpniDKwiWgsbpcRBDw',
// //     token_type: 'mac',
// //     mac_key: 'zCgtfVWxajWHl2MYVoFMNdPn0E2YXrV4mTjWjLKp',
// //     mac_algorithm: 'hmac-sha-1',
// //     scope: 'public_profile'
// // }

// let profile = await TapTapHelper.getProfile(result.data)
// // let profile = await TapTapHelper.getProfile(result)
// console.info(profile)


// let sessionToken = await LCHelper.loginAndGetToken({ ...profile.data, ...result.data })
// console.info(sessionToken)