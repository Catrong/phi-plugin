// Assuming SaveManager is a class defined elsewhere

import SaveManager from './SaveManager.js'

class Util {
    /**
     * @param {number} data
     * @param {number} index
     */
    static getBit(data, index) {
        return (data & (1 << index)) ? true : false
    }
    /**
     * @param {number} data
     * @param {number} index
     * @param {boolean} b
     */
    static modifyBit(data, index, b) {
        let result = 1 << index;
        if (b) {
            data |= result;
        } else {
            data &= ~result;
        }
        return data;
    }
}


export default Util
