abstract class bunBUNState implements IAliveAgent {
    static get WALK_TIME(): number { return 1000; };
    static get SLEEPING(): string { return "sleeping"; };
    static get PASSIVE(): string { return "passive"; };
    static get ACTIVE(): string { return "active"; };
    static get CRAZY(): string { return "crazy"; };

    //Managers:
    protected configurationManager: IConfigurationManager;
    protected characterManager: ICharacterManager;
    protected resourceManager: IResourceManager;
    protected managersHandler: IManagersHandler;
    protected databaseManager: IDatabaseManager;
    protected actionManager: IActionManager;
    protected menuManager: IMenuManager;

    protected currentTime: number;

    protected timerTrigger: TimerTriggerSystem;
    protected categoryOnScreen: string;
    protected currentCategoryPlaying: string;
    protected walking: boolean;
    protected playingMiniGame: boolean;

    protected inCrazyForm: boolean;

    //used to disable drawing to allow bunBUN to change states (crazy->normal or normal->crazy).
    protected noDrawTimer: number;

    //the current minimum level of the mood level;
    protected moodLevelPenalty: number;
    //progress values.
    protected hungerLevel: number;
    protected moodLevel: number;

    protected foodCount: number;

    //indicates when was the last time that the user interacted with bunBUN.
    protected lastInteractionTime: number;

    protected resourceManagerHelper: ResourceManagerHelper;

    protected switchContext: IStateSwitchable;

    constructor(switchContext: IStateSwitchable) {
        this.switchContext = switchContext;
    }

    abstract onTick(time: number): void;

    abstract onBackgroundTick(time: number): void;

    onStart(handler: IManagersHandler): void {
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
        this.timerTrigger = new TimerTriggerSystem(() => this.configurationManager.getCurrentTime().currentTimeMillis);
    }

    abstract onSpeechRecognitionResults(results: string): void;

    abstract onPhoneEventOccurred(eventName: string): void;

    abstract onMove(oldX: number, oldY: number, newX: number, newY: number): void;

    abstract onRelease(currentX: number, currentY: number): void;

    abstract onPick(currentX: number, currentY: number): void;

    abstract onMenuItemSelected(itemName: string): void;

    abstract onResponseReceived(response: string): void;

    abstract onLocationReceived(location: IAliveLocation): void;

    abstract onUserActivityStateReceived(state: IAliveUserActivity): void;

    abstract onHeadphoneStateReceived(state: number): void;

    abstract onWeatherReceived(weather: IAliveWeather): void;

    abstract onConfigureMenuItems(menuBuilder: IMenuBuilder): void;

    abstract onPlacesReceived(places: IAlivePlaceLikelihood[]): void;

    abstract initializeState(): void;

    walkRandomally(): string {
        let screenWidth = this.configurationManager.getScreenWidth();
        let currentX = this.characterManager.getCurrentCharacterXPosition();
        let distanceToMove = Math.abs(currentX - screenWidth);
        let category = AgentConstants.ON_FALLING_RIGHT;
        this.walking = true;
        if (this.shouldEventHappen(0.5) && distanceToMove > screenWidth / 4) {//walk 
            this.actionManager.move(distanceToMove / 3, 0, bunBUNState.WALK_TIME);
        }
        else {
            this.actionManager.move(-distanceToMove / 3, 0, bunBUNState.WALK_TIME);
            category = AgentConstants.ON_FALLING_LEFT;
        }

        return category;
    }

    shouldEventHappen(chance: number): boolean {
        return Math.random() < chance;
    }

    drawAndPlayRandomResourceByCategory(category: string): void {
        if (this.playingMiniGame) return;

        if (this.currentTime < this.noDrawTimer) return;

        let resToDraw = this.resourceManagerHelper.chooseRandomImage(category);
        if (resToDraw != this.categoryOnScreen)
            this.actionManager.draw(resToDraw, this.configurationManager.getMaximalResizeRatio(), false);

        this.categoryOnScreen = category;

        let soundToPlay = this.resourceManagerHelper.chooseRandomSound(category);
        if (!this.configurationManager.isSoundPlaying())
            this.actionManager.playSound(soundToPlay, false);
    }

