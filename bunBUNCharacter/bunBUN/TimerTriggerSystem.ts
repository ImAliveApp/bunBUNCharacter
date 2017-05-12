class TimerTriggerSystem {

    private dict: collections.Dictionary<string, number>;

    private currentTime:()=>number;
    constructor(currentTimeCallback: () => number) {
        this.currentTime = currentTimeCallback;
        this.dict = new collections.Dictionary<string, number>();
    }

    set(timerName: string, length: number): void {
        this.dict.setValue(timerName, this.currentTime() + length);
    }

    isOnGoing(timerName: string): boolean {
        if (!this.dict.containsKey(timerName))
        {
            return false;
        }

        return this.currentTime() < this.dict.getValue(timerName);
    }
}