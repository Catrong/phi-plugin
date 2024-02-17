// Assuming ByteReader is a class defined elsewhere
// Assuming Instant is a class imported from date-fns
// Assuming Base64 is an object imported from js-base64
import ByteReader from './ByteReader.js'
import Base64 from './Base64.js';

Buffer.prototype.getByte = function () {

}

class Summary {
    constructor(summary) {
        let now = Date().toString()
        let time = now.split(' ')
        this.updatedAt = `${time[3]} ${time[1]}.${time[2]} ${time[4]}`
        this.saveVersion = 0;
        this.challengeModeRank = 0;
        this.rankingScore = 0;
        this.gameVersion = 0;
        this.avatar = 0;

        this.cleared = new Int16Array(4);
        this.fullCombo = new Int16Array(4);
        this.phi = new Int16Array(4);

        const reader = new ByteReader(Base64.decode(summary));
        this.saveVersion = reader.getByte('utf8');
        this.challengeModeRank = reader.getShort();
        this.rankingScore = reader.getFloat();
        this.gameVersion = reader.getByte();
        this.avatar = reader.getString();
        this.cleared = [];
        this.fullCombo = [];
        this.phi = [];
        for (let level = 0; level < 4; level++) {
            this.cleared[level] = reader.getShort();
            this.fullCombo[level] = reader.getShort();
            this.phi[level] = reader.getShort();
        }
    }

    serialize() {
        const bytes = this.avatar.getBytes();
        const reader = new ByteReader(new Array(33 + bytes.length));
        reader.putByte(this.saveVersion);
        reader.putShort(this.challengeModeRank);
        reader.putFloat(this.rankingScore);
        reader.putByte(this.gameVersion);
        reader.putString(this.avatar);
        for (let level = 0; level < 4; level++) {
            reader.putShort(this.cleared[level]);
            reader.putShort(this.fullCombo[level]);
            reader.putShort(this.phi[level]);
        }
        return Base64.encode(reader.data);
    }

    toString() {
        return `{"存档版本":${this.saveVersion},"课题分":${this.challengeModeRank},"RKS":${this.rankingScore.toFixed(4)},"游戏版本":${this.gameVersion},"头像":"${this.avatar}","EZ":[${this.cleared[0]},${this.fullCombo[0]},${this.phi[0]}],"HD":[${this.cleared[1]},${this.fullCombo[1]},${this.phi[1]}],"IN":[${this.cleared[2]},${this.fullCombo[2]},${this.phi[2]}],"AT":[${this.cleared[3]},${this.fullCombo[3]},${this.phi[3]}]}`;
    }

    toString(saveUrl) {
        return `{"saveUrl":"${saveUrl}","存档版本":${this.saveVersion},"课题分":${this.challengeModeRank},"RKS":${this.rankingScore.toFixed(4)},"游戏版本":${this.gameVersion},"头像":"${this.avatar}","EZ":[${this.cleared[0]},${this.fullCombo[0]},${this.phi[0]}],"HD":[${this.cleared[1]},${this.fullCombo[1]},${this.phi[1]}],"IN":[${this.cleared[2]},${this.fullCombo[2]},${this.phi[2]}],"AT":[${this.cleared[3]},${this.fullCombo[3]},${this.phi[3]}]}`;
    }
}


export default Summary