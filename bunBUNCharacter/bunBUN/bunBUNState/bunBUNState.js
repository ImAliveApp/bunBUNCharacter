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
var bunBUNState = (function () {
    function bunBUNState(switchContext) {
        this.switchContext = switchContext;
    }
    Object.defineProperty(bunBUNState, "WALK_TIME", {
        get: function () { return 1000; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(bunBUNState, "SLEEPING", {
        get: function () { return "sleeping"; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(bunBUNState, "PASSIVE", {
        get: function () { return "passive"; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(bunBUNState, "ACTIVE", {
        get: function () { return "active"; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(bunBUNState, "CRAZY", {
        get: function () { return "crazy"; },
        enumerable: true,
        configurable: true
    });
    ;
    bunBUNState.prototype.onStart = function (handler) {
        var _this = this;
        this.categoryOnScreen = "";
        this.walking = false;
        this.noDrawTimer = 0;
        this.lastInteractionTime = 0;
        this.managersHandler = handler;
        this.menuManager = handler.getMenuManager();
        this.actionManager = handler.getActionManager();
        this.resourceManager = handler.getResourceManager();
        this.databaseManager = handler.getDatabaseManager();
        this.characterManager = handler.getCharacterManager();
        this.configurationManager = handler.getConfigurationManager();
        this.resourceManagerHelper = new ResourceManagerHelper(this.resourceManager);
        this.timerTrigger = new TimerTriggerSystem(function () { return _this.configurationManager.getCurrentTime().currentTimeMillis; });
    };
    bunBUNState.prototype.walkRandomally = function () {
        var screenWidth = this.configurationManager.getScreenWidth();
        var currentX = this.characterManager.getCurrentCharacterXPosition();
        var distanceToMove = Math.abs(currentX - screenWidth);
        var category = AgentConstants.ON_FALLING_RIGHT;
        this.walking = true;
        if (this.shouldEventHappen(0.5) && distanceToMove > screenWidth / 4) {
            this.actionManager.move(distanceToMove / 3, 0, bunBUNState.WALK_TIME);
        }
        else {
            this.actionManager.move(-distanceToMove / 3, 0, bunBUNState.WALK_TIME);
            category = AgentConstants.ON_FALLING_LEFT;
        }
        return category;
    };
    bunBUNState.prototype.shouldEventHappen = function (chance) {
        return Math.random() < chance;
    };
    bunBUNState.prototype.drawAndPlayRandomResourceByCategory = function (category) {
        if (this.playingMiniGame)
            return;
        if (this.currentTime < this.noDrawTimer)
            return;
        var resToDraw = this.resourceManagerHelper.chooseRandomImage(category);
        if (resToDraw != this.categoryOnScreen)
            this.actionManager.draw(resToDraw, this.configurationManager.getMaximalResizeRatio(), false);
        this.categoryOnScreen = category;
        var soundToPlay = this.resourceManagerHelper.chooseRandomSound(category);
        if (!this.configurationManager.isSoundPlaying())
            this.actionManager.playSound(soundToPlay, false);
    };
    bunBUNState.prototype.syncState = function () {
        var moodLevel = this.databaseManager.getObject("moodLevel");
        if (moodLevel != null) {
            this.moodLevel = Number(moodLevel);
        }
        var hungerLevel = this.databaseManager.getObject("hungerLevel");
        if (hungerLevel != null) {
            this.hungerLevel = Number(hungerLevel);
        }
        var foodCount = this.databaseManager.getObject("foodCount");
        if (foodCount != null) {
            this.foodCount = Number(foodCount);
        }
        var inCrazyForm = this.databaseManager.getObject("inCrazyForm");
        if (inCrazyForm != null) {
            this.inCrazyForm = inCrazyForm == "true" ? true : false;
        }
        var moodLevelPenalty = this.databaseManager.getObject("moodLevelPenalty");
        if (moodLevelPenalty != null) {
            this.moodLevelPenalty = Number(moodLevelPenalty);
        }
    };
    bunBUNState.prototype.feed = function () {
        if (this.playingMiniGame)
            return;
        if (this.foodCount <= 0) {
            this.actionManager.showSystemMessage("You don't have enough food, to obtain food you must play and win bunBUN.");
            return;
        }
        this.foodCount -= 1;
        this.databaseManager.saveObject("foodCount", this.foodCount.toString());
        this.hungerLevel -= 20;
        this.updateHunger();
    };
    bunBUNState.prototype.updateFoodCount = function () {
        if (this.foodCount < 0)
            this.foodCount = 0;
        this.menuManager.setProperty("foodCount", "text", this.foodCount.toString() + " carrots left");
        this.databaseManager.saveObject("foodCount", this.foodCount.toString());
    };
    bunBUNState.prototype.updateHunger = function () {
        if (this.hungerLevel > 100)
            this.hungerLevel = 100;
        if (this.hungerLevel < 0)
            this.hungerLevel = 0;
        this.menuManager.setProperty("hungerProgress", "progress", this.hungerLevel.toString());
        this.databaseManager.saveObject("hungerLevel", this.hungerLevel.toString());
        if (this.hungerLevel < 20) {
            this.menuManager.setProperty("hungerProgress", "frontcolor", "#00ff00");
            this.moodLevel += 2;
        }
        else if (this.hungerLevel < 40) {
            this.menuManager.setProperty("hungerProgress", "frontcolor", "#3bc293");
        }
        else if (this.hungerLevel < 60) {
            this.menuManager.setProperty("hungerProgress", "frontcolor", "#ffde56");
            this.moodLevel += 1;
        }
        else if (this.hungerLevel < 80) {
            this.menuManager.setProperty("hungerProgress", "frontcolor", "#fbcd75");
        }
        else if (this.hungerLevel < 100) {
            this.menuManager.setProperty("hungerProgress", "frontcolor", "#fb7575");
        }
        this.updateMood();
    };
    bunBUNState.prototype.updateMood = function () {
        if (this.moodLevel < this.moodLevelPenalty)
            this.moodLevel = this.moodLevelPenalty;
        if (this.moodLevel >= 100 && !this.inCrazyForm) {
            this.moodLevel = 100;
            this.moodLevelPenalty = 0;
            this.inCrazyForm = true;
            this.databaseManager.saveObject("inCrazyForm", "true");
            this.switchContext.switchTo(bunBUNState.CRAZY);
            this.drawAndPlayRandomResourceByCategory("turning_to_crazy");
            this.noDrawTimer = this.currentTime + 10000;
        }
        else if (this.moodLevel <= 0 && this.inCrazyForm) {
            this.moodLevel = 0;
            this.moodLevelPenalty = 0;
            this.inCrazyForm = false;
            this.databaseManager.saveObject("inCrazyForm", "false");
            this.switchContext.switchTo(bunBUNState.PASSIVE);
            this.drawAndPlayRandomResourceByCategory("turning_to_normal");
            this.noDrawTimer = this.currentTime + 10000;
        }
        this.databaseManager.saveObject("moodLevel", this.moodLevel.toString());
        this.databaseManager.saveObject("moodLevelPenalty", this.moodLevelPenalty.toString());
        this.menuManager.setProperty("moodProgress", "progress", this.moodLevel.toString());
    };
    return bunBUNState;
}());
var PassiveSubstate;
(function (PassiveSubstate) {
    PassiveSubstate[PassiveSubstate["LookingAround"] = 0] = "LookingAround";
    PassiveSubstate[PassiveSubstate["Eating"] = 1] = "Eating";
    PassiveSubstate[PassiveSubstate["Drinking"] = 2] = "Drinking";
    PassiveSubstate[PassiveSubstate["Reading"] = 3] = "Reading";
    PassiveSubstate[PassiveSubstate["DoingSomethingStupid"] = 4] = "DoingSomethingStupid";
    PassiveSubstate[PassiveSubstate["AskingForInteraction"] = 5] = "AskingForInteraction";
    PassiveSubstate[PassiveSubstate["Mad"] = 6] = "Mad";
    PassiveSubstate[PassiveSubstate["Happy"] = 7] = "Happy";
    PassiveSubstate[PassiveSubstate["WalkingAround"] = 8] = "WalkingAround";
    PassiveSubstate[PassiveSubstate["Fun"] = 9] = "Fun";
})(PassiveSubstate || (PassiveSubstate = {}));
var PassiveState = (function (_super) {
    __extends(PassiveState, _super);
    function PassiveState(switchContext) {
        var _this = _super.call(this, switchContext) || this;
        _this.playingMiniGame = false;
        return _this;
    }
    Object.defineProperty(PassiveState, "LOOKING_AROUND_CHANGE", {
        get: function () { return 0.1; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(PassiveState, "CHANCE_SWITCH_TO_FUN", {
        get: function () { return 0.2; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(PassiveState, "CHANGE_PASSIVE_STATE", {
        get: function () { return 0.2; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(PassiveState, "CHANGE_TO_SLEEP", {
        get: function () { return 0.05; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(PassiveState, "CHANGE_TO_NAP", {
        get: function () { return 0.1; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(PassiveState, "NAP_TIME", {
        get: function () { return 600000; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(PassiveState, "SLEEP_TIME", {
        get: function () { return 18000000; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(PassiveState, "EATING_TIME", {
        get: function () { return 10000; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(PassiveState, "READING_TIME", {
        get: function () { return 20000; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(PassiveState, "HAVING_FUN_TIME", {
        get: function () { return 20000; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(PassiveState, "BEING_HAPPY_TIME", {
        get: function () { return 10000; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(PassiveState, "ASKING_FOR_INTERACTION_TIME", {
        get: function () { return 15000; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(PassiveState, "DOING_SOMETHING_STUPID_TIME", {
        get: function () { return 20000; },
        enumerable: true,
        configurable: true
    });
    ;
    PassiveState.prototype.initializeState = function () {
        this.syncState();
        this.maybeWokeUp();
    };
    PassiveState.prototype.maybeWokeUp = function () {
        var wokeUp = this.databaseManager.getObject("wokeUp");
        if (wokeUp != null && wokeUp == "true") {
            this.databaseManager.saveObject("wokeUp", "false");
            this.currentState = PassiveSubstate.Mad;
        }
    };
    PassiveState.prototype.onStart = function (handler) {
        _super.prototype.onStart.call(this, handler);
        this.lastPlayGameClick = 0;
        this.hungerLevel = 0;
        this.moodLevel = 0;
        this.currentState = PassiveSubstate.LookingAround;
        this.playerWinMessages = ["You are very good at this game :) \nwe got another carrot :D", "Hm, i need more training xD \nwe got another carrot :D",
            "how did you win?!? \nwe got another carrot :D", "Yay! nice job! \nwe got another carrot :D",
            "Sweet! i knew you were training :D \nwe got another carrot :D"];
        this.playerLoseMessages = ["Num, that was easy! :P", "Nana Banana", "Nice round, but i still won :D",
            "Hahaha, maybe next time!", "I'm much better than you! :P"];
        this.cryingMessages = ["Why don't you play with me? :(", "I'm bored :(", "Pay attention to me please :'(",
            "You don't love me anymore! :( :(", "I thought we were friends! :'("];
    };
    PassiveState.prototype.onTick = function (time) {
        this.currentTime = time;
        if (this.playingMiniGame) {
            this.miniGame.onTick(time);
            return;
        }
        switch (this.currentState) {
            case PassiveSubstate.LookingAround:
                this.lookingAroundTick(time);
                break;
            case PassiveSubstate.Eating:
                this.eatingTick(time);
                break;
            case PassiveSubstate.Drinking:
                this.drinkingTick(time);
                break;
            case PassiveSubstate.Reading:
                this.readingTick(time);
                break;
            case PassiveSubstate.DoingSomethingStupid:
                this.doingSomethingStupidTick(time);
                break;
            case PassiveSubstate.AskingForInteraction:
                this.askingForInteractionTick(time);
                break;
            case PassiveSubstate.Happy:
                this.happyTick(time);
                break;
            case PassiveSubstate.Mad:
                this.madTick(time);
                break;
            case PassiveSubstate.WalkingAround:
                this.walkingAroundTick(time);
                break;
            case PassiveSubstate.Fun:
                this.havingFunTick(time);
                break;
        }
    };
    PassiveState.prototype.lookingAroundTick = function (time) {
        this.actionManager.stopSound();
        if (time - this.lastInteractionTime > 600000 && this.lastInteractionTime != 0) {
            this.actionManager.stopSound();
            this.askingForInteractionStartTime = time;
            this.currentState = PassiveSubstate.AskingForInteraction;
            return;
        }
        if (this.shouldEventHappen(PassiveState.LOOKING_AROUND_CHANGE)) {
            if (this.shouldEventHappen(PassiveState.CHANGE_PASSIVE_STATE)) {
                this.actionManager.stopSound();
                this.currentState = PassiveSubstate.DoingSomethingStupid;
                this.timerTrigger.set("n_doingSomethingStupid", PassiveState.DOING_SOMETHING_STUPID_TIME);
            }
            else if (this.shouldEventHappen(PassiveState.CHANGE_PASSIVE_STATE)) {
                this.actionManager.stopSound();
                this.currentState = PassiveSubstate.Eating;
                this.timerTrigger.set("n_eating", PassiveState.EATING_TIME);
            }
            else if (this.shouldEventHappen(PassiveState.CHANGE_PASSIVE_STATE)) {
                this.actionManager.stopSound();
                this.currentState = PassiveSubstate.Reading;
                this.timerTrigger.set("n_reading", PassiveState.READING_TIME);
            }
            else if (this.shouldEventHappen(PassiveState.CHANGE_PASSIVE_STATE)) {
                this.actionManager.stopSound();
                this.currentState = PassiveSubstate.Drinking;
                this.timerTrigger.set("n_drinking", PassiveState.EATING_TIME);
            }
            else if (this.shouldEventHappen(PassiveState.CHANCE_SWITCH_TO_FUN)) {
                this.actionManager.stopSound();
                this.currentState = PassiveSubstate.Fun;
                this.timerTrigger.set("n_having_fun", PassiveState.HAVING_FUN_TIME);
            }
            else if (this.shouldEventHappen(PassiveState.CHANGE_TO_NAP)) {
                this.timerTrigger.set("n_sleepingTime", PassiveState.NAP_TIME);
                this.switchContext.switchTo(PassiveState.SLEEPING);
            }
            else if (this.shouldEventHappen(PassiveState.CHANGE_TO_SLEEP)) {
                this.timerTrigger.set("n_sleepingTime", PassiveState.SLEEP_TIME);
                this.switchContext.switchTo(PassiveState.SLEEPING);
            }
            else {
                this.actionManager.stopSound();
                this.actionManager.draw(this.walkRandomally(), this.configurationManager.getMaximalResizeRatio(), false);
                this.currentState = PassiveSubstate.WalkingAround;
                this.timerTrigger.set("n_walkingAround", bunBUNState.WALK_TIME);
            }
        }
        else {
            this.drawAndPlayRandomResourceByCategory("n_lookingAround");
        }
    };
    PassiveState.prototype.eatingTick = function (time) {
        if (!this.shouldContinueSubstate("n_eating"))
            return;
        this.drawAndPlayRandomResourceByCategory("n_eating");
    };
    PassiveState.prototype.havingFunTick = function (time) {
        if (!this.shouldContinueSubstate("n_having_fun"))
            return;
        this.drawAndPlayRandomResourceByCategory("n_having_fun");
    };
    PassiveState.prototype.drinkingTick = function (time) {
        if (!this.shouldContinueSubstate("n_drinking"))
            return;
        this.drawAndPlayRandomResourceByCategory("n_drinking");
    };
    PassiveState.prototype.readingTick = function (time) {
        if (!this.shouldContinueSubstate("n_drinking"))
            return;
        this.drawAndPlayRandomResourceByCategory("n_reading");
    };
    PassiveState.prototype.askingForInteractionTick = function (time) {
        if (time - this.askingForInteractionStartTime > 10000) {
            this.actionManager.stopSound();
            var messageIndex = Math.floor(Math.random() * 4);
            this.actionManager.showMessage(this.cryingMessages[messageIndex], "#91CA63", "#ffffff", 5000);
            this.currentState = PassiveSubstate.Mad;
            return;
        }
        this.drawAndPlayRandomResourceByCategory("n_askingForInteraction");
    };
    PassiveState.prototype.happyTick = function (time) {
        if (!this.shouldContinueSubstate("n_happy"))
            return;
        if (time - this.lastMoodChangeTime > 5000) {
            this.moodLevel -= 1;
            this.updateMood();
            this.lastMoodChangeTime = time;
        }
        this.drawAndPlayRandomResourceByCategory("n_happy");
    };
    PassiveState.prototype.madTick = function (time) {
        if (time - this.lastMoodChangeTime > 10000) {
            this.moodLevel += 1;
            this.moodLevelPenalty += 1;
            this.updateMood();
            this.lastMoodChangeTime = time;
        }
        this.drawAndPlayRandomResourceByCategory("n_mad");
    };
    PassiveState.prototype.doingSomethingStupidTick = function (time) {
        if (!this.shouldContinueSubstate("n_doingSomethingStupid"))
            return;
        this.drawAndPlayRandomResourceByCategory("n_doingSomethingStupid");
    };
    PassiveState.prototype.walkingAroundTick = function (time) {
        if (!this.shouldContinueSubstate("n_walkingAround")) {
            this.walking = false;
        }
    };
    PassiveState.prototype.shouldContinueSubstate = function (substateName) {
        if (!this.timerTrigger.isOnGoing(substateName)) {
            this.actionManager.stopSound();
            this.currentState = PassiveSubstate.LookingAround;
            return false;
        }
        return true;
    };
    PassiveState.prototype.onBackgroundTick = function (time) {
        this.onTick(time);
    };
    PassiveState.prototype.onPhoneEventOccurred = function (eventName) {
        if (eventName == AgentConstants.NEW_OUTGOING_CALL ||
            eventName == AgentConstants.INCOMING_CALL ||
            eventName == AgentConstants.SMS_RECEIVED) {
            this.actionManager.stopSound();
            this.currentState = PassiveSubstate.Fun;
            this.timerTrigger.set("n_having_fun", PassiveState.HAVING_FUN_TIME);
        }
    };
    PassiveState.prototype.onMove = function (oldX, oldY, newX, newY) {
    };
    PassiveState.prototype.onRelease = function (currentX, currentY) {
        var screenHeight = this.configurationManager.getScreenHeight();
        if (currentY < screenHeight - 50)
            this.actionManager.move(0, screenHeight, 0);
        this.lastInteractionTime = this.currentTime;
        if (this.playingMiniGame)
            return;
        if (this.currentState == PassiveSubstate.AskingForInteraction) {
            this.actionManager.stopSound();
            this.currentState = PassiveSubstate.Happy;
            this.timerTrigger.set("n_happy", PassiveState.BEING_HAPPY_TIME);
        }
    };
    PassiveState.prototype.onPick = function (currentX, currentY) {
        if (this.playingMiniGame) {
            this.miniGame.onEventOccured("touch");
        }
    };
    PassiveState.prototype.onMenuItemSelected = function (itemName) {
        switch (itemName) {
            case "feedButton":
                this.lastInteractionTime = this.currentTime;
                this.feed();
                break;
            case "playButton":
                this.lastInteractionTime = this.currentTime;
                if (this.playingMiniGame) {
                    this.miniGame.onEventOccured("stop");
                }
                else {
                    var now = this.configurationManager.getCurrentTime().currentTimeMillis;
                    if (now - this.lastPlayGameClick < 2000)
                        return;
                    this.lastPlayGameClick = now;
                    this.playRandomMiniGame(now);
                }
                break;
        }
    };
    PassiveState.prototype.onResponseReceived = function (response) {
    };
    PassiveState.prototype.onLocationReceived = function (location) {
    };
    PassiveState.prototype.onUserActivityStateReceived = function (state) {
    };
    PassiveState.prototype.onHeadphoneStateReceived = function (state) {
    };
    PassiveState.prototype.onWeatherReceived = function (weather) {
    };
    PassiveState.prototype.onConfigureMenuItems = function (menuBuilder) { };
    PassiveState.prototype.onSpeechRecognitionResults = function (results) {
    };
    PassiveState.prototype.onPlacesReceived = function (places) { };
    PassiveState.prototype.playRandomMiniGame = function (currentTime) {
        var _this = this;
        if (this.playingMiniGame)
            return;
        if (currentTime < this.noPlayPenaltyTime) {
            this.actionManager.showMessage("I said that i don't want to play right now!!", "#4C4D4F", "#ffffff", 2000);
            this.noPlayPenaltyTime = currentTime + 10000;
            return;
        }
        var playingGameChange = this.currentState == PassiveSubstate.Mad ? 0.95 : 0.6;
        if (this.shouldEventHappen(playingGameChange)) {
            this.actionManager.showMessage("I don't want to play right now..", "#4C4D4F", "#ffffff", 2000);
            this.noPlayPenaltyTime = currentTime + 10000;
            return;
        }
        this.moodLevel -= 10;
        this.updateMood();
        this.menuManager.setProperty("hungerLabel", "text", "Game:");
        this.menuManager.setProperty("playButton", "Text", "Surrender");
        this.playingMiniGame = true;
        var randomNumber = Math.random() * 100;
        if (randomNumber <= 50) {
            this.miniGame = new CatchMiniGame(this.managersHandler, this.resourceManagerHelper, function (playerWon) {
                _this.miniGameOver(playerWon);
            });
        }
        else {
            this.miniGame = new ReflexMiniGame(this.managersHandler, function (playerWon) {
                _this.miniGameOver(playerWon);
            });
        }
        this.miniGame.onStart(this.configurationManager.getCurrentTime().currentTimeMillis);
    };
    PassiveState.prototype.miniGameOver = function (playerWon) {
        this.actionManager.move(-this.configurationManager.getScreenWidth(), this.configurationManager.getScreenHeight(), 20);
        this.playingMiniGame = false;
        var messageIndex = Math.floor(Math.random() * 4);
        if (playerWon) {
            this.foodCount += 1;
            this.updateFoodCount();
            this.actionManager.draw("bunBUN__laughing.png", this.configurationManager.getMaximalResizeRatio(), false);
            this.actionManager.showMessage(this.playerWinMessages[messageIndex], "#91CA63", "#ffffff", 5000);
        }
        else {
            this.actionManager.draw("laughing-ha.png", this.configurationManager.getMaximalResizeRatio(), false);
            this.actionManager.showMessage(this.playerLoseMessages[messageIndex], "#EC2027", "#ffffff", 5000);
        }
        this.menuManager.setProperty("playButton", "Text", "Let's play!");
        this.menuManager.setProperty("hungerLabel", "text", "Hunger:");
        this.menuManager.setProperty("hungerProgress", "progress", this.moodLevel.toString());
        this.currentState = PassiveSubstate.LookingAround;
    };
    return PassiveState;
}(bunBUNState));
var SleepingSubstate;
(function (SleepingSubstate) {
    SleepingSubstate[SleepingSubstate["Normal"] = 0] = "Normal";
    SleepingSubstate[SleepingSubstate["Nap"] = 1] = "Nap";
})(SleepingSubstate || (SleepingSubstate = {}));
var SleepingState = (function (_super) {
    __extends(SleepingState, _super);
    function SleepingState(switchContext) {
        return _super.call(this, switchContext) || this;
    }
    Object.defineProperty(SleepingState, "SNORE_TO_NORMAL_TIME", {
        get: function () { return 5000; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SleepingState, "NORMAL_TO_SNORE_CHANCE", {
        get: function () { return 0.0027; },
        enumerable: true,
        configurable: true
    });
    SleepingState.prototype.initializeState = function () {
        this.syncState();
        this.currentState = SleepingSubstate.Normal;
    };
    SleepingState.prototype.onStart = function (handler) {
        _super.prototype.onStart.call(this, handler);
        this.currentState = SleepingSubstate.Normal;
    };
    SleepingState.prototype.onTick = function (time) {
        this.currentTime = time;
        if (!this.timerTrigger.isOnGoing("n_sleepingTime")) {
            this.switchContext.switchTo(bunBUNState.PASSIVE);
            this.actionManager.stopSound();
            return;
        }
        switch (this.currentState) {
            case SleepingSubstate.Normal:
                this.normalTick(time);
                break;
            case SleepingSubstate.Nap:
                this.napTick(time);
                break;
        }
    };
    SleepingState.prototype.normalTick = function (time) {
        if (!this.configurationManager.isSoundPlaying()) {
            this.drawAndPlayRandomResourceByCategory("n_sleeping-normal");
        }
        if (this.shouldEventHappen(0.25)) {
            this.actionManager.stopSound();
            this.timerTrigger.set("n_sleep_nap", SleepingState.SNORE_TO_NORMAL_TIME);
            this.currentState = SleepingSubstate.Nap;
        }
    };
    SleepingState.prototype.napTick = function (time) {
        if (!this.timerTrigger.isOnGoing("n_sleep_nap")) {
            this.actionManager.stopSound();
            this.currentState = SleepingSubstate.Normal;
            return;
        }
        this.drawAndPlayRandomResourceByCategory("n_sleeping-nap");
    };
    SleepingState.prototype.onBackgroundTick = function (time) {
        this.onTick(time);
    };
    SleepingState.prototype.onPhoneEventOccurred = function (eventName) {
        if (eventName == AgentConstants.NEW_OUTGOING_CALL ||
            eventName == AgentConstants.INCOMING_CALL ||
            eventName == AgentConstants.SMS_RECEIVED) {
            this.maybeWakeUp();
        }
    };
    SleepingState.prototype.onMove = function (oldX, oldY, newX, newY) {
    };
    SleepingState.prototype.onRelease = function (currentX, currentY) {
        var screenHeight = this.configurationManager.getScreenHeight();
        if (currentY < screenHeight - 50)
            this.actionManager.move(0, screenHeight, 0);
    };
    SleepingState.prototype.onPick = function (currentX, currentY) {
        this.maybeWakeUp();
    };
    SleepingState.prototype.onMenuItemSelected = function (itemName) {
        this.actionManager.showMessage("Zzz Zzz Zzzzzzz", "#000000", "#ffffff", 2000);
        this.maybeWakeUp();
    };
    SleepingState.prototype.onResponseReceived = function (response) {
    };
    SleepingState.prototype.onLocationReceived = function (location) {
    };
    SleepingState.prototype.onUserActivityStateReceived = function (state) {
    };
    SleepingState.prototype.onHeadphoneStateReceived = function (state) {
    };
    SleepingState.prototype.onWeatherReceived = function (weather) {
    };
    SleepingState.prototype.onConfigureMenuItems = function (menuBuilder) {
    };
    SleepingState.prototype.onSpeechRecognitionResults = function (results) {
    };
    SleepingState.prototype.onPlacesReceived = function (places) { };
    SleepingState.prototype.maybeWakeUp = function () {
        this.moodLevel += 5;
        this.updateMood();
        if (this.shouldEventHappen(0.3)) {
            this.actionManager.stopSound();
            this.databaseManager.saveObject("wokeUp", "true");
            this.switchContext.switchTo(bunBUNState.PASSIVE);
        }
    };
    return SleepingState;
}(bunBUNState));
var CrazySubstate;
(function (CrazySubstate) {
    CrazySubstate[CrazySubstate["Normal"] = 0] = "Normal";
    CrazySubstate[CrazySubstate["SharpingKnife"] = 1] = "SharpingKnife";
    CrazySubstate[CrazySubstate["PlayingWithEyeBall"] = 2] = "PlayingWithEyeBall";
    CrazySubstate[CrazySubstate["RunningRandomally"] = 3] = "RunningRandomally";
    CrazySubstate[CrazySubstate["Eating"] = 4] = "Eating";
    CrazySubstate[CrazySubstate["KnockingOnScreen"] = 5] = "KnockingOnScreen";
    CrazySubstate[CrazySubstate["HideAndScare"] = 6] = "HideAndScare";
    CrazySubstate[CrazySubstate["Drinking"] = 7] = "Drinking";
})(CrazySubstate || (CrazySubstate = {}));
var CrazyState = (function (_super) {
    __extends(CrazyState, _super);
    function CrazyState(switchContext) {
        return _super.call(this, switchContext) || this;
    }
    Object.defineProperty(CrazyState, "SCARY_SUBSTATE_TIME", {
        get: function () { return 10000; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(CrazyState, "SCARY_SUBSTATE_CHANGE", {
        get: function () { return 0.14; },
        enumerable: true,
        configurable: true
    });
    ;
    CrazyState.prototype.initializeState = function () {
        this.currentState = CrazySubstate.Normal;
    };
    CrazyState.prototype.onTick = function (time) {
        this.currentTime = time;
        this.maybeDecreaseCrazy(time);
        switch (this.currentState) {
            case CrazySubstate.Normal:
                this.normalTick(time);
                break;
            case CrazySubstate.Eating:
                this.eatingTick(time);
                break;
            case CrazySubstate.HideAndScare:
                this.hideAndScareTick(time);
                break;
            case CrazySubstate.KnockingOnScreen:
                this.knockingOnScreenTick(time);
                break;
            case CrazySubstate.PlayingWithEyeBall:
                this.playingWithEyeBallTick(time);
                break;
            case CrazySubstate.RunningRandomally:
                this.runningRandomallyTick(time);
                break;
            case CrazySubstate.SharpingKnife:
                this.sharpingKnifeTick(time);
                break;
            case CrazySubstate.Drinking:
                this.drinkingTick(time);
                break;
        }
    };
    CrazyState.prototype.normalTick = function (time) {
        if (this.shouldEventHappen(0.1)) {
            if (this.shouldEventHappen(CrazyState.SCARY_SUBSTATE_CHANGE)) {
                this.actionManager.stopSound();
                this.currentState = CrazySubstate.Eating;
                this.timerTrigger.set("c_eating", CrazyState.SCARY_SUBSTATE_TIME);
            }
            else if (this.shouldEventHappen(CrazyState.SCARY_SUBSTATE_CHANGE)) {
                this.actionManager.stopSound();
                this.currentState = CrazySubstate.HideAndScare;
                this.timerTrigger.set("c_hide_and_scare", CrazyState.SCARY_SUBSTATE_TIME);
            }
            else if (this.shouldEventHappen(CrazyState.SCARY_SUBSTATE_CHANGE)) {
                this.actionManager.stopSound();
                this.currentState = CrazySubstate.KnockingOnScreen;
                this.timerTrigger.set("c_knocking_on_screen", CrazyState.SCARY_SUBSTATE_TIME);
            }
            else if (this.shouldEventHappen(CrazyState.SCARY_SUBSTATE_CHANGE)) {
                this.actionManager.stopSound();
                this.currentState = CrazySubstate.PlayingWithEyeBall;
                this.timerTrigger.set("c_playing_with_ball", CrazyState.SCARY_SUBSTATE_TIME);
            }
            else if (this.shouldEventHappen(CrazyState.SCARY_SUBSTATE_CHANGE)) {
                this.actionManager.stopSound();
                this.currentState = CrazySubstate.RunningRandomally;
                this.timerTrigger.set("c_running_randomally", CrazyState.SCARY_SUBSTATE_TIME);
            }
            else if (this.shouldEventHappen(CrazyState.SCARY_SUBSTATE_CHANGE)) {
                this.actionManager.stopSound();
                this.currentState = CrazySubstate.SharpingKnife;
                this.timerTrigger.set("c_sharping_knife", CrazyState.SCARY_SUBSTATE_TIME);
            }
            else {
                this.actionManager.stopSound();
                this.currentState = CrazySubstate.Drinking;
                this.timerTrigger.set("c_drinking", CrazyState.SCARY_SUBSTATE_TIME);
            }
        }
        else {
            this.drawAndPlayRandomResourceByCategory("c_normal");
        }
    };
    CrazyState.prototype.eatingTick = function (time) {
        if (!this.shouldContinueSubstate("c_eating"))
            return;
        this.drawAndPlayRandomResourceByCategory("c_eating");
    };
    CrazyState.prototype.hideAndScareTick = function (time) {
        if (!this.shouldContinueSubstate("c_hide_and_scare"))
            return;
        this.drawAndPlayRandomResourceByCategory("c_hide_and_scare");
    };
    CrazyState.prototype.knockingOnScreenTick = function (time) {
        if (!this.shouldContinueSubstate("c_knocking_on_screen"))
            return;
        this.drawAndPlayRandomResourceByCategory("c_knocking_on_screen");
    };
    CrazyState.prototype.drinkingTick = function (time) {
        if (!this.shouldContinueSubstate("c_drinking"))
            return;
        this.drawAndPlayRandomResourceByCategory("c_drinking");
    };
    CrazyState.prototype.runningRandomallyTick = function (time) {
        if (!this.shouldContinueSubstate("c_running_randomally"))
            return;
        var category = "c_" + this.walkRandomally();
        this.drawAndPlayRandomResourceByCategory(category);
    };
    CrazyState.prototype.sharpingKnifeTick = function (time) {
        if (!this.shouldContinueSubstate("c_sharping_knife"))
            return;
        this.drawAndPlayRandomResourceByCategory("c_sharping_knife");
    };
    CrazyState.prototype.playingWithEyeBallTick = function (time) {
        if (!this.shouldContinueSubstate("c_playing_with_ball"))
            return;
        this.drawAndPlayRandomResourceByCategory("c_playing_with_ball");
    };
    CrazyState.prototype.shouldContinueSubstate = function (substateName) {
        if (!this.timerTrigger.isOnGoing(substateName)) {
            this.actionManager.stopSound();
            this.currentState = CrazySubstate.Normal;
            return false;
        }
        return true;
    };
    CrazyState.prototype.maybeDecreaseCrazy = function (time) {
        if (time - this.lastMoodChangeTime > 1200000) {
            this.lastMoodChangeTime = time;
            this.moodLevel -= 1;
            this.updateMood();
        }
    };
    CrazyState.prototype.onBackgroundTick = function (time) {
        this.onTick(time);
    };
    CrazyState.prototype.onStart = function (handler) {
        _super.prototype.onStart.call(this, handler);
    };
    CrazyState.prototype.onPhoneEventOccurred = function (eventName) {
        this.drawAndPlayRandomResourceByCategory(eventName);
    };
    CrazyState.prototype.onMove = function (oldX, oldY, newX, newY) {
    };
    CrazyState.prototype.onRelease = function (currentX, currentY) {
        var screenHeight = this.configurationManager.getScreenHeight();
        if (currentY < screenHeight - 50)
            this.actionManager.move(0, screenHeight, 0);
    };
    CrazyState.prototype.onPick = function (currentX, currentY) {
    };
    CrazyState.prototype.onMenuItemSelected = function (itemName) {
    };
    CrazyState.prototype.onResponseReceived = function (response) {
    };
    CrazyState.prototype.onLocationReceived = function (location) {
    };
    CrazyState.prototype.onUserActivityStateReceived = function (state) {
    };
    CrazyState.prototype.onHeadphoneStateReceived = function (state) {
    };
    CrazyState.prototype.onWeatherReceived = function (weather) {
    };
    CrazyState.prototype.onConfigureMenuItems = function (menuBuilder) { };
    CrazyState.prototype.onSpeechRecognitionResults = function (results) { };
    CrazyState.prototype.onPlacesReceived = function (places) { };
    return CrazyState;
}(bunBUNState));
//# sourceMappingURL=bunBUNState.js.map