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
    protected crazyMoodLevelPenalty: number;

    protected lastHungerTime: number;
    //progress values.
    protected hungerLevel: number;
    protected crazyMoodLevel: number;

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
        this.lastHungerTime = this.configurationManager.getCurrentTime().currentTimeMillis;
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

        if (category != this.categoryOnScreen) {
            this.categoryOnScreen = category;
            let resToDraw = this.resourceManagerHelper.chooseRandomImage(category);
            this.actionManager.draw(resToDraw, this.configurationManager.getMaximalResizeRatio(), false);
        }

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
            this.crazyMoodLevel = Number(moodLevel);
        }
        else {
            this.crazyMoodLevel = 0;
        }

        let hungerLevel = this.databaseManager.getObject("hungerLevel");
        if (hungerLevel != null) {
            this.hungerLevel = Number(hungerLevel);
        }
        else {
            this.hungerLevel = 0;
        }

        let foodCount = this.databaseManager.getObject("foodCount");
        if (foodCount != null) {
            this.foodCount = Number(foodCount);
        }
        else {
            this.foodCount = 5;
        }

        let inCrazyForm = this.databaseManager.getObject("inCrazyForm");
        if (inCrazyForm != null) {
            this.inCrazyForm = inCrazyForm == "true" ? true : false;
            if (this.inCrazyForm)
                this.switchContext.switchTo(bunBUNState.CRAZY);
        }
        else {
            this.inCrazyForm = false;
        }

        let moodLevelPenalty = this.databaseManager.getObject("moodLevelPenalty");
        if (moodLevelPenalty != null) {
            this.crazyMoodLevelPenalty = Number(moodLevelPenalty);
        }
        else {
            this.crazyMoodLevelPenalty = 0;
        }

        this.updateFoodCount();
        this.updateHunger(true);
    }

    /**
     * This method handles feed logic.
     */
    feed(): boolean {
        if (this.playingMiniGame) return;
        if (this.foodCount <= 0) {
            this.actionManager.showSystemMessage("You don't have enough food, to obtain more food you must play and win bunBUN.");
            return false;
        }

        this.foodCount = this.foodCount - 1;
        this.updateFoodCount();

        this.hungerLevel -= 20;

        this.updateHunger(false);

        return true;
    }

    /**
     * This method saves the food count locally.
     */
    updateFoodCount(): void {
        if (this.foodCount == null || this.foodCount < 0) this.foodCount = 0;

        this.menuManager.setProperty("foodCount", "text", this.foodCount.toString() + " carrots left");
        this.databaseManager.saveObject("foodCount", this.foodCount.toString());
    }

    /**
     * This method saves bunBUN hunger locally and updates hunger progress.
     */
    updateHunger(syncStep: boolean): void {
        if (this.hungerLevel > 100) this.hungerLevel = 100;
        if (this.hungerLevel < 0) this.hungerLevel = 0;

        this.menuManager.setProperty("hungerProgress", "progress", this.hungerLevel.toString());
        this.databaseManager.saveObject("hungerLevel", this.hungerLevel.toString());

        if (this.hungerLevel < 20) {
            this.menuManager.setProperty("hungerProgress", "frontcolor", "#00ff00");
            if (!syncStep)
                this.crazyMoodLevel -= 2;
        }
        else if (this.hungerLevel < 40) {
            this.menuManager.setProperty("hungerProgress", "frontcolor", "#3bc293");
        }
        else if (this.hungerLevel < 60) {
            this.menuManager.setProperty("hungerProgress", "frontcolor", "#ffde56");
            if (!syncStep)
                this.crazyMoodLevel -= 1;
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
        if (this.crazyMoodLevel < this.crazyMoodLevelPenalty)
            this.crazyMoodLevel = this.crazyMoodLevelPenalty;

        if (this.crazyMoodLevel >= 100 && !this.inCrazyForm) {
            this.crazyMoodLevel = 100;
            this.crazyMoodLevelPenalty = 0;
            this.inCrazyForm = true;
            this.actionManager.showMessage("Turning to crazy", "#000000", "#ffffff", 5000);
            this.databaseManager.saveObject("inCrazyForm", "true");
            this.switchContext.switchTo(bunBUNState.CRAZY);
            this.drawAndPlayRandomResourceByCategory("turning_to_crazy");
            this.noDrawTimer = this.currentTime + 10000;
        }
        else if (this.crazyMoodLevel <= 0 && this.inCrazyForm) {
            this.crazyMoodLevel = 0;
            this.crazyMoodLevelPenalty = 0;
            this.inCrazyForm = false;
            this.actionManager.showMessage("Turning to normal", "#000000", "#ffffff", 5000);
            this.databaseManager.saveObject("inCrazyForm", "false");
            this.switchContext.switchTo(bunBUNState.PASSIVE);
            this.drawAndPlayRandomResourceByCategory("turning_to_normal");
            this.noDrawTimer = this.currentTime + 10000;
        }

        this.databaseManager.saveObject("moodLevel", this.crazyMoodLevel.toString());
        this.databaseManager.saveObject("moodLevelPenalty", this.crazyMoodLevelPenalty.toString());

        this.menuManager.setProperty("moodProgress", "progress", this.crazyMoodLevel.toString());
    }
}

