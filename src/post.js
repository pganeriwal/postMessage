
const url = new URL(location.href);
const mode = url.searchParams.get('mode');
const targetWindow = window.opener;
const isTargetWindowValid = "function" === typeof targetWindow?.postMessage;
if (!isTargetWindowValid) {
    throw ("targetWindow is invalid");
}
const targetOrigin = "*";
const addListener = () => {
    window.addEventListener("message", (event) => {
        // TODO: check event.origin, to verify the targetOrigin matches this window's domain
        const { origin, data, source } = event;
    });
};

export class Deferred {
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        });
    }
}

export class Post {
    sender = "";
    targetWindow = null;
    targetOrigin = "";

    #messageId = 0;
    #messages = {};

    constructor({ sender, targetWindow, targetOrigin } = {}) {
        let errors = [];
        if (sender && "string" !== typeof sender) {
            errors.push("sender");
        }
        if ("function" !== typeof targetWindow?.postMessage) {
            errors.push("targetWindow");
        }
        if (errors.length) {
            throw (`Invalid: ${errors.join()}`);
        }
        this.sender = sender || "" + Date.now();
        this.targetWindow = targetWindow;
        this.targetOrigin = targetOrigin;
    }

    sendPostMessage(data) {
        const messageObject = this.#createMessage(data);
        this.#addMessageObject(messageObject);
        this.targetWindow.postMessage(JSON.stringify(messageObject), this.targetOrigin);
        return messageObject.deferred.promise;
    }

    #createMessage(data) {
        return {
            sender: this.sender,
            messageId: this.#getMessageId(),
            deferred: new Deferred(),
            request: {
                data
            }
        };
    }

    #addMessageObject(obj) {
        this.#messages[obj.messageId] = obj;
        return obj;
    }

    #getMessageId() {
        return ++this.#messageId;
    }

}