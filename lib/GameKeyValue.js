class GameKeyValue {
    constructor() {
        this.readCollection = 0;
        this.unlockSingle = false;
        this.collection = 0;
        this.illustration = false;
        this.avatar = false;
    }

    get(index) {
        switch (index) {
            case 0:
                return this.readCollection;
            case 1:
                return this.b2b(this.unlockSingle);
            case 2:
                return this.collection;
            case 3:
                return this.b2b(this.illustration);
            case 4:
                return this.b2b(this.avatar);
        }
        throw new RuntimeException("get参数超出范围。");
    }

    set(index, b) {
        switch (index) {
            case 0:
                this.readCollection = b;
                return;
            case 1:
                this.unlockSingle = this.b2b(b);
                return;
            case 2:
                this.collection = b;
                return;
            case 3:
                this.illustration = this.b2b(b);
                return;
            case 4:
                this.avatar = this.b2b(b);
                return;
        }
        throw new RuntimeException("set参数超出范围。");
    }

    b2b(b) {
        if (b == 0)
            return false;
        else if (b == 1)
            return true;
        else
            throw new RuntimeException("b2b参数超出范围。");
    }

    b2b(b) {
        return b ? 1 : 0;
    }
}
