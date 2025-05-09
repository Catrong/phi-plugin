import getFile from "./getFile.js";
import path from 'path'
import { otherDataPath } from "./path.js";
import chokidar from 'chokidar'

const dataPath = path.join(otherDataPath, 'commentData.json')


export default new class getComment {

    /**
     * @typedef {Object} commentObject 评论对象
     * @property {string} sessionToken
     * @property {string} userObjectId 用户ObjectId
     * @property {number} rks
     * @property {allLevelKind} rank
     * @property {number} score
     * @property {number} acc
     * @property {boolean} fc
     * @property {string} spInfo
     * @property {number} challenge
     * @property {Date} time
     * @property {string} comment
     * @property {?string} thisId 在add时添加
     * @property {?string} songId 仅在getByCommentId时添加
     * @property {?string} PlayerId 仅在查询时添加
     * @property {?string} avatar 仅在查询时添加
     */

    constructor() {
        /**
         * 评论数据
         * @type {{[id:idString]: commentObject[]}}
         */
        this.data = getFile.FileReader(dataPath);
        /**
         * 评论id映射曲目id
         * @type {{[id:string]: idString}}
         */
        this.map = {}
        if (!this.data) {
            this.data = {};
            getFile.SetFile(dataPath, this.data);
        }
        Object.keys(this.data).forEach((/**@type {idString} */ id) => {
            this.data[id].forEach((comment, index, array) => {
                if (!comment?.thisId) {
                    array.splice(index, 1);
                    return;
                }
                this.map[comment.thisId] = id
            })
        })
        getFile.SetFile(dataPath, this.data);

        // chokidar.watch(dataPath).on('change', () => {
        //     logger.info('[phi-plugin] 重载评论区')
        //     this.data = getFile.FileReader(dataPath);
        //     this.map = {}
        //     if (!this.data) {
        //         this.data = {};
        //         getFile.SetFile(dataPath);
        //     }
        //     Object.keys(this.data).forEach((/**@type {idString} */ id) => {
        //         this.data[id].forEach((comment) => {
        //             this.map[comment.thisId] = id
        //         })
        //     })
        // });
    }

    /**
     * 获取对应曲目的所有评论
     * @param {idString} songId id
     */
    get(songId) {
        return this.data?.[songId] || [];
    }

    /**
     * 获取评论id对应的评论
     * @param {string} commentId 评论id
     */
    getByCommentId(commentId) {
        let songId = this.map[commentId]
        if (!songId) return null;
        for (let i of this.data[songId]) {
            if (i.thisId == commentId) {
                i.songId = songId
                return i;
            }
        }
        return null
    }

    /**
     * 添加评论
     * @param {idString} id id
     * @param {commentObject} comment 评论数据
     */
    add(id, comment) {
        let arr = new Uint32Array(1);
        comment.thisId = crypto.getRandomValues(arr)[0].toString();
        if (this.data[id]) {
            this.data[id].push(comment)
        } else {
            this.data[id] = [comment]
        }
        this.map[comment.thisId] = id
        return getFile.SetFile(dataPath, this.data)

    }

    /**
     * 删除评论id对应的评论
     * @param {string} commentId 评论id
     */
    del(commentId) {
        let songId = this.map[commentId]
        if (!songId) return false;
        for (let i = 0; i <= this.data[songId].length; ++i) {
            if (this.data[songId][i].thisId == commentId) {
                this.data[songId].splice(i, 1);
                delete this.map[commentId];
                return getFile.SetFile(dataPath, this.data)
            }
        }
        delete this.map[commentId];
        return false
    }
}()