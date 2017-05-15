## Pirate Character:

### Main concept:
This is the actual code of the bunBUN character in the app, this character responds to phone actions (events), displaying and using [character menu](https://github.com/ImAliveApp/ImAliveGuide/wiki/The-Character-Menu) for a good user interaction and it has an implementation of a mood-state machine (the character will behave differently depending on various of variables)

### How to use:
In order to use this template, do the following steps:

1. Download and build it this project ([guide](https://github.com/hay12396/ImAliveGuide/wiki/How-to:-Build-and-upload-a-character-code))

2. Upload your assets ([guide](https://youtu.be/UJ3AGZs-1-Y))

3. Publish your character and see the results! ([guide](https://github.com/hay12396/ImAliveGuide/wiki/How-to:-Publish-your-character))

### The code:
Most of the action responds work is done in the "onPhoneEventOccurred" method:
```javascript
    onPhoneEventOccurred(eventName: string, jsonedData: string): void {
        this.handler.getActionManager().showMessage(eventName);
        this.states.getValue(this.currentState).onActionReceived(eventName);
    }
```
The character menu work is done in the "onMenuItemSelected" method:
```javascript
    onMenuItemSelected(viewName: string): void {
        if (this.handler.getSpeechToTextManager().isSpeechRecognitionAvailable() && viewName == "button") {
            this.handler.getSpeechToTextManager().startSpeechRecognition();
        }

        if (viewName == "button2") {
            this.handler.getAwarenessManager().getPlaces();
            let random = Math.random() * 100;
            this.handler.getMenuManager().setProperty("progress", "Progress", random.toString());
        }

        this.states.getValue(this.currentState).onMenuItemSelected(viewName);
    }
```
The mood-state machine is implemented at the [bunBUN state](https://github.com/ImAliveApp/bunBUNCharacter/blob/master/bunBUNCharacter/bunBUN/bunBUNState/bunBUNState.ts) file.

Once an action occures, this method gets called with the actionName being the name of the action that occured, i.e in case
of the device being plugged to a power supply, this method will be called with the actionName being "POWER_CONNECTED".

If you have upload resources to the website under the "POWER_CONNECTED" category, a random image and a random sound will be picked and used
by the "drawAndPlayRandomResourceByCategory" method.

**Note**: you must [register](https://youtu.be/HGkpn2y04B8) to a phone action in order to be notified when it occures.