    /**
     * This method sync bunBUN state.
     */
    syncState(): void {
        let moodLevel = this.databaseManager.getObject("moodLevel");
        if (moodLevel != null) {
            this.moodLevel = Number(moodLevel);
        }

        let hungerLevel = this.databaseManager.getObject("hungerLevel");
        if (hungerLevel != null) {
            this.hungerLevel = Number(hungerLevel);
        }

        let foodCount = this.databaseManager.getObject("foodCount");
        if (foodCount != null) {
            this.foodCount = Number(foodCount);
        }

        let inCrazyForm = this.databaseManager.getObject("inCrazyForm");
        if (inCrazyForm != null) {
            this.inCrazyForm = inCrazyForm == "true" ? true : false;
        }

        let moodLevelPenalty = this.databaseManager.getObject("moodLevelPenalty");
        if (moodLevelPenalty != null) {
            this.moodLevelPenalty = Number(moodLevelPenalty);
        }
    }

    /**
     * This method handles feed logic.
     */
    feed(): void {
        if (this.playingMiniGame) return;
        if (this.foodCount <= 0) {
            this.actionManager.showSystemMessage("You don't have enough food, to obtain food you must play and win bunBUN.");
            return;
        }
        this.foodCount -= 1;
        this.databaseManager.saveObject("foodCount", this.foodCount.toString());
        this.hungerLevel -= 20;

        this.updateHunger();
    }

    /**
     * This method saves the food count locally.
     */
    updateFoodCount(): void {
        if (this.foodCount < 0) this.foodCount = 0;

        this.menuManager.setProperty("foodCount", "text", this.foodCount.toString() + " carrots left");
        this.databaseManager.saveObject("foodCount", this.foodCount.toString());
    }

    /**
     * This method saves bunBUN hunger locally and updates hunger progress.
     */
    updateHunger(): void {
        if (this.hungerLevel > 100) this.hungerLevel = 100;
        if (this.hungerLevel < 0) this.hungerLevel = 0;

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
    }

    /**
     * This method saves bunBUN mood locally, handle form changes and updates mood progress.
     */
    updateMood(): void {
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
    }
}

enum PassiveSubstate {
    LookingAround,
    Eating,
    Drinking,
    Reading,
    DoingSomethingStupid,
    AskingForInteraction,
    Mad,
    Happy,
    WalkingAround,
    Fun
}
class PassiveState extends bunBUNState {
    static get LOOKING_AROUND_CHANGE(): number { return 0.1; };
    static get CHANCE_SWITCH_TO_FUN(): number { return 0.2; };
    static get CHANGE_PASSIVE_STATE(): number { return 0.2; };
    static get CHANGE_TO_SLEEP(): number { return 0.05; };
    static get CHANGE_TO_NAP(): number { return 0.1; };
    static get NAP_TIME(): number { return 600000; }; //10 minutes
    static get SLEEP_TIME(): number { return 18000000; };//5 hours
    static get EATING_TIME(): number { return 10000; };
    static get READING_TIME(): number { return 20000; };
    static get HAVING_FUN_TIME(): number { return 20000; };
    static get BEING_HAPPY_TIME(): number { return 10000; };
    static get ASKING_FOR_INTERACTION_TIME(): number { return 15000; };
    static get DOING_SOMETHING_STUPID_TIME(): number { return 20000; };

    //if bunBUN is asking for interaction for more than 10 minutes, he will start to get mad.
    private askingForInteractionStartTime: number;
    private lastMoodChangeTime: number;

    private playerLoseMessages: string[];
    private playerWinMessages: string[];
    private cryingMessages: string[];

    private noPlayPenaltyTime: number;
    private lastPlayGameClick: number;
    private miniGame: MiniGame;
    private currentState: PassiveSubstate;

    constructor(switchContext: IStateSwitchable) {
        super(switchContext);
        this.playingMiniGame = false;
    }

    initializeState(): void {
        this.syncState();
        this.maybeWokeUp();
    }

    maybeWokeUp(): void {
        let wokeUp = this.databaseManager.getObject("wokeUp");
        if (wokeUp != null && wokeUp == "true") {
            this.databaseManager.saveObject("wokeUp", "false");
            this.currentState = PassiveSubstate.Mad;
        }
    }

    onStart(handler: IManagersHandler): void {
        super.onStart(handler);
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
    }

    onTick(time: number): void {
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
    }

    lookingAroundTick(time: number): void {
        this.actionManager.stopSound();

        //User hasn't interacted with the character for 10 minutes
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
    }

