class Deferred {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.reject = reject;
      this.resolve = resolve;
    });
  }
}

/**
 * The class provides a mechanism to support post and/or receive messages from different windows
 * The object of this class can be instantiated to do post+receive OR post-only OR receive-only
 * One object can post to single target window ONLY
 */
class PostReceive {
  /**
   * @param {Object} param0 An object with the following properties:
   * 1. sender: String id of the sender, must be unique among the mutually communicating windows
   * 2. targetWindow: target window object to which post messages need to be sent
   * 3. targetOrigin: String target origin
   * 4. eventValidator: callback function(event) to validate the received message event origin
   * 5. receivedMessageCallback: callback function(data, event) to handle the received messages
   */
  constructor({ sender, targetWindow, targetOrigin, eventValidator, receivedMessageCallback } = {}) {
    let errors = [];
    if (sender && "string" !== typeof sender) {
      errors.push("sender");
    }
    if (errors.length) {
      throw `Invalid: ${errors.join()}`;
    }
    this.sender = sender || "" + Date.now();
    this.setTargetWindow(targetWindow);
    this.targetOrigin = targetOrigin || "*";
    this.eventValidator = eventValidator;
    this.receivedMessageCallback = receivedMessageCallback;
    this.messageId = 0;
    this.messages = {};
    this.addListener();
  }

  destroy() {
    this.removeListeners();
  }

  setTargetWindow(targetWindow) {
    if (targetWindow && "function" === typeof targetWindow.postMessage) {
      this.targetWindow = targetWindow;
    }
  }

  sendHandshakeMessage() {
    return this.sendMessage({
      data: {
        type: "handshake",
        handshake: true
      }
    });
  }

  /**
   * The function should be called with the data (to be sent to the target window)
   * @param {Object} param0 an object with the "data" that needs to be sent to the target window
   * @returns if the data is valid:
   *      a promise, that will be resolved with the response data as received from the other window
   * else a rejected promise with a reason inside an object.
   */
  sendMessage({ data } = {}) {
    let promise;
    if (data) {
      const messageObject = this.createMessageObject(data);
      this.addMessageObject(messageObject);
      this.postMessageObject(this.targetWindow, messageObject, this.targetOrigin);
      promise = messageObject.deferred.promise;
    } else {
      promise = Promise.reject({ reason: "data is invalid" });
    }
    return promise;
  }

  eventHandler(event) {
    const { data } = event;
    let receivedObj;
    const isValidMessage =
      this.isEventValid(event) &&
      (receivedObj = this.parseDataAsObject(data)) &&
      this.isReceivedMessageObjectValid(receivedObj);
    if (isValidMessage) {
      console.debug(event);
      this.handleReceivedMessageObject(receivedObj, event);
    }
  }

  addListener() {
    window.addEventListener("message", event => {
      this.eventHandler(event);
    });
  }

  removeListeners() {
    window.removeEventListener("message", event => {
      this.eventHandler(event);
    });
  }

  updateResponseInMessageObject(obj, data) {
    obj.response = {
      data
    };
    return obj;
  }

  handleReceivedMessageObject(receivedObj, event) {
    const { origin, data, source } = event;
    if (receivedObj.sender === this.sender) {
      const savedMessageObject = this.getMessageObject(receivedObj);
      savedMessageObject.deferred.resolve(receivedObj.response.data);
      this.deleteMessageObject(receivedObj);
    } else if ("function" === typeof this.receivedMessageCallback) {
      const returnValue = this.receivedMessageCallback(receivedObj.request.data, event);
      const retValHandler = retVal => {
        const messageObject = this.updateResponseInMessageObject(receivedObj, retVal);
        this.postMessageObject(source, messageObject, origin);
      };
      Promise.resolve(returnValue).then(retValHandler, retValHandler);
    }
  }

  isEventValid(event) {
    return "function" === typeof this.eventValidator ? this.eventValidator(event) : true;
  }

  parseDataAsObject(data) {
    let obj = null;
    try {
      obj = JSON.parse(data);
    } catch (error) {
      console.error("Error parsing received data as message object");
    }
    return obj;
  }

  isReceivedMessageObjectValid(obj) {
    let isValid =
      obj &&
      obj.messageId &&
      obj.sender &&
      obj.request &&
      (obj.sender !== this.sender || (this.getMessageObject(obj) && obj.response));
    return !!isValid;
  }

  postMessageObject(targetWindow, messageObject, targetOrigin) {
    targetWindow && targetWindow.postMessage(JSON.stringify(messageObject), targetOrigin);
  }

  createMessageObject(data) {
    return {
      sender: this.sender,
      messageId: this.getNextMessageId(),
      deferred: new Deferred(),
      request: {
        data
      }
    };
  }

  getSenderMessages(obj) {
    return (this.messages[obj.sender] = this.messages[obj.sender] || {});
  }

  addMessageObject(obj) {
    this.getSenderMessages(obj)[obj.messageId] = obj;
    return obj;
  }

  getMessageObject(obj) {
    return this.getSenderMessages(obj)[obj.messageId];
  }

  deleteMessageObject(obj) {
    delete this.getSenderMessages(obj)[obj.messageId];
    return true;
  }

  getNextMessageId() {
    return ++this.messageId;
  }
}

export { PostReceive, Deferred };
