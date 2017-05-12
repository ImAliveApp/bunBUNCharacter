var TimerTriggerSystem = (function () {
    function TimerTriggerSystem(currentTimeCallback) {
        this.currentTime = currentTimeCallback;
        this.dict = new collections.Dictionary();
    }
    TimerTriggerSystem.prototype.set = function (timerName, length) {
        this.dict.setValue(timerName, this.currentTime() + length);
    };
    TimerTriggerSystem.prototype.isOnGoing = function (timerName) {
        if (!this.dict.containsKey(timerName)) {
            return false;
        }
        return this.currentTime() < this.dict.getValue(timerName);
    };
    return TimerTriggerSystem;
}());
//# sourceMappingURL=TimerTriggerSystem.js.map