    eatingTick(time: number): void {
        if (!this.shouldContinueSubstate("n_eating")) return;
        this.drawAndPlayRandomResourceByCategory("n_eating");
    }

    havingFunTick(time: number): void {
        if (!this.shouldContinueSubstate("n_having_fun")) return;
        this.drawAndPlayRandomResourceByCategory("n_having_fun");
    }

    drinkingTick(time: number): void {
        if (!this.shouldContinueSubstate("n_drinking")) return;
        this.drawAndPlayRandomResourceByCategory("n_drinking");
    }

    readingTick(time: number): void {
        if (!this.shouldContinueSubstate("n_drinking")) return;
        this.drawAndPlayRandomResourceByCategory("n_reading");
    }

    askingForInteractionTick(time: number): void {
        if (time - this.askingForInteractionStartTime > 10000) {
            this.actionManager.stopSound();
            let messageIndex = Math.floor(Math.random() * 4);
            this.actionManager.showMessage(this.cryingMessages[messageIndex], "#91CA63", "#ffffff", 5000);
            this.currentState = PassiveSubstate.Mad;
            return;
        }
        this.drawAndPlayRandomResourceByCategory("n_askingForInteraction");
    }

    happyTick(time): void {
        if (!this.shouldContinueSubstate("n_happy")) return;
        if (time - this.lastMoodChangeTime > 5000) {
            this.moodLevel -= 1;
            this.updateMood();
            this.lastMoodChangeTime = time;
        }
        this.drawAndPlayRandomResourceByCategory("n_happy");
    }

    madTick(time: number): void {
        if (time - this.lastMoodChangeTime > 10000) {
            this.moodLevel += 1;
            this.moodLevelPenalty += 1;
            this.updateMood();
            this.lastMoodChangeTime = time;
        }
        this.drawAndPlayRandomResourceByCategory("n_mad");
    }

    doingSomethingStupidTick(time: number): void {
        if (!this.shouldContinueSubstate("n_doingSomethingStupid")) return;
        this.drawAndPlayRandomResourceByCategory("n_doingSomethingStupid");
    }

    walkingAroundTick(time: number): void {
        if (!this.shouldContinueSubstate("n_walkingAround")) {
            this.walking = false;
        }
    }

    shouldContinueSubstate(substateName: string): boolean {
        if (!this.timerTrigger.isOnGoing(substateName)) {
            this.actionManager.stopSound();
            this.currentState = PassiveSubstate.LookingAround;
            return false;
        }
        return true;
    }

    onBackgroundTick(time: number): void {
        this.onTick(time);
    }

    onPhoneEventOccurred(eventName: string): void {
        if (eventName == AgentConstants.NEW_OUTGOING_CALL ||
            eventName == AgentConstants.INCOMING_CALL ||
            eventName == AgentConstants.SMS_RECEIVED) {
            this.actionManager.stopSound();
            this.currentState = PassiveSubstate.Fun;
            this.timerTrigger.set("n_having_fun", PassiveState.HAVING_FUN_TIME);
        }
    }

    onMove(oldX: number, oldY: number, newX: number, newY: number): void {

    }

    onRelease(currentX: number, currentY: number): void {
        let screenHeight = this.configurationManager.getScreenHeight();

        if (currentY < screenHeight - 50)
            this.actionManager.move(0, screenHeight, 0);

        this.lastInteractionTime = this.currentTime;
        if (this.playingMiniGame) return;

        if (this.currentState == PassiveSubstate.AskingForInteraction) {
            this.actionManager.stopSound();
            this.currentState = PassiveSubstate.Happy;
            this.timerTrigger.set("n_happy", PassiveState.BEING_HAPPY_TIME);
        }
    }

    onPick(currentX: number, currentY: number): void {
        if (this.playingMiniGame) {
            this.miniGame.onEventOccured("touch");
        }
    }

