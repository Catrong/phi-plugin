// Assuming Level is a class defined elsewhere
class SongLevel {
    constructor(id, level, s, a, c, difficulty, rks) {
        this.id = id;
        this.level = level;
        this.s = s;
        this.a = a;
        this.c = c;
        this.difficulty = difficulty;
        this.rks = rks;
    }

    // Implementing the compare function for sorting
    static compare(a, b) {
        return b.rks - a.rks;
    }

    // Overriding the toString method for printing
    toString() {
        return `{"songId":"${this.id}","level":"${this.level}","score":${this.s},"acc":${this.a},"fc":${this.c},"定数":${this.difficulty.toFixed(1)},"单曲rks":${this.rks}}`;
    }
}