enum PassiveSubstate {
    LookingAround,
    Eating,
    Drinking,
    Playing,
    DoingSomethingStupid,
    AskingForInteraction,
    Mad,
    Happy,
    Crying,
    WalkingAround,
    Fun
}
class PassiveState extends bunBUNState {
    static get LOOKING_AROUND_CHANGE(): number { return 0.1; };
    static get CHANCE_SWITCH_TO_FUN(): number { return 0.2; };
    static get CHANGE_PASSIVE_STATE(): number { return 0.16; };
    static get CHANGE_TO_SLEEP(): number { return 0.05; };
    static get CHANGE_TO_NAP(): number { return 0.1; };
    static get NAP_TIME(): number { return 600000; }; //10 minutes
    static get SLEEP_TIME(): number { return 18000000; };//5 hours
    static get EATING_TIME(): number { return 10000; };
    static get PLAYING_TIME(): number { return 20000; };
    static get HAVING_FUN_TIME(): number { return 20000; };
    static get BEING_HAPPY_TIME(): number { return 10000; };
    static get ASKING_FOR_INTERACTION_TIME(): number { return 15000; };
    static get HUNGER_TIME(): number { return 30000; };

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

    private stateInitialized: boolean;

    constructor(switchContext: IStateSwitchable) {
        super(switchContext);
        this.playingMiniGame = false;
    }

    initializeState(): void {

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
        this.crazyMoodLevel = 0;
        this.currentState = PassiveSubstate.LookingAround;
        this.stateInitialized = false;

        this.playerWinMessages = ["You are very good at this game :) \nwe got another carrot :D", "Hm, i need more training xD \nwe got another carrot :D",
            "how did you win?!? \nwe got another carrot :D", "Yay! nice job! \nwe got another carrot :D",
            "Sweet! i knew you were training :D \nwe got another carrot :D"];

        this.playerLoseMessages = ["Num, that was easy! :P", "Nana Banana", "Nice round, but i still won :D",
            "Hahaha, maybe next time!", "I'm much better than you! :P"];

        this.cryingMessages = ["Why don't you play with me? :(", "I'm bored :(", "Pay attention to me please :'(",
            "You don't love me anymore! :( :(", "I thought we were friends! :'("];
    }

