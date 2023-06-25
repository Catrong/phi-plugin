// Assuming Level is a class defined elsewhere
class SongExpect {
    constructor(id, level, acc, expect) {
        this.id = id;
        this.level = level;
        this.acc = acc;
        this.expect = expect;
    }

    // Implementing the compare function for sorting
    static compare(a, b) {
        return a.expect - a.acc - (b.expect - b.acc);
    }

    // Overriding the toString method for printing
    toString() {
        return `{"songId":"${this.id}","level":"${this.level}","acc":${this.acc},"expect":${this.expect}}`;
    }
}