    onMenuItemSelected(itemName: string): void {
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
                    let now = this.configurationManager.getCurrentTime().currentTimeMillis;
                    if (now - this.lastPlayGameClick < 2000)
                        return;

                    this.lastPlayGameClick = now;
                    this.playRandomMiniGame(now);
                }
                break;
        }
    }

    onResponseReceived(response: string): void {

    }

    onLocationReceived(location: IAliveLocation): void {

    }

    onUserActivityStateReceived(state: IAliveUserActivity) {

    }

    onHeadphoneStateReceived(state: number) {

    }

    onWeatherReceived(weather: IAliveWeather) {

    }

    onConfigureMenuItems(menuBuilder: IMenuBuilder) { }

    onSpeechRecognitionResults(results: string): void {

    }

    onPlacesReceived(places: IAlivePlaceLikelihood[]): void { }

    playRandomMiniGame(currentTime: number): void {
        if (this.playingMiniGame) return;

        if (currentTime < this.noPlayPenaltyTime) {
            this.actionManager.showMessage("I said that i don't want to play right now!!", "#4C4D4F", "#ffffff", 2000);
            this.noPlayPenaltyTime = currentTime + 10000;
            return;
        }

        let playingGameChange = this.currentState == PassiveSubstate.Mad ? 0.95 : 0.6;
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
        let randomNumber = Math.random() * 100;

        if (randomNumber <= 50) {
            this.miniGame = new CatchMiniGame(this.managersHandler, this.resourceManagerHelper,
                (playerWon: boolean) => {
                    this.miniGameOver(playerWon);
                });
        }
        else {
            this.miniGame = new ReflexMiniGame(this.managersHandler,
                (playerWon: boolean) => {
                    this.miniGameOver(playerWon);
                });
        }

        this.miniGame.onStart(this.configurationManager.getCurrentTime().currentTimeMillis);
    }

    private miniGameOver(playerWon: boolean): void {
        this.actionManager.move(-this.configurationManager.getScreenWidth(), this.configurationManager.getScreenHeight(), 20);
        this.playingMiniGame = false;

        let messageIndex = Math.floor(Math.random() * 4);

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
    }
}

enum SleepingSubstate {
    Normal,
    Nap
}
class SleepingState extends bunBUNState {
    static get SNORE_TO_NORMAL_TIME(): number { return 5000 }
    static get NORMAL_TO_SNORE_CHANCE(): number { return 0.0027 }

    private currentState: SleepingSubstate;

    constructor(switchContext: IStateSwitchable) {
        super(switchContext);
    }

    initializeState(): void {
        this.syncState();
        this.currentState = SleepingSubstate.Normal;
    }

    onStart(handler: IManagersHandler): void {
        super.onStart(handler);
        this.currentState = SleepingSubstate.Normal;
    }

    onTick(time: number): void {
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
    }

    normalTick(time: number): void {
        if (!this.configurationManager.isSoundPlaying()) {
            this.drawAndPlayRandomResourceByCategory("n_sleeping-normal");
        }

        if (this.shouldEventHappen(0.25)) {
            this.actionManager.stopSound();
            this.timerTrigger.set("n_sleep_nap", SleepingState.SNORE_TO_NORMAL_TIME);
            this.currentState = SleepingSubstate.Nap;
        }
    }

    napTick(time: number) {
        if (!this.timerTrigger.isOnGoing("n_sleep_nap")) {
            this.actionManager.stopSound();
            this.currentState = SleepingSubstate.Normal;
            return;
        }

        this.drawAndPlayRandomResourceByCategory("n_sleeping-nap");
    }

    onBackgroundTick(time: number): void {
        this.onTick(time);
    }

    onPhoneEventOccurred(eventName: string): void {
        if (eventName == AgentConstants.NEW_OUTGOING_CALL ||
            eventName == AgentConstants.INCOMING_CALL ||
            eventName == AgentConstants.SMS_RECEIVED) {
            this.maybeWakeUp();
        }
    }

    onMove(oldX: number, oldY: number, newX: number, newY: number): void {

    }

    onRelease(currentX: number, currentY: number): void {
        let screenHeight = this.configurationManager.getScreenHeight();

        if (currentY < screenHeight - 50)
            this.actionManager.move(0, screenHeight, 0);
    }

    onPick(currentX: number, currentY: number): void {
        this.maybeWakeUp();
    }

    onMenuItemSelected(itemName: string): void {
        this.actionManager.showMessage("Zzz Zzz Zzzzzzz", "#000000", "#ffffff", 2000);
        this.maybeWakeUp();
    }

    onResponseReceived(response: string): void {

    }

    onLocationReceived(location: IAliveLocation): void {

    }

    onUserActivityStateReceived(state: IAliveUserActivity) {

    }

    onHeadphoneStateReceived(state: number) {

    }

    onWeatherReceived(weather: IAliveWeather) {

    }

    onConfigureMenuItems(menuBuilder: IMenuBuilder) {

    }