    onTick(time: number): void {
        if (!this.stateInitialized) {
            this.syncState();
            this.maybeWokeUp();
            this.stateInitialized = true;
        }

        this.currentTime = time;

        if (this.playingMiniGame) {
            this.miniGame.onTick(time);
            return;
        }

        this.maybeAskForInteraction(time);

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

            case PassiveSubstate.Playing:
                this.playingTick(time);
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

    maybeAskForInteraction(time: number): void {
        //User hasn't interacted with the character for 10 minutes was 600000
        if (time - this.lastInteractionTime > 10000 && this.currentState != PassiveSubstate.Mad
            && this.currentState != PassiveSubstate.AskingForInteraction) {

            this.actionManager.stopSound();
            this.askingForInteractionStartTime = time;
            this.currentState = PassiveSubstate.AskingForInteraction;
            return;
        }
    }

    lookingAroundTick(time: number): void {
        this.actionManager.stopSound();

        if (this.shouldEventHappen(PassiveState.LOOKING_AROUND_CHANGE)) {
            if (this.shouldEventHappen(PassiveState.CHANGE_PASSIVE_STATE)) {
                this.actionManager.stopSound();
                this.currentState = PassiveSubstate.Playing;
                this.timerTrigger.set("n_playing", PassiveState.PLAYING_TIME);
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
                this.currentState = PassiveSubstate.WalkingAround;
                this.timerTrigger.set("n_walkingAround", bunBUNState.WALK_TIME);
            }
        }
        else {
            this.maybeGetHunger();
            this.drawAndPlayRandomResourceByCategory("n_normal");
        }
    }

    maybeGetHunger(): void {
        if (this.currentTime - this.lastHungerTime > PassiveState.HUNGER_TIME) {
            this.lastHungerTime = this.currentTime;
            this.hungerLevel += 1;
            this.updateHunger(false);
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

    playingTick(time: number): void {
        if (!this.shouldContinueSubstate("n_playing")) return;
        this.drawAndPlayRandomResourceByCategory("n_playing");
    }

    askingForInteractionTick(time: number): void {
        if (time - this.askingForInteractionStartTime > 10000) {//was 60000
            this.actionManager.stopSound();
            let messageIndex = Math.floor(Math.random() * 4);
            this.actionManager.showMessage(this.cryingMessages[messageIndex], "#91CA63", "#ffffff", 5000);
            this.currentState = PassiveSubstate.Mad;
            this.lastMoodChangeTime = time;
            return;
        }
        this.drawAndPlayRandomResourceByCategory("n_askingForInteraction");
    }

    happyTick(time): void {
        if (!this.shouldContinueSubstate("n_happy")) return;
        if (time - this.lastMoodChangeTime > 5000) {
            this.crazyMoodLevel -= 1;
            this.updateMood();
            this.lastMoodChangeTime = time;
        }
        this.drawAndPlayRandomResourceByCategory("n_happy");
    }

    madTick(time: number): void {
        if (time - this.lastMoodChangeTime > 10000) {
            this.crazyMoodLevel += 1;
            this.crazyMoodLevelPenalty += 1;
            this.updateMood();
            this.lastMoodChangeTime = time;
        }
        this.drawAndPlayRandomResourceByCategory("n_mad");
    }

    doingSomethingStupidTick(time: number): void {
        if (!this.shouldContinueSubstate("n_askingForInteraction")) return;
        this.drawAndPlayRandomResourceByCategory("n_askingForInteraction");
    }

    walkingAroundTick(time: number): void {
        if (!this.shouldContinueSubstate("n_walkingAround")) return;
        let category = "n_" + this.walkRandomally();
        if (this.categoryOnScreen == category) return;
        this.drawAndPlayRandomResourceByCategory(category);
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
                if (!this.feed()) return;
                if (this.shouldEventHappen(0.5)) {
                    this.currentState = PassiveSubstate.Eating;
                    this.timerTrigger.set("n_eating", PassiveState.EATING_TIME);
                }
                else {
                    this.currentState = PassiveSubstate.Drinking;
                    this.timerTrigger.set("n_drinking", PassiveState.EATING_TIME);
                }

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

        let notPlayingGameChance = this.currentState == PassiveSubstate.Mad ? 0.05 : 0.4;
        if (this.shouldEventHappen(notPlayingGameChance)) {
            this.actionManager.showMessage("I don't want to play right now.." + notPlayingGameChance.toString(), "#4C4D4F", "#ffffff", 2000);
            this.noPlayPenaltyTime = currentTime + 10000;
            return;
        }

        this.crazyMoodLevel -= 10;
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
            this.currentState = PassiveSubstate.Happy;
            this.actionManager.showMessage(this.playerWinMessages[messageIndex], "#91CA63", "#ffffff", 5000);
        }
        else {
            this.currentState = PassiveSubstate.Fun;
            this.actionManager.showMessage(this.playerLoseMessages[messageIndex], "#EC2027", "#ffffff", 5000);
        }

        this.menuManager.setProperty("playButton", "Text", "Let's play!");
        this.menuManager.setProperty("hungerLabel", "text", "Hunger:");
        this.menuManager.setProperty("hungerProgress", "progress", this.crazyMoodLevel.toString());
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
    private stateInitialized: boolean;
    constructor(switchContext: IStateSwitchable) {
        super(switchContext);
    }

    initializeState(): void {

    }

    onStart(handler: IManagersHandler): void {
        super.onStart(handler);
        this.stateInitialized = false;
        this.currentState = SleepingSubstate.Normal;
    }

    onTick(time: number): void {
        this.currentTime = time;

        if (!this.stateInitialized) {
            this.syncState();
            this.stateInitialized = true;
            this.currentState = SleepingSubstate.Normal;
        }

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
            this.drawAndPlayRandomResourceByCategory("n_sleeping_normal");
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

        this.drawAndPlayRandomResourceByCategory("n_sleeping_nap");
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
        this.crazyMoodLevel += 5;
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
    PlayingWithHead,
    RunningRandomally,
    Eating,
    EatingSelf,
    KnockingOnScreen,
    HideAndScare,
    Drinking,
    Screaming,
    Laughing
}
class CrazyState extends bunBUNState {
    static get SCARY_SUBSTATE_TIME(): number { return 10000; };
    static get SCARY_EATING_TIME(): number { return 20000;};
    static get SCARY_SUBSTATE_CHANGE(): number { return 0.11; };

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

            case CrazySubstate.EatingSelf:
                this.eatingSelfTick(time);
                break;

            case CrazySubstate.HideAndScare:
                this.hideAndScareTick(time);
                break;

            case CrazySubstate.KnockingOnScreen:
                this.knockingOnScreenTick(time);
                break;

            case CrazySubstate.PlayingWithHead:
                this.playingWithHeadTick(time);
                break;

            case CrazySubstate.RunningRandomally:
                this.runningRandomallyTick(time);
                break;

            case CrazySubstate.SharpingKnife:
                this.sharpingKnifeTick(time);
                break;

            case CrazySubstate.Laughing:
                this.laughingTick(time);
                break;

            case CrazySubstate.Screaming:
                this.screamingTick(time);
                break;

            case CrazySubstate.Drinking:
                this.drinkingTick(time);
                break;
        }
    }

    normalTick(time: number): void {
        if (this.shouldEventHappen(0.3)) {
            if (this.shouldEventHappen(CrazyState.SCARY_SUBSTATE_CHANGE)) {
                this.actionManager.stopSound();
                this.currentState = CrazySubstate.Eating;
                this.timerTrigger.set("c_eating", CrazyState.SCARY_EATING_TIME);
            }
            else if (this.shouldEventHappen(CrazyState.SCARY_SUBSTATE_CHANGE)) {
                this.actionManager.stopSound();
                this.currentState = CrazySubstate.EatingSelf;
                this.timerTrigger.set("c_eating_self", CrazyState.SCARY_SUBSTATE_TIME);
            }
            else if (this.shouldEventHappen(CrazyState.SCARY_SUBSTATE_CHANGE)) {
                this.actionManager.stopSound();
                this.currentState = CrazySubstate.Screaming;
                this.timerTrigger.set("c_screaming", CrazyState.SCARY_SUBSTATE_TIME);
            }
            else if (this.shouldEventHappen(CrazyState.SCARY_SUBSTATE_CHANGE)) {
                this.actionManager.stopSound();
                this.currentState = CrazySubstate.KnockingOnScreen;
                this.timerTrigger.set("c_knock_on_screen", CrazyState.SCARY_SUBSTATE_TIME);
            }
            else if (this.shouldEventHappen(CrazyState.SCARY_SUBSTATE_CHANGE)) {
                this.actionManager.stopSound();
                this.currentState = CrazySubstate.PlayingWithHead;
                this.timerTrigger.set("c_playing_with_head", CrazyState.SCARY_SUBSTATE_TIME);
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
            else if (this.shouldEventHappen(CrazyState.SCARY_SUBSTATE_CHANGE)) {
                this.actionManager.stopSound();
                this.currentState = CrazySubstate.Laughing;
                this.timerTrigger.set("c_laughing", CrazyState.SCARY_SUBSTATE_TIME);
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

    eatingSelfTick(time: number): void {
        if (!this.shouldContinueSubstate("c_eating_self")) return;
        this.drawAndPlayRandomResourceByCategory("c_eating_self");
    }

    hideAndScareTick(time: number): void {
        if (!this.shouldContinueSubstate("c_hide_and_scare")) return;
        this.drawAndPlayRandomResourceByCategory("c_hide_and_scare");
    }

    knockingOnScreenTick(time: number): void {
        if (!this.shouldContinueSubstate("c_knock_on_screen")) return;
        this.drawAndPlayRandomResourceByCategory("c_knock_on_screen");
    }

    drinkingTick(time: number): void {
        if (!this.shouldContinueSubstate("c_drinking")) return;
        this.drawAndPlayRandomResourceByCategory("c_drinking");
    }

    runningRandomallyTick(time: number): void {
        if (!this.shouldContinueSubstate("c_running_randomally")) return;
        let category = "c_" + this.walkRandomally();

        if (this.categoryOnScreen == category) return;
        this.drawAndPlayRandomResourceByCategory(category);
    }

    sharpingKnifeTick(time: number): void {
        if (!this.shouldContinueSubstate("c_sharping_knife")) return;
        this.drawAndPlayRandomResourceByCategory("c_sharping_knife");
    }

    playingWithHeadTick(time: number): void {
        if (!this.shouldContinueSubstate("c_playing_with_head")) return;
        this.drawAndPlayRandomResourceByCategory("c_playing_with_head");
    }

    laughingTick(time: number): void {
        if (!this.shouldContinueSubstate("c_laughing")) return;
        this.drawAndPlayRandomResourceByCategory("c_laughing");
    }

    screamingTick(time: number): void {
        if (!this.shouldContinueSubstate("c_screaming")) return;
        this.drawAndPlayRandomResourceByCategory("c_screaming");
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
        if (time - this.lastMoodChangeTime > 10000)//decrease by 1 every 10 seconds
        {
            this.lastMoodChangeTime = time;
            this.crazyMoodLevel -= 1;
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