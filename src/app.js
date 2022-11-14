import { PostReceive } from "../postReceive.js";

var alSsoWindow;
var alSsoWindowPostReceive;

const API_ORIGIN = `https://a655-2401-4900-1cb8-8269-57e1-30d1-1679-c1eb.in.ngrok.io`;

const SSO_AUTH_URL = `${API_ORIGIN}/sso/login`;
const SSO_LOGOUT_URL = `${API_ORIGIN}/sso/logout`;

export const actions = {
  openSsoWindow({ dispatch }, { mode }) {
    let ssoResolve;
    let ssoReject;
    const ssoPromise = new Promise((resolve, reject) => {
      ssoResolve = resolve;
      ssoReject = reject;
    });
    if (mode && "string" === typeof mode) {
      const CDN_ORIGIN = "https://cdn.for.redirect.com";
      const eventValidator = event => CDN_ORIGIN === event.origin;
      const receivedMessageCallback = (data, event) => {
        let retVal = { success: false };
        if (data) {
          console.debug("data received:", data);
          const { type } = data;
          switch (type) {
            case "handshake": {
              if (alSsoWindowPostReceive) {
                alSsoWindowPostReceive.setTargetWindow(event.source);
                alSsoWindow = event.source;
              }
              retVal.success = true;
              break;
            }
            case "auth-details": {
              retVal.success = true;
              retVal.authURL = SSO_AUTH_URL;
              break;
            }
            case "logout-details": {
              retVal.success = true;
              retVal.logoutURL = SSO_LOGOUT_URL;
              break;
            }
            case "user-details": {
              ssoResolve(data.userDetails);
              retVal.success = true;
              break;
            }
            case "logout-success": {
              ssoResolve({ loggedout: true });
              retVal.success = true;
              break;
            }
            case "error": {
              let message = "Error in Login/Logout through Single Sign-On. Try reloading the window.";
              message = "string" === typeof data.message ? `${message} Reason: ${data.message}` : message;
              console.debug(message);
              ssoReject(message);
              retVal.success = true;
              break;
            }
          }
        }
        return retVal;
      };
      alSsoWindowPostReceive = new PostReceive({
        eventValidator,
        receivedMessageCallback
      });
      alSsoWindow = window.open(
        `${CDN_ORIGIN}/redirect.html?mode=${mode}`,
        "al-sso-window",
        "popup,width=500,height=500"
      );
      if (!alSsoWindow || alSsoWindow.closed || "undefined" === typeof alSsoWindow.closed) {
        //POPUP BLOCKED
        alert("Popup blocked. Please allow popup to open for this site.");
      } else {
        // focus the window or show alert to the user
        dispatch("focusSsoWindow");
      }
    } else {
      ssoReject("mode is invalid");
    }
    return ssoPromise;
  },

  focusSsoWindow() {
    let focused = false;
    if (alSsoWindow && "function" === typeof alSsoWindow.focus) {
      alSsoWindow.focus();
      focused = true;
    }
    return focused;
  },

  destroySsoWindowPostReceive() {
    let destroyed = false;
    if (alSsoWindowPostReceive && "function" === typeof alSsoWindowPostReceive.destroy) {
      alSsoWindowPostReceive.destroy();
      alSsoWindowPostReceive = null;
      destroyed = true;
    }
    return destroyed;
  },

  closeSsoWindow({ dispatch }) {
    let closed = false;
    dispatch("destroySsoWindowPostReceive");
    if (alSsoWindow && "function" === typeof alSsoWindow.close) {
      alSsoWindow.close();
      alSsoWindow = null;
      closed = true;
    }
    return closed;
  },

  ssoAuth({ dispatch }) {
    return dispatch("openSsoWindow", { mode: "check-auth" });
  },

  ssoLogout({ dispatch }) {
    return dispatch("openSsoWindow", { mode: "logout" });
  },
};
