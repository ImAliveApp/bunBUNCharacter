var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var MiniGame = (function () {
    function MiniGame() {
    }
    return MiniGame;
}());
var ReflexMiniGame = (function (_super) {
    __extends(ReflexMiniGame, _super);
    function ReflexMiniGame(handler, finishCallback) {
        var _this = _super.call(this) || this;
        _this.menuManager = handler.getMenuManager();
        _this.actionManager = handler.getActionManager();
        _this.characterManager = handler.getCharacterManager();
        _this.configurationManager = handler.getConfigurationManager();
        _this.finishCallback = finishCallback;
        return _this;
    }
    ReflexMiniGame.prototype.onStart = function (currentTime) {
        this.lastDecreaseTime = currentTime;
        this.touches = 1;
        this.progress = 50;
        this.dancingTime = 0;
        this.currentDrawable = "breathing.png";
        this.difficulty = Math.random() * 100;
        var difficultyTrimmed = this.difficulty.toString().substring(0, 4);
        this.actionManager.draw("laughing-ha.png", this.configurationManager.getMaximalResizeRatio(), false);
        this.actionManager.showMessage("This is a reflex game! i will walk around the screen, and you will need to touch me ,but ONLY while i DANCE! :D "
            + "\nOnce the progress bar in the menu will reach 100%, you will win! but if it reaches 0%... i will win! :D"
            + "\nThe phone will vibrate everytime you do it incorrectly"
            + "\nDifficulty: " + difficultyTrimmed, "#6599FF", "#ffffff", 10000);
        this.menuManager.setProperty("hungerProgress", "maxprogress", "100");
        this.menuManager.setProperty("hungerProgress", "progress", this.progress.toString());
        this.startTime = currentTime;
        this.gameStartTime = this.startTime + 10000;
    };
    ReflexMiniGame.prototype.onTick = function (currentTime) {
        if (currentTime > this.gameStartTime) {
            this.updateProgress(currentTime);
            this.moveToRandomLocation(currentTime);
            this.maybeDance(currentTime);
            this.drawCurrentState();
        }
        else {
            this.lastDecreaseTime = currentTime;
            this.touches = 1;
        }
    };
    ReflexMiniGame.prototype.updateProgress = function (currentTime) {
        var ongoingTime = currentTime - this.lastDecreaseTime;
        if (ongoingTime > 1000) {
            this.progress = this.progress - 1 - this.difficulty / 100;
            this.lastDecreaseTime = currentTime;
        }
        if (this.progress <= 0) {
            this.finishCallback(false);
        }
        if (this.progress < 20)
            this.menuManager.setProperty("hungerProgress", "frontcolor", "#EC2027");
        else if (this.progress < 60)
            this.menuManager.setProperty("hungerProgress", "frontcolor", "#E59400");
        this.menuManager.setProperty("hungerProgress", "Progress", this.progress.toString());
    };
    ReflexMiniGame.prototype.moveToRandomLocation = function (currentTime) {
        var randomMove = Math.floor(Math.random() * this.difficulty * 30) - Math.floor(Math.random() * this.difficulty * 30);
        this.actionManager.move(randomMove, randomMove, 250);
    };
    ReflexMiniGame.prototype.maybeDance = function (currentTime) {
        if (currentTime > this.dancingTime) {
            this.currentDrawable = "breathing.png";
        }
        var danceChance = (100 - this.progress) / 100;
        if (danceChance < 0.15)
            danceChance = 0.15;
        if (Math.random() < danceChance) {
            this.dancingTime = currentTime + danceChance * 2000;
            this.currentDrawable = "pirate-dancing.png";
        }
    };
    ReflexMiniGame.prototype.drawCurrentState = function () {
        this.actionManager.draw(this.currentDrawable, this.configurationManager.getMaximalResizeRatio(), false);
    };
    ReflexMiniGame.prototype.onEventOccured = function (eventName) {
        var now = this.configurationManager.getCurrentTime().currentTimeMillis;
        switch (eventName) {
            case "touch":
                this.handleTouch(now);
                break;
            case "stop":
                if (now - this.gameStartTime > 0)
                    this.finishCallback(false);
                break;
        }
    };
    ReflexMiniGame.prototype.handleTouch = function (currentTime) {
        if (currentTime > this.dancingTime) {
            this.progress -= this.touches;
            this.actionManager.vibrate(250);
            this.touches--;
        }
        else {
            this.touches++;
            this.progress += this.touches;
        }
        if (this.progress <= 0)
            this.finishCallback(false);
        else if (this.progress >= 100)
            this.finishCallback(true);
        this.currentDrawable = "breathing.png";
    };
    return ReflexMiniGame;
}(MiniGame));
var CatchMiniGame = (function (_super) {
    __extends(CatchMiniGame, _super);
    function CatchMiniGame(handler, resourceHelper, finishCallback) {
        var _this = _super.call(this) || this;
        _this.menuManager = handler.getMenuManager();
        _this.actionManager = handler.getActionManager();
        _this.characterManager = handler.getCharacterManager();
        _this.configurationManager = handler.getConfigurationManager();
        _this.resourceHelper = resourceHelper;
        _this.finishCallback = finishCallback;
        return _this;
    }
    CatchMiniGame.prototype.onStart = function (currentTime) {
        this.lastDecreaseTime = currentTime;
        this.touches = 1;
        this.progress = 50;
        this.difficulty = Math.random() * 100;
        var difficultyTrimmed = this.difficulty.toString().substring(0, 4);
        this.actionManager.draw("laughing-ha.png", this.configurationManager.getMaximalResizeRatio(), false);
        this.actionManager.showMessage("This is a catch game! i will walk around the screen, and you will need to catch me :D "
            + "\nOnce the progress bar in the menu will reach 100%, you will win! but if it reaches 0%... i will win! :D"
            + "\nThe phone will vibrate everytime you do it incorrectly"
            + "\nDifficulty: " + difficultyTrimmed, "#6599FF", "#ffffff", 10000);
        this.menuManager.setProperty("hungerProgress", "maxprogress", "100");
        this.menuManager.setProperty("hungerProgress", "progress", this.progress.toString());
        this.startTime = currentTime;
        this.gameStartTime = this.startTime + 10000;
    };
    CatchMiniGame.prototype.onTick = function (currentTime) {
        if (currentTime > this.gameStartTime) {
            this.updateProgress(currentTime);
            this.moveToRandomLocation(currentTime);
            this.drawRandomImage(currentTime);
        }
        else {
            this.lastDecreaseTime = currentTime;
            this.touches = 1;
        }
    };
    CatchMiniGame.prototype.updateProgress = function (currentTime) {
        var ongoingTime = currentTime - this.lastDecreaseTime;
        if (ongoingTime > 1000) {
            this.progress = this.progress - 1 - this.difficulty / 100;
            this.lastDecreaseTime = currentTime;
        }
        if (this.progress <= 0) {
            this.finishCallback(false);
        }
        if (this.progress < 20)
            this.menuManager.setProperty("hungerProgress", "frontcolor", "#EC2027");
        else if (this.progress < 60)
            this.menuManager.setProperty("hungerProgress", "frontcolor", "#E59400");
        this.menuManager.setProperty("hungerProgress", "Progress", this.progress.toString());
    };
    CatchMiniGame.prototype.moveToRandomLocation = function (currentTime) {
        var randomMove = Math.floor(Math.random() * this.difficulty * 60) - Math.floor(Math.random() * this.difficulty * 60);
        this.actionManager.move(randomMove, randomMove, 250);
    };
    CatchMiniGame.prototype.drawRandomImage = function (currentTime) {
        if (currentTime - this.lastDrawTime < 5000)
            return;
        this.lastDrawTime = currentTime;
        var randomImage = this.resourceHelper.chooseRandomImage("fun");
        if (randomImage != null)
            this.actionManager.draw(randomImage, this.configurationManager.getMaximalResizeRatio(), false);
    };
    CatchMiniGame.prototype.onEventOccured = function (eventName) {
        var now = this.configurationManager.getCurrentTime().currentTimeMillis;
        switch (eventName) {
            case "touch":
                this.handleTouch(now);
                break;
            case "stop":
                if (now - this.gameStartTime > 0)
                    this.finishCallback(false);
                break;
        }
    };
    CatchMiniGame.prototype.handleTouch = function (currentTime) {
        this.touches++;
        this.progress += this.touches;
        if (this.progress <= 0)
            this.finishCallback(false);
        else if (this.progress >= 100)
            this.finishCallback(true);
    };
    return CatchMiniGame;
}(MiniGame));
//# sourceMappingURL=MiniGame.js.map