    onSpeechRecognitionResults(results: string): void {

    }

    onPlacesReceived(places: IAlivePlaceLikelihood[]): void { }

    maybeWakeUp(): void {
        this.moodLevel += 5;
        this.updateMood();

        if (this.shouldEventHappen(0.3)) {
            this.actionManager.stopSound();
            this.databaseManager.saveObject("wokeUp", "true");
            this.switchContext.switchTo(bunBUNState.PASSIVE);
        }
    }
}

enum CrazySubstate {
    Normal,
    SharpingKnife,
    PlayingWithEyeBall,
    RunningRandomally,
    Eating,
    KnockingOnScreen,
    HideAndScare,
    Drinking
}
class CrazyState extends bunBUNState {
    static get SCARY_SUBSTATE_TIME(): number { return 10000; };
    static get SCARY_SUBSTATE_CHANGE(): number { return 0.14; };

    private currentState: CrazySubstate;
    private lastMoodChangeTime: number;
    constructor(switchContext: IStateSwitchable) {
        super(switchContext);
    }

    initializeState(): void {
        this.currentState = CrazySubstate.Normal;
    }

    onTick(time: number): void {
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
    }

    normalTick(time: number): void {
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
    }

    eatingTick(time: number): void {
        if (!this.shouldContinueSubstate("c_eating")) return;
        this.drawAndPlayRandomResourceByCategory("c_eating");
    }

    hideAndScareTick(time: number): void {
        if (!this.shouldContinueSubstate("c_hide_and_scare")) return;
        this.drawAndPlayRandomResourceByCategory("c_hide_and_scare");
    }

    knockingOnScreenTick(time: number): void {
        if (!this.shouldContinueSubstate("c_knocking_on_screen")) return;
        this.drawAndPlayRandomResourceByCategory("c_knocking_on_screen");
    }

    drinkingTick(time: number): void {
        if (!this.shouldContinueSubstate("c_drinking")) return;
        this.drawAndPlayRandomResourceByCategory("c_drinking");
    }

    runningRandomallyTick(time: number): void {
        if (!this.shouldContinueSubstate("c_running_randomally")) return;
        let category = "c_" + this.walkRandomally();
        this.drawAndPlayRandomResourceByCategory(category);
    }

    sharpingKnifeTick(time: number): void {
        if (!this.shouldContinueSubstate("c_sharping_knife")) return;
        this.drawAndPlayRandomResourceByCategory("c_sharping_knife");
    }

    playingWithEyeBallTick(time: number): void {
        if (!this.shouldContinueSubstate("c_playing_with_ball")) return;
        this.drawAndPlayRandomResourceByCategory("c_playing_with_ball");
    }

    shouldContinueSubstate(substateName: string): boolean {
        if (!this.timerTrigger.isOnGoing(substateName)) {
            this.actionManager.stopSound();
            this.currentState = CrazySubstate.Normal;
            return false;
        }

        return true;
    }

    maybeDecreaseCrazy(time: number): void {
        if (time - this.lastMoodChangeTime > 1200000)//12 minutes
        {
            this.lastMoodChangeTime = time;
            this.moodLevel -= 1;
            this.updateMood();
        }
    }

    onBackgroundTick(time: number) {
        this.onTick(time);
    }

    onStart(handler: IManagersHandler): void {
        super.onStart(handler);
    }

    onPhoneEventOccurred(eventName: string): void {
        this.drawAndPlayRandomResourceByCategory(eventName);
    }

    onMove(oldX: number, oldY: number, newX: number, newY: number): void {

    }

    onRelease(currentX: number, currentY: number): void {
        let screenHeight = this.configurationManager.getScreenHeight();

        if (currentY < screenHeight - 50)
            this.actionManager.move(0, screenHeight, 0);
    }

    onPick(currentX: number, currentY: number): void {
    }

    onMenuItemSelected(itemName: string): void {

    }

    onResponseReceived(response: string): void {

    }

    onLocationReceived(location: IAliveLocation): void {

    }

    onUserActivityStateReceived(state: IAliveUserActivity) {

    }

    onHeadphoneStateReceived(state: number) {

    }

    onWeatherReceived(weather: IAliveWeather) {

    }

    onConfigureMenuItems(menuBuilder: IMenuBuilder) { }

    onSpeechRecognitionResults(results: string): void { }

    onPlacesReceived(places: IAlivePlaceLikelihood[]): void { }
}