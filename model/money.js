import get from "./getdata.js";

export default new class money {
    async getNoteNum(user_id) {
        return (await get.getpluginData(user_id))
    }
}()