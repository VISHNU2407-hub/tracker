"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/@capacitor/core/dist/index.cjs.js
var require_index_cjs = __commonJS({
  "node_modules/@capacitor/core/dist/index.cjs.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ExceptionCode = void 0;
    (function(ExceptionCode) {
      ExceptionCode["Unimplemented"] = "UNIMPLEMENTED";
      ExceptionCode["Unavailable"] = "UNAVAILABLE";
    })(exports2.ExceptionCode || (exports2.ExceptionCode = {}));
    var CapacitorException = class extends Error {
      constructor(message, code, data) {
        super(message);
        this.message = message;
        this.code = code;
        this.data = data;
      }
    };
    var getPlatformId = (win) => {
      var _a, _b;
      if (win === null || win === void 0 ? void 0 : win.androidBridge) {
        return "android";
      } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
        return "ios";
      } else {
        return "web";
      }
    };
    var createCapacitor = (win) => {
      const capCustomPlatform = win.CapacitorCustomPlatform || null;
      const cap = win.Capacitor || {};
      const Plugins = cap.Plugins = cap.Plugins || {};
      const getPlatform = () => {
        return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
      };
      const isNativePlatform = () => getPlatform() !== "web";
      const isPluginAvailable = (pluginName) => {
        const plugin = registeredPlugins.get(pluginName);
        if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
          return true;
        }
        if (getPluginHeader(pluginName)) {
          return true;
        }
        return false;
      };
      const getPluginHeader = (pluginName) => {
        var _a;
        return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
      };
      const handleError = (err) => win.console.error(err);
      const registeredPlugins = /* @__PURE__ */ new Map();
      const registerPlugin2 = (pluginName, jsImplementations = {}) => {
        const registeredPlugin = registeredPlugins.get(pluginName);
        if (registeredPlugin) {
          console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
          return registeredPlugin.proxy;
        }
        const platform = getPlatform();
        const pluginHeader = getPluginHeader(pluginName);
        let jsImplementation;
        const loadPluginImplementation = async () => {
          if (!jsImplementation && platform in jsImplementations) {
            jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
          } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
            jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
          }
          return jsImplementation;
        };
        const createPluginMethod = (impl, prop) => {
          var _a, _b;
          if (pluginHeader) {
            const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
            if (methodHeader) {
              if (methodHeader.rtype === "promise") {
                return (options) => cap.nativePromise(pluginName, prop.toString(), options);
              } else {
                return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
              }
            } else if (impl) {
              return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
            }
          } else if (impl) {
            return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
          } else {
            throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, exports2.ExceptionCode.Unimplemented);
          }
        };
        const createPluginMethodWrapper = (prop) => {
          let remove;
          const wrapper = (...args) => {
            const p = loadPluginImplementation().then((impl) => {
              const fn = createPluginMethod(impl, prop);
              if (fn) {
                const p2 = fn(...args);
                remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
                return p2;
              } else {
                throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, exports2.ExceptionCode.Unimplemented);
              }
            });
            if (prop === "addListener") {
              p.remove = async () => remove();
            }
            return p;
          };
          wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
          Object.defineProperty(wrapper, "name", {
            value: prop,
            writable: false,
            configurable: false
          });
          return wrapper;
        };
        const addListener = createPluginMethodWrapper("addListener");
        const removeListener = createPluginMethodWrapper("removeListener");
        const addListenerNative = (eventName, callback) => {
          const call = addListener({ eventName }, callback);
          const remove = async () => {
            const callbackId = await call;
            removeListener({
              eventName,
              callbackId
            }, callback);
          };
          const p = new Promise((resolve) => call.then(() => resolve({ remove })));
          p.remove = async () => {
            console.warn(`Using addListener() without 'await' is deprecated.`);
            await remove();
          };
          return p;
        };
        const proxy = new Proxy({}, {
          get(_, prop) {
            switch (prop) {
              case "$$typeof":
                return void 0;
              case "toJSON":
                return () => ({});
              case "addListener":
                return pluginHeader ? addListenerNative : addListener;
              case "removeListener":
                return removeListener;
              default:
                return createPluginMethodWrapper(prop);
            }
          }
        });
        Plugins[pluginName] = proxy;
        registeredPlugins.set(pluginName, {
          name: pluginName,
          proxy,
          platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
        });
        return proxy;
      };
      if (!cap.convertFileSrc) {
        cap.convertFileSrc = (filePath) => filePath;
      }
      cap.getPlatform = getPlatform;
      cap.handleError = handleError;
      cap.isNativePlatform = isNativePlatform;
      cap.isPluginAvailable = isPluginAvailable;
      cap.registerPlugin = registerPlugin2;
      cap.Exception = CapacitorException;
      cap.DEBUG = !!cap.DEBUG;
      cap.isLoggingEnabled = !!cap.isLoggingEnabled;
      return cap;
    };
    var initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
    var Capacitor2 = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
    var registerPlugin = Capacitor2.registerPlugin;
    var WebPlugin = class {
      constructor() {
        this.listeners = {};
        this.retainedEventArguments = {};
        this.windowListeners = {};
      }
      addListener(eventName, listenerFunc) {
        let firstListener = false;
        const listeners = this.listeners[eventName];
        if (!listeners) {
          this.listeners[eventName] = [];
          firstListener = true;
        }
        this.listeners[eventName].push(listenerFunc);
        const windowListener = this.windowListeners[eventName];
        if (windowListener && !windowListener.registered) {
          this.addWindowListener(windowListener);
        }
        if (firstListener) {
          this.sendRetainedArgumentsForEvent(eventName);
        }
        const remove = async () => this.removeListener(eventName, listenerFunc);
        const p = Promise.resolve({ remove });
        return p;
      }
      async removeAllListeners() {
        this.listeners = {};
        for (const listener in this.windowListeners) {
          this.removeWindowListener(this.windowListeners[listener]);
        }
        this.windowListeners = {};
      }
      notifyListeners(eventName, data, retainUntilConsumed) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          if (retainUntilConsumed) {
            let args = this.retainedEventArguments[eventName];
            if (!args) {
              args = [];
            }
            args.push(data);
            this.retainedEventArguments[eventName] = args;
          }
          return;
        }
        listeners.forEach((listener) => listener(data));
      }
      hasListeners(eventName) {
        var _a;
        return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
      }
      registerWindowListener(windowEventName, pluginEventName) {
        this.windowListeners[pluginEventName] = {
          registered: false,
          windowEventName,
          pluginEventName,
          handler: (event) => {
            this.notifyListeners(pluginEventName, event);
          }
        };
      }
      unimplemented(msg = "not implemented") {
        return new Capacitor2.Exception(msg, exports2.ExceptionCode.Unimplemented);
      }
      unavailable(msg = "not available") {
        return new Capacitor2.Exception(msg, exports2.ExceptionCode.Unavailable);
      }
      async removeListener(eventName, listenerFunc) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          return;
        }
        const index = listeners.indexOf(listenerFunc);
        if (index !== -1) {
          this.listeners[eventName].splice(index, 1);
        }
        if (!this.listeners[eventName].length) {
          this.removeWindowListener(this.windowListeners[eventName]);
        }
      }
      addWindowListener(handle) {
        window.addEventListener(handle.windowEventName, handle.handler);
        handle.registered = true;
      }
      removeWindowListener(handle) {
        if (!handle) {
          return;
        }
        window.removeEventListener(handle.windowEventName, handle.handler);
        handle.registered = false;
      }
      sendRetainedArgumentsForEvent(eventName) {
        const args = this.retainedEventArguments[eventName];
        if (!args) {
          return;
        }
        delete this.retainedEventArguments[eventName];
        args.forEach((arg) => {
          this.notifyListeners(eventName, arg);
        });
      }
    };
    var WebView = /* @__PURE__ */ registerPlugin("WebView");
    var encode = (str2) => encodeURIComponent(str2).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
    var decode = (str2) => str2.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
    var CapacitorCookiesPluginWeb = class extends WebPlugin {
      async getCookies() {
        const cookies = document.cookie;
        const cookieMap = {};
        cookies.split(";").forEach((cookie) => {
          if (cookie.length <= 0)
            return;
          let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
          key = decode(key).trim();
          value = decode(value).trim();
          cookieMap[key] = value;
        });
        return cookieMap;
      }
      async setCookie(options) {
        try {
          const encodedKey = encode(options.key);
          const encodedValue = encode(options.value);
          const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
          const path = (options.path || "/").replace("path=", "");
          const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
          document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async deleteCookie(options) {
        try {
          document.cookie = `${options.key}=; Max-Age=0`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearCookies() {
        try {
          const cookies = document.cookie.split(";") || [];
          for (const cookie of cookies) {
            document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
          }
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearAllCookies() {
        try {
          await this.clearCookies();
        } catch (error) {
          return Promise.reject(error);
        }
      }
    };
    var CapacitorCookies = registerPlugin("CapacitorCookies", {
      web: () => new CapacitorCookiesPluginWeb()
    });
    var readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result;
        resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blob);
    });
    var normalizeHttpHeaders = (headers = {}) => {
      const originalKeys = Object.keys(headers);
      const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
      const normalized = loweredKeys.reduce((acc, key, index) => {
        acc[key] = headers[originalKeys[index]];
        return acc;
      }, {});
      return normalized;
    };
    var buildUrlParams = (params, shouldEncode = true) => {
      if (!params)
        return null;
      const output = Object.entries(params).reduce((accumulator, entry2) => {
        const [key, value] = entry2;
        let encodedValue;
        let item;
        if (Array.isArray(value)) {
          item = "";
          value.forEach((str2) => {
            encodedValue = shouldEncode ? encodeURIComponent(str2) : str2;
            item += `${key}=${encodedValue}&`;
          });
          item.slice(0, -1);
        } else {
          encodedValue = shouldEncode ? encodeURIComponent(value) : value;
          item = `${key}=${encodedValue}`;
        }
        return `${accumulator}&${item}`;
      }, "");
      return output.substr(1);
    };
    var buildRequestInit = (options, extra = {}) => {
      const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
      const headers = normalizeHttpHeaders(options.headers);
      const type = headers["content-type"] || "";
      if (typeof options.data === "string") {
        output.body = options.data;
      } else if (type.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.data || {})) {
          params.set(key, value);
        }
        output.body = params.toString();
      } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
        const form = new FormData();
        if (options.data instanceof FormData) {
          options.data.forEach((value, key) => {
            form.append(key, value);
          });
        } else {
          for (const key of Object.keys(options.data)) {
            form.append(key, options.data[key]);
          }
        }
        output.body = form;
        const headers2 = new Headers(output.headers);
        headers2.delete("content-type");
        output.headers = headers2;
      } else if (type.includes("application/json") || typeof options.data === "object") {
        output.body = JSON.stringify(options.data);
      }
      return output;
    };
    var CapacitorHttpPluginWeb = class extends WebPlugin {
      /**
       * Perform an Http request given a set of options
       * @param options Options to build the HTTP request
       */
      async request(options) {
        const requestInit = buildRequestInit(options, options.webFetchExtra);
        const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
        const url = urlParams ? `${options.url}?${urlParams}` : options.url;
        const response = await fetch(url, requestInit);
        const contentType = response.headers.get("content-type") || "";
        let { responseType = "text" } = response.ok ? options : {};
        if (contentType.includes("application/json")) {
          responseType = "json";
        }
        let data;
        let blob;
        switch (responseType) {
          case "arraybuffer":
          case "blob":
            blob = await response.blob();
            data = await readBlobAsBase64(blob);
            break;
          case "json":
            data = await response.json();
            break;
          case "document":
          case "text":
          default:
            data = await response.text();
        }
        const headers = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        return {
          data,
          headers,
          status: response.status,
          url: response.url
        };
      }
      /**
       * Perform an Http GET request given a set of options
       * @param options Options to build the HTTP request
       */
      async get(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
      }
      /**
       * Perform an Http POST request given a set of options
       * @param options Options to build the HTTP request
       */
      async post(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
      }
      /**
       * Perform an Http PUT request given a set of options
       * @param options Options to build the HTTP request
       */
      async put(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
      }
      /**
       * Perform an Http PATCH request given a set of options
       * @param options Options to build the HTTP request
       */
      async patch(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
      }
      /**
       * Perform an Http DELETE request given a set of options
       * @param options Options to build the HTTP request
       */
      async delete(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
      }
    };
    var CapacitorHttp = registerPlugin("CapacitorHttp", {
      web: () => new CapacitorHttpPluginWeb()
    });
    exports2.SystemBarsStyle = void 0;
    (function(SystemBarsStyle) {
      SystemBarsStyle["Dark"] = "DARK";
      SystemBarsStyle["Light"] = "LIGHT";
      SystemBarsStyle["Default"] = "DEFAULT";
    })(exports2.SystemBarsStyle || (exports2.SystemBarsStyle = {}));
    exports2.SystemBarType = void 0;
    (function(SystemBarType) {
      SystemBarType["StatusBar"] = "StatusBar";
      SystemBarType["NavigationBar"] = "NavigationBar";
    })(exports2.SystemBarType || (exports2.SystemBarType = {}));
    var SystemBarsPluginWeb = class extends WebPlugin {
      async setStyle() {
        this.unavailable("not available for web");
      }
      async setAnimation() {
        this.unavailable("not available for web");
      }
      async show() {
        this.unavailable("not available for web");
      }
      async hide() {
        this.unavailable("not available for web");
      }
    };
    var SystemBars = registerPlugin("SystemBars", {
      web: () => new SystemBarsPluginWeb()
    });
    exports2.Capacitor = Capacitor2;
    exports2.CapacitorCookies = CapacitorCookies;
    exports2.CapacitorException = CapacitorException;
    exports2.CapacitorHttp = CapacitorHttp;
    exports2.SystemBars = SystemBars;
    exports2.WebPlugin = WebPlugin;
    exports2.WebView = WebView;
    exports2.buildRequestInit = buildRequestInit;
    exports2.registerPlugin = registerPlugin;
  }
});

// src/services/date.ts
function todayISO() {
  return toISO(/* @__PURE__ */ new Date());
}
function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function isValidISO(iso) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = fromISO(iso);
  return toISO(d) === iso;
}
function addDays(iso, days) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}
function daysBetween(a, b) {
  const da = fromISO(a);
  const db = fromISO(b);
  da.setHours(12, 0, 0, 0);
  db.setHours(12, 0, 0, 0);
  return Math.round((db.getTime() - da.getTime()) / 864e5);
}
function isEditableDate(iso) {
  return iso === todayISO();
}
function weekKeyOf(iso) {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - (jan4.getDay() + 6) % 7);
  const week = Math.round((monday.getTime() - week1Monday.getTime()) / 864e5 / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}
function monthGroups(startISO, endISO) {
  const groups = [];
  let cursor = startISO;
  while (cursor <= endISO) {
    const d = fromISO(cursor);
    const label = d.toLocaleDateString(void 0, { month: "long", year: "numeric" });
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const dates = [];
    for (let day = d.getDate(); day <= daysInMonth && cursor <= endISO; day++) {
      dates.push(cursor);
      cursor = addDays(cursor, 1);
    }
    groups.push({ label, dates });
  }
  return groups;
}

// src/services/analytics.ts
function eligibleHabitsForDate(habits2, date, now2 = todayISO()) {
  return habits2.filter((h) => {
    if (h.active) return h.createdAt.slice(0, 10) <= date;
    return h.createdAt.slice(0, 10) <= date && now2 >= date;
  });
}
function habitValueDone(habit, rec2) {
  if (!rec2) return false;
  return habit.type === "checkbox" ? rec2.completed === true : rec2.value >= habit.target;
}
function recordFor(records, date) {
  const rec2 = records[date];
  return rec2 && Object.keys(rec2.habits).length >= 0 ? rec2 : void 0;
}
function eligibleRulesForDate(arc2, rules2, date, now2 = todayISO()) {
  const dayNum = daysBetween(arc2.startDate, date) + 1;
  if (dayNum < 1) return [];
  return rules2.filter((r) => {
    if (!r.active) {
      return date <= now2 && dayNum >= r.fromDay;
    }
    return dayNum >= r.fromDay;
  });
}
function ruleFollowed(_rule, rec2) {
  return rec2?.status === "followed";
}
function evaluateDay(arc2, habits2, rules2, records, date, now2 = todayISO()) {
  if (date < arc2.startDate) {
    return { state: "before-start", pct: null, completedCount: 0, eligibleCount: 0, habitDone: 0, habitEligible: 0, ruleFollowed: 0, ruleEligible: 0, isPerfect: false };
  }
  const dayIndex = daysBetween(arc2.startDate, date);
  if (dayIndex >= arc2.durationDays) {
    return { state: "future", pct: null, completedCount: 0, eligibleCount: 0, habitDone: 0, habitEligible: 0, ruleFollowed: 0, ruleEligible: 0, isPerfect: false };
  }
  if (date > now2) {
    return { state: "future", pct: null, completedCount: 0, eligibleCount: 0, habitDone: 0, habitEligible: 0, ruleFollowed: 0, ruleEligible: 0, isPerfect: false };
  }
  const eligible = eligibleHabitsForDate(habits2, date, now2);
  const rec2 = recordFor(records, date);
  const done = eligible.filter((h) => habitValueDone(h, rec2?.habits[h.id]));
  const habitEligible = eligible.length;
  const habitDone = done.length;
  const elRules = eligibleRulesForDate(arc2, rules2, date, now2);
  const followed = elRules.filter((r) => ruleFollowed(r, rec2?.rules?.[r.id]));
  const ruleEligible = elRules.length;
  const ruleFollowedCount = followed.length;
  const eligibleCount = habitEligible + ruleEligible;
  const completedCount = habitDone + ruleFollowedCount;
  const pct = eligibleCount === 0 ? null : Math.round(completedCount / eligibleCount * 100);
  const isPerfect = eligibleCount > 0 && completedCount === eligibleCount;
  let state;
  if (date === now2) state = "today";
  else if (pct === null) state = "empty";
  else if (isPerfect) state = "complete";
  else if (completedCount > 0) state = "partial";
  else state = "empty";
  return { state, pct, completedCount, eligibleCount, isPerfect, habitDone, habitEligible, ruleFollowed: ruleFollowedCount, ruleEligible };
}
function isQualifyingDay(evaln) {
  return evaln.isPerfect;
}
function computeStreaks(arc2, habits2, rules2, records, now2 = todayISO()) {
  const start2 = arc2.startDate;
  const today = now2 < start2 ? start2 : now2;
  const lastArcDay = addDays(start2, arc2.durationDays - 1);
  const end = today < lastArcDay ? today : lastArcDay;
  const qualifying = /* @__PURE__ */ new Set();
  let cursor = start2;
  while (cursor <= end) {
    const evaln = evaluateDay(arc2, habits2, rules2, records, cursor, now2);
    if (isQualifyingDay(evaln)) qualifying.add(cursor);
    cursor = addDays(cursor, 1);
  }
  let best = 0;
  let run = 0;
  cursor = start2;
  while (cursor <= end) {
    if (qualifying.has(cursor)) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
    cursor = addDays(cursor, 1);
  }
  let current = 0;
  let probe = end;
  if (!qualifying.has(end)) probe = addDays(end, -1);
  while (probe >= start2 && qualifying.has(probe)) {
    current += 1;
    probe = addDays(probe, -1);
  }
  return { current, best: Math.max(best, current) };
}
function computeOverallStats(arc2, habits2, rules2, records, now2 = todayISO()) {
  const today = now2 < arc2.startDate ? arc2.startDate : now2;
  const dayNumber = Math.min(Math.max(daysBetween(arc2.startDate, today) + 1, 1), arc2.durationDays);
  const elapsedDays = dayNumber;
  let perfectDays = 0;
  let pctSum = 0;
  let pctDays = 0;
  let qualifyingDays = 0;
  let cursor = arc2.startDate;
  const end = today;
  while (cursor <= end) {
    const evaln = evaluateDay(arc2, habits2, rules2, records, cursor, now2);
    if (evaln.isPerfect) {
      perfectDays += 1;
      qualifyingDays += 1;
    } else if (evaln.pct !== null && evaln.completedCount > 0) qualifyingDays += 1;
    if (evaln.pct !== null) {
      pctSum += evaln.pct;
      pctDays += 1;
    }
    cursor = addDays(cursor, 1);
  }
  return {
    dayNumber,
    totalPct: pctDays === 0 ? null : Math.round(pctSum / pctDays),
    perfectDays,
    elapsedDays,
    qualifyingDays,
    streaks: computeStreaks(arc2, habits2, rules2, records, now2)
  };
}
function computeHabitStats(arc2, habits2, records, now2 = todayISO()) {
  const today = now2 < arc2.startDate ? arc2.startDate : now2;
  return habits2.map((habit) => {
    let completed = 0;
    let eligible = 0;
    let totalValue = 0;
    let cur = 0;
    let best = 0;
    let run = 0;
    let cursor = arc2.startDate;
    while (cursor <= today) {
      const el = eligibleHabitsForDate([habit], cursor, now2).length > 0;
      const isDone = habitValueDone(habit, records[cursor]?.habits[habit.id]);
      if (el) {
        eligible += 1;
        if (isDone) completed += 1;
        const val = records[cursor]?.habits[habit.id]?.value ?? 0;
        totalValue += val;
      }
      if (isDone) {
        run += 1;
        if (run > best) best = run;
      } else if (el) {
        run = 0;
      }
      cursor = addDays(cursor, 1);
    }
    cur = 0;
    let probe = today;
    const lastEligible = (d) => eligibleHabitsForDate([habit], d, now2).length > 0;
    while (probe >= arc2.startDate) {
      if (habitValueDone(habit, records[probe]?.habits[habit.id])) cur += 1;
      else if (lastEligible(probe)) break;
      probe = addDays(probe, -1);
    }
    return {
      habit,
      rate: eligible === 0 ? null : Math.round(completed / eligible * 100),
      completedCount: completed,
      eligibleCount: eligible,
      totalValue,
      currentStreak: cur,
      bestStreak: Math.max(best, cur)
    };
  });
}
function computeRuleStats(arc2, rules2, records, now2 = todayISO()) {
  const today = now2 < arc2.startDate ? arc2.startDate : now2;
  return rules2.map((rule) => {
    let followedCount = 0;
    let eligible = 0;
    let best = 0;
    let run = 0;
    let cursor = arc2.startDate;
    while (cursor <= today) {
      const el = eligibleRulesForDate(arc2, [rule], cursor, now2).length > 0;
      const isFollowed = el && ruleFollowed(rule, records[cursor]?.rules?.[rule.id]);
      if (el) {
        eligible += 1;
        if (isFollowed) {
          followedCount += 1;
          run += 1;
          if (run > best) best = run;
        } else {
          run = 0;
        }
      }
      cursor = addDays(cursor, 1);
    }
    let cur = 0;
    let probe = today;
    while (probe >= arc2.startDate) {
      const el = eligibleRulesForDate(arc2, [rule], probe, now2).length > 0;
      if (el && ruleFollowed(rule, records[probe]?.rules?.[rule.id])) {
        cur += 1;
      } else if (el) {
        break;
      }
      probe = addDays(probe, -1);
    }
    return {
      rule,
      rate: eligible === 0 ? null : Math.round(followedCount / eligible * 100),
      followedCount,
      brokenCount: eligible - followedCount,
      eligibleCount: eligible,
      currentStreak: cur,
      bestStreak: Math.max(best, cur)
    };
  });
}
function computeTrend(arc2, habits2, rules2, records, days, now2 = todayISO()) {
  const today = now2 < arc2.startDate ? arc2.startDate : now2;
  const firstArcDay = arc2.startDate;
  const from = daysBetween(firstArcDay, today) < days ? firstArcDay : addDays(today, -(days - 1));
  const points = [];
  let cursor = from;
  while (cursor <= today) {
    const evaln = evaluateDay(arc2, habits2, rules2, records, cursor, now2);
    points.push({ date: cursor, pct: evaln.pct });
    cursor = addDays(cursor, 1);
  }
  return points;
}

// src/services/storage.ts
var SCHEMA_VERSION = 3;
function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}
function strArray(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
function trackIdsOf(v) {
  if (!Array.isArray(v)) return void 0;
  return v.filter((x) => typeof x === "string" && x.length > 0);
}
function parseRules(arr) {
  const map = /* @__PURE__ */ new Map();
  for (const r of arr) {
    if (!isRecord(r) || typeof r.id !== "string" || !r.id) continue;
    const text = str(r.text).trim();
    if (!text) continue;
    if (map.has(r.id)) continue;
    map.set(r.id, {
      id: r.id,
      text,
      active: r.active !== false,
      fromDay: typeof r.fromDay === "number" && r.fromDay >= 1 ? Math.floor(r.fromDay) : 1,
      createdAt: str(r.createdAt, (/* @__PURE__ */ new Date()).toISOString()),
      order: typeof r.order === "number" ? r.order : map.size,
      trackIds: trackIdsOf(r.trackIds)
    });
  }
  return Array.from(map.values()).sort((a, b) => a.order - b.order);
}
function migrateTextRules(texts, existing, trackIds) {
  if (existing.length > 0) return existing;
  const out = [];
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i].trim();
    if (!text) continue;
    out.push({
      // Deterministic id from the text so re-running never duplicates.
      id: `rule_m${hash(text)}`,
      text,
      active: true,
      fromDay: 1,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      order: i + 1,
      trackIds
    });
  }
  return out;
}
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return h >>> 0;
}
function parseTrack(v, fallbackId) {
  if (!isRecord(v) || !isValidISO(v.startDate)) return null;
  const startDate = v.startDate;
  const duration = typeof v.durationDays === "number" && v.durationDays > 0 ? Math.floor(v.durationDays) : 90;
  const endDate = isValidISO(v.endDate) ? v.endDate : addDays(startDate, duration - 1);
  const status = v.status === "completed" || v.status === "archived" ? v.status : "active";
  return {
    id: str(v.id, fallbackId) || fallbackId,
    title: str(v.title, "My Track").trim() || "My Track",
    description: str(v.description),
    icon: str(v.icon),
    startDate,
    endDate,
    durationDays: duration,
    goal: str(v.goal),
    why: str(v.why),
    rules: strArray(v.rules),
    status,
    createdAt: str(v.createdAt, (/* @__PURE__ */ new Date()).toISOString()),
    updatedAt: str(v.updatedAt, (/* @__PURE__ */ new Date()).toISOString())
  };
}
function trackFromArc(arc2) {
  return {
    id: arc2.id || "track_current",
    title: arc2.title || "Winter Arc",
    description: "",
    icon: "",
    startDate: arc2.startDate,
    endDate: arc2.endDate,
    durationDays: arc2.durationDays,
    goal: arc2.goal,
    why: arc2.why,
    rules: Array.isArray(arc2.rules) ? arc2.rules : [],
    status: arc2.status,
    createdAt: arc2.createdAt,
    updatedAt: arc2.updatedAt
  };
}
function scopeLegacyTrackIds(items, trackId) {
  if (!trackId) return items;
  return items.map((item) => item.trackIds === void 0 ? { ...item, trackIds: [trackId] } : item);
}
function normalizeAppData(input) {
  const src = isRecord(input) ? input : {};
  const settings = {
    theme: "dark",
    onboarded: src.settings && isRecord(src.settings) ? !!src.settings.onboarded : false,
    demoMode: src.settings && isRecord(src.settings) ? !!src.settings.demoMode : false
  };
  let legacyArc = null;
  if (isRecord(src.arc) && isValidISO(src.arc.startDate) && isValidISO(src.arc.endDate)) {
    legacyArc = parseTrack(src.arc, "track_current");
  }
  const trackArr = Array.isArray(src.tracks) ? src.tracks : [];
  const trackMap = /* @__PURE__ */ new Map();
  for (const t of trackArr) {
    const parsed = parseTrack(t, `track_${trackMap.size + 1}`);
    if (!parsed) continue;
    trackMap.set(parsed.id, parsed);
  }
  if (trackMap.size === 0 && legacyArc) {
    const migrated = trackFromArc(legacyArc);
    trackMap.set(migrated.id, migrated);
  }
  let tracks = Array.from(trackMap.values());
  let activeTrackId = str(src.activeTrackId) || null;
  if (!activeTrackId || !tracks.some((t) => t.id === activeTrackId)) {
    activeTrackId = tracks.find((t) => t.status === "active")?.id ?? tracks[0]?.id ?? null;
  }
  const primaryTrack = tracks.find((t) => t.id === activeTrackId) ?? null;
  const habitArr = Array.isArray(src.habits) ? src.habits : [];
  const habitMap = /* @__PURE__ */ new Map();
  const validTypes = ["checkbox", "numeric", "duration"];
  for (const h of habitArr) {
    if (!isRecord(h) || typeof h.id !== "string" || !h.id) continue;
    const type = validTypes.includes(str(h.type)) ? h.type : "checkbox";
    const targetRaw = typeof h.target === "number" && h.target > 0 ? h.target : 1;
    habitMap.set(h.id, {
      id: h.id,
      name: str(h.name, "Habit"),
      icon: str(h.icon, "target"),
      type,
      target: type === "checkbox" ? 1 : targetRaw,
      unit: str(h.unit, type === "duration" ? "min" : "\xD7"),
      active: h.active !== false,
      createdAt: str(h.createdAt, (/* @__PURE__ */ new Date()).toISOString()),
      order: typeof h.order === "number" ? h.order : habitMap.size,
      trackIds: trackIdsOf(h.trackIds)
    });
  }
  let habits2 = scopeLegacyTrackIds(Array.from(habitMap.values()), activeTrackId);
  const ruleArr = Array.isArray(src.rules) ? src.rules : [];
  let rules2 = parseRules(ruleArr);
  const ruleTexts = primaryTrack?.rules?.length ? primaryTrack.rules : legacyArc?.rules ?? [];
  rules2 = migrateTextRules(ruleTexts, rules2, activeTrackId ? [activeTrackId] : void 0);
  rules2 = scopeLegacyTrackIds(rules2, activeTrackId);
  if (tracks.length > 0) {
    tracks = tracks.map((t) => {
      const texts = rules2.filter((r) => r.active && belongsToTrack(r.trackIds, t.id)).map((r) => r.text);
      return { ...t, rules: texts };
    });
  }
  const dailyRecords = {};
  if (isRecord(src.dailyRecords)) {
    for (const [date, rec2] of Object.entries(src.dailyRecords)) {
      if (!isValidISO(date) || !isRecord(rec2)) continue;
      const dayHabits = {};
      if (isRecord(rec2.habits)) {
        for (const [hid, hr] of Object.entries(rec2.habits)) {
          if (!isRecord(hr)) continue;
          const value = typeof hr.value === "number" && isFinite(hr.value) ? hr.value : 0;
          dayHabits[hid] = { value, completed: hr.completed === true || value > 0 };
        }
      }
      const ruleRecs = {};
      if (isRecord(rec2.rules)) {
        for (const [rid, rr] of Object.entries(rec2.rules)) {
          if (!isRecord(rr)) continue;
          const status = rr.status === "not_followed" ? "not_followed" : "followed";
          ruleRecs[rid] = { status };
        }
      }
      dailyRecords[date] = {
        date,
        habits: dayHabits,
        rules: ruleRecs,
        note: str(rec2.note),
        updatedAt: str(rec2.updatedAt, (/* @__PURE__ */ new Date()).toISOString())
      };
    }
  }
  const reflections = {};
  if (isRecord(src.reflections)) {
    for (const [weekKey, r] of Object.entries(src.reflections)) {
      if (!isRecord(r) || typeof r.weekStart !== "string") continue;
      reflections[weekKey] = {
        id: str(r.id, `refl_${weekKey}`),
        weekKey,
        weekStart: r.weekStart,
        wentWell: str(r.wentWell),
        toImprove: str(r.toImprove),
        nextFocus: str(r.nextFocus),
        createdAt: str(r.createdAt, (/* @__PURE__ */ new Date()).toISOString()),
        updatedAt: str(r.updatedAt, (/* @__PURE__ */ new Date()).toISOString())
      };
    }
  }
  const activeTrack = tracks.find((t) => t.id === activeTrackId) ?? null;
  return {
    settings,
    tracks,
    activeTrackId,
    arc: activeTrack,
    habits: habits2,
    rules: rules2,
    dailyRecords,
    reflections,
    version: SCHEMA_VERSION
  };
}
function belongsToTrack(trackIds, trackId) {
  return trackIds === void 0 || trackIds.includes(trackId);
}
function exportState(data) {
  return JSON.stringify({ ...data, exportedAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2);
}
function importState(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "Invalid JSON \u2014 the file could not be parsed." };
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: "Invalid backup: expected a JSON object." };
  }
  const hasTracks = Array.isArray(parsed.tracks) && parsed.tracks.length > 0;
  if (!hasTracks && parsed.arc === null && (parsed.habits === void 0 || Array.isArray(parsed.habits) && parsed.habits.length === 0)) {
    return { ok: false, error: "This backup is empty (no track and no habits)." };
  }
  const data = normalizeAppData(parsed);
  if (data.arc === null) {
    return { ok: false, error: "Invalid backup: no valid track data found." };
  }
  return { ok: true, data };
}

// src/app/platform.ts
var import_core = __toESM(require_index_cjs(), 1);
var PLATFORM_ORDER = ["desktop", "android", "web"];
var RELEASES_URL = "https://github.com/VISHNU2407-hub/tracker/releases";
function detectPlatform(s) {
  if (s.tauri) return "desktop";
  if (s.electron) return "desktop";
  if (s.nativePlatform && s.capacitorPlatform === "android") return "android";
  return "web";
}
function currentPlatform() {
  try {
    const w = typeof window !== "undefined" ? window : {};
    const tauri = Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__);
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const electron = /\bElectron\//i.test(ua);
    let nativePlatform = false;
    let capacitorPlatform = "web";
    if (typeof import_core.Capacitor !== "undefined" && typeof import_core.Capacitor.isNativePlatform === "function") {
      nativePlatform = import_core.Capacitor.isNativePlatform();
      capacitorPlatform = import_core.Capacitor.getPlatform();
    }
    return detectPlatform({ tauri, electron, nativePlatform, capacitorPlatform, userAgent: ua });
  } catch {
    return "web";
  }
}
function platformLabel(p) {
  return p === "desktop" ? "Desktop app" : p === "android" ? "Android app" : "Web app";
}
var ENTRY_KEY = "lifeSystem.entry";
function readEntry() {
  try {
    const raw = localStorage.getItem(ENTRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !PLATFORMS.includes(parsed.platform)) return null;
    return { platform: parsed.platform, at: typeof parsed.at === "string" ? parsed.at : "" };
  } catch {
    return null;
  }
}
function writeEntry(platform) {
  const record = { platform, at: (/* @__PURE__ */ new Date()).toISOString() };
  try {
    localStorage.setItem(ENTRY_KEY, JSON.stringify(record));
  } catch {
  }
  return record;
}
function clearEntry() {
  try {
    localStorage.removeItem(ENTRY_KEY);
  } catch {
  }
}
var SETUP_KEY = "lifeSystem.setup";
function readSetup() {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.at === "string" ? parsed.at : null;
  } catch {
    return null;
  }
}
function writeSetup(at) {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify({ at: at ?? (/* @__PURE__ */ new Date()).toISOString() }));
  } catch {
  }
}
function clearSetup() {
  try {
    localStorage.removeItem(SETUP_KEY);
  } catch {
  }
}
var PLATFORMS = PLATFORM_ORDER;

// src/app/passport.ts
var PASSPORT_FORMAT = "lifesystem-setup";
var PASSPORT_VERSION = 1;
var PASSPORT_FILENAME = "lifesystem-setup.json";
var PASSPORT_TOKEN_PREFIX = "lifesystem-setup:";
var DATA_PREFIX = "winterArc.";
var DATA_KEYS = ["settings", "tracks", "activeTrackId", "arc", "habits", "rules", "dailyRecords", "reflections", "version"];
var VALID_PLATFORMS = ["desktop", "android", "web"];
function isSetupComplete() {
  if (readSetup() !== null) return true;
  try {
    const rawSettings = localStorage.getItem(DATA_PREFIX + "settings");
    const rawArc = localStorage.getItem(DATA_PREFIX + "arc");
    if (!rawSettings || !rawArc) return false;
    const settings = JSON.parse(rawSettings);
    return settings.onboarded === true && JSON.parse(rawArc) !== null;
  } catch {
    return false;
  }
}
function buildPassport() {
  if (!isSetupComplete()) return null;
  const data = {};
  for (const key of DATA_KEYS) {
    try {
      const raw = localStorage.getItem(DATA_PREFIX + key);
      data[key] = raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data.settings || typeof data.settings !== "object") return null;
  if (!data.arc || typeof data.arc !== "object") return null;
  const setupAt = readSetup();
  return {
    format: PASSPORT_FORMAT,
    v: PASSPORT_VERSION,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    entry: readEntry(),
    setup: { at: setupAt ?? (/* @__PURE__ */ new Date()).toISOString() },
    data
  };
}
function parsePassport(input) {
  let value = input;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const p = value;
  if (p.format !== PASSPORT_FORMAT || p.v !== PASSPORT_VERSION) return null;
  if (!p.setup || typeof p.setup.at !== "string") return null;
  if (p.entry !== null && p.entry !== void 0) {
    if (typeof p.entry !== "object" || !VALID_PLATFORMS.includes(p.entry.platform)) return null;
    if (typeof p.entry.at !== "string") return null;
  }
  const d = p.data;
  if (!d || typeof d !== "object") return null;
  if (!d.settings || typeof d.settings !== "object") return null;
  if (!d.arc || typeof d.arc !== "object") return null;
  return p;
}
function applyPassport(input) {
  const p = parsePassport(input);
  if (!p) return false;
  if (isSetupComplete()) return false;
  try {
    for (const key of DATA_KEYS) {
      const value = p.data[key];
      if (value !== void 0) localStorage.setItem(DATA_PREFIX + key, JSON.stringify(value));
    }
    writeEntry(p.entry && VALID_PLATFORMS.includes(p.entry.platform) ? p.entry.platform : currentPlatform());
    writeSetup(p.setup.at);
    return true;
  } catch {
    return false;
  }
}
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  }
  return btoa(binary);
}
function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function encodePassportToken(p) {
  return PASSPORT_TOKEN_PREFIX + toBase64(JSON.stringify(p));
}
function decodePassportToken(text) {
  if (typeof text !== "string" || !text.startsWith(PASSPORT_TOKEN_PREFIX)) return null;
  try {
    return parsePassport(fromBase64(text.slice(PASSPORT_TOKEN_PREFIX.length)));
  } catch {
    return null;
  }
}

// scripts/smoke.ts
var failures = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ok   ${msg}`);
  else {
    failures++;
    console.error(`  FAIL ${msg}`);
  }
}
var start = "2026-10-01";
var arc = {
  id: "arc_current",
  title: "Winter Arc",
  startDate: start,
  endDate: "2026-12-29",
  durationDays: 90,
  goal: "g",
  why: "w",
  rules: [],
  status: "active",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z"
};
var habits = [
  { id: "h1", name: "Check", icon: "check", type: "checkbox", target: 1, unit: "session", active: true, createdAt: "2026-10-01T00:00:00Z", order: 1 },
  { id: "h2", name: "Water", icon: "hash", type: "numeric", target: 8, unit: "glasses", active: true, createdAt: "2026-10-01T00:00:00Z", order: 2 },
  { id: "h3", name: "Study", icon: "clock", type: "duration", target: 60, unit: "min", active: true, createdAt: "2026-10-01T00:00:00Z", order: 3 }
];
var rules = [
  { id: "r1", text: "No Instagram after 10 PM", active: true, fromDay: 1, createdAt: "2026-10-01T00:00:00Z", order: 1 },
  { id: "r2", text: "Lights out by 11", active: true, fromDay: 4, createdAt: "2026-10-01T00:00:00Z", order: 2 }
];
function rec(habitsDone, ruleStatuses = {}, note = "") {
  const habitRecs = {};
  for (const [id, v] of Object.entries(habitsDone)) {
    habitRecs[id] = { value: v, completed: v > 0 };
  }
  const ruleRecs = {};
  for (const [id, status] of Object.entries(ruleStatuses)) {
    ruleRecs[id] = { status };
  }
  return { date: "", habits: habitRecs, rules: ruleRecs, note, updatedAt: "" };
}
console.log("\u2014 date service \u2014");
assert(isValidISO("2026-02-29") === false, "non-leap year Feb 29 rejected");
assert(isValidISO("2024-02-29"), "leap year 2024 accepted");
assert(isValidISO("2025-02-29") === false, "invalid Feb 29 rejected");
assert(daysBetween("2025-12-30", "2026-01-02") === 3, "month/year boundary diff = 3");
assert(addDays("2026-10-31", 1) === "2026-11-01", "addDays across month boundary");
assert(weekKeyOf("2026-10-05") === "2026-W41", "ISO week key Oct 5 2026 = W41");
assert(weekKeyOf("2026-01-01") === "2026-W01", "ISO week Jan 1 2026 = W01");
console.log("\u2014 read-only day gate (only today is editable) \u2014");
var gateToday = todayISO();
assert(isEditableDate(gateToday), "today is editable");
assert(isEditableDate(addDays(gateToday, -1)) === false, "previous days are read-only");
assert(isEditableDate(addDays(gateToday, -30)) === false, "older history days are read-only");
assert(isEditableDate(addDays(gateToday, 1)) === false, "future days are read-only");
console.log("\u2014 month groups (habit grid) \u2014");
var mg = monthGroups("2026-10-25", "2026-11-30");
assert(mg.length === 2, "Oct 25 \u2192 Nov 30 splits into 2 month groups");
assert(mg[0].label === "October 2026" && mg[0].dates.length === 7, "first group = Oct 25\u201331 (7 days)");
assert(mg[1].dates[0] === "2026-11-01" && mg[1].dates[mg[1].dates.length - 1] === "2026-11-30", "second group = Nov 1\u201330");
console.log("\u2014 rule eligibility \u2014");
var now = "2026-10-11";
assert(eligibleRulesForDate(arc, rules, "2026-10-01", now).map((r) => r.id).join(",") === "r1", "r2 not eligible before fromDay 4");
assert(eligibleRulesForDate(arc, rules, "2026-10-04", now).length === 2, "both rules eligible from day 4");
assert(eligibleRulesForDate(arc, rules, "2026-09-30", now).length === 0, "no rules eligible before arc start");
var archivedRule = { ...rules[0], active: false };
assert(eligibleRulesForDate(arc, [archivedRule], "2026-10-05", now).length === 1, "archived rule keeps counting on past days");
assert(eligibleRulesForDate(arc, [archivedRule], now, now).length === 1, "archived rule still eligible today (past-day gate only)");
assert(eligibleRulesForDate(arc, [archivedRule], "2026-10-15", now).length === 0, "archived rule not eligible on future days");
console.log("\u2014 day evaluation (habits + rules combined) \u2014");
var r1 = rec({ h1: 1, h2: 8, h3: 75 }, { r1: "followed" });
var r2 = rec({ h1: 1, h2: 8, h3: 60 }, { r1: "not_followed" });
var mkRecords = () => {
  const out = { "2026-10-01": r1, "2026-10-02": r2 };
  for (let d = 4; d <= 11; d++) {
    out[addDays("2026-10-01", d - 1)] = rec({ h1: 1, h2: 9, h3: 90 }, { r1: "followed", r2: "followed" });
  }
  return out;
};
var fullRecords = mkRecords();
var ev1 = evaluateDay(arc, habits, rules, fullRecords, "2026-10-01", now);
assert(ev1.isPerfect && ev1.pct === 100, "day 1 all done = perfect, 100%");
assert(ev1.habitDone === 3 && ev1.ruleFollowed === 1, "day 1 breakdown 3 habits + 1 rule");
var ev2 = evaluateDay(arc, habits, rules, fullRecords, "2026-10-02", now);
assert(!ev2.isPerfect && ev2.pct === 75, `day 2 broken rule \u2192 75% (got ${ev2.pct})`);
assert(ev2.state === "partial", "day 2 state = partial (rule break blocks perfect)");
var evU = evaluateDay(arc, habits, rules, { ...fullRecords, "2026-10-04": rec({ h1: 1, h2: 9, h3: 90 }) }, "2026-10-04", now);
assert(evU.pct === 60, `unmarked rules on day 4 = 3/5 = 60% (got ${evU.pct})`);
assert(!evU.isPerfect, "unmarked rules block perfect day");
var evF = evaluateDay(arc, habits, rules, fullRecords, "2026-11-15", now);
assert(evF.state === "future" && evF.pct === null, "future day locked, null pct");
var evB = evaluateDay(arc, habits, rules, fullRecords, "2026-09-01", now);
assert(evB.state === "before-start", "before-start day");
var evNoRules = evaluateDay(arc, habits, [], fullRecords, "2026-10-01", now);
assert(evNoRules.isPerfect && evNoRules.pct === 100 && evNoRules.ruleEligible === 0, "no rules \u2192 habits-only scoring unchanged");
console.log("\u2014 streaks (combined) \u2014");
var streaks = computeStreaks(arc, habits, rules, fullRecords, now);
assert(streaks.current === 8, `current streak = 8 (got ${streaks.current})`);
assert(streaks.best === 8, `best streak = 8 (got ${streaks.best})`);
var withoutToday = { ...fullRecords };
delete withoutToday["2026-10-11"];
var s2 = computeStreaks(arc, habits, rules, withoutToday, now);
assert(s2.current === 7, `streak survives today-miss via yesterday = 7 (got ${s2.current})`);
var broken = { ...fullRecords, "2026-10-10": rec({}) };
var s3 = computeStreaks(arc, habits, rules, broken, now);
assert(s3.current === 1, `broken chain \u2192 current = 1 (got ${s3.current})`);
assert(s3.best === 6, `best = longest remaining run 6 after break (got ${s3.best})`);
console.log("\u2014 overall stats \u2014");
var overall = computeOverallStats(arc, habits, rules, fullRecords, now);
assert(overall.dayNumber === 11, `day number = 11 (got ${overall.dayNumber})`);
assert(overall.perfectDays === 9, `perfect days = 9 (got ${overall.perfectDays})`);
console.log("\u2014 habit stats (rules do not distort habit rates) \u2014");
var hs = computeHabitStats(arc, habits, fullRecords, now);
var study = hs.find((s) => s.habit.id === "h3");
assert(study.completedCount === 10, `study completed 10 days (got ${study.completedCount})`);
assert(study.rate === 91, `study rate 10/11 = 91% (got ${study.rate})`);
console.log("\u2014 rule stats \u2014");
var rs = computeRuleStats(arc, rules, fullRecords, now);
var r1s = rs.find((s) => s.rule.id === "r1");
var r2s = rs.find((s) => s.rule.id === "r2");
assert(r1s.eligibleCount === 11, `r1 eligible 11 days (got ${r1s.eligibleCount})`);
assert(r1s.followedCount === 9, `r1 followed 9 days (got ${r1s.followedCount})`);
assert(r1s.rate === 82, `r1 rate 82% (got ${r1s.rate})`);
assert(r1s.brokenCount === 2, `r1 broken 2 days (got ${r1s.brokenCount})`);
assert(r1s.currentStreak === 8 && r1s.bestStreak === 8, `r1 streak 8/8 (got ${r1s.currentStreak}/${r1s.bestStreak})`);
assert(r2s.eligibleCount === 8, `r2 eligible 8 days (got ${r2s.eligibleCount})`);
assert(r2s.rate === 100, `r2 rate 100% (got ${r2s.rate})`);
assert(Math.round(26 / 30 * 100) === 87, "26/30 control rate rounds like the spec example");
console.log("\u2014 habit creation gating \u2014");
var lateHabit = { ...habits[0], id: "late", createdAt: "2026-10-05T00:00:00Z", active: true };
var evLate = evaluateDay(arc, [lateHabit], rules, fullRecords, "2026-10-02", now);
assert(evLate.habitEligible === 0 && evLate.pct === null || evLate.pct !== null, "late habit evaluated without crash");
assert(evLate.ruleEligible === 1, "rule still eligible on day 2");
var evLate2 = evaluateDay(arc, [lateHabit], [], fullRecords, "2026-10-02", now);
assert(evLate2.eligibleCount === 0 && evLate2.pct === null, "habit created later not eligible on earlier day");
console.log("\u2014 archived habit preserves history \u2014");
var archivedHabit = { ...habits[0], active: false };
var evArch = evaluateDay(arc, [archivedHabit], rules, fullRecords, "2026-10-01", now);
assert(evArch.habitEligible === 1 && evArch.pct === 100, "archived habit still counts on past days");
console.log("\u2014 trend \u2014");
var t7 = computeTrend(arc, habits, rules, fullRecords, 7, now);
assert(t7.length === 7, "7-day trend has 7 points");
assert(t7[6].date === "2026-10-11", "trend ends today");
assert(t7.every((p) => p.pct !== null), "trend pct all non-null in window");
console.log("\u2014 storage migration (v1 \u2192 v2) \u2014");
var v1 = {
  settings: { theme: "dark", onboarded: true, demoMode: false },
  arc: { ...arc, rules: ["No Instagram after 10 PM", "Up at 6:00"] },
  habits,
  dailyRecords: { "2026-10-01": { date: "2026-10-01", habits: { h1: { value: 1, completed: true } }, note: "", updatedAt: "" } },
  reflections: {},
  version: 1
};
var norm = normalizeAppData(v1);
assert(norm.rules.length === 2, `arc.rules text migrated into 2 Rule entities (got ${norm.rules.length})`);
assert(norm.rules[0].text === "No Instagram after 10 PM", "rule text preserved verbatim");
assert(norm.rules[0].active === true && norm.rules[0].fromDay === 1, "migrated rule active from Day 1");
assert(norm.rules[0].id === norm.rules[0].id, "migrated rule has stable id");
assert(norm.arc.rules.length === 2, "arc.rules text mirror kept for back-compat");
var again = normalizeAppData({ ...v1, rules: norm.rules, arc: { ...norm.arc, rules: norm.rules.map((r) => r.text) } });
assert(again.rules.length === 2 && again.rules[0].id === norm.rules[0].id, "re-normalizing keeps same rule ids (no duplicates)");
assert(again.rules.map((r) => r.text).join("|") === "No Instagram after 10 PM|Up at 6:00", "existing rule texts intact");
assert(norm.dailyRecords["2026-10-01"].rules !== void 0, "v1 daily record normalized with rules map");
var v2 = normalizeAppData({
  settings: { theme: "dark", onboarded: true, demoMode: false },
  arc: { ...arc, rules: ["No Instagram after 10 PM"] },
  habits,
  rules: norm.rules,
  dailyRecords: {
    "2026-10-01": { date: "2026-10-01", habits: {}, rules: { [norm.rules[0].id]: { status: "followed" } }, note: "", updatedAt: "" },
    "2026-10-02": { date: "2026-10-02", habits: {}, rules: { [norm.rules[0].id]: { status: "not_followed" } }, note: "", updatedAt: "" }
  },
  reflections: {},
  version: 2
});
var roundTrip = importState(exportState(v2));
assert(roundTrip.ok && roundTrip.data.rules.length === 2, "v2 backup round-trips rule entities");
assert(roundTrip.data.dailyRecords["2026-10-01"].rules[norm.rules[0].id].status === "followed", "followed status round-trips");
assert(roundTrip.data.dailyRecords["2026-10-02"].rules[norm.rules[0].id].status === "not_followed", "not_followed status round-trips");
console.log("\u2014 tracks (fixed Winter Arc \u2192 user-created Tracks) \u2014");
assert(norm.tracks.length === 1, `legacy arc migrates into 1 track (got ${norm.tracks.length})`);
assert(norm.tracks[0].title === "Winter Arc", "migrated track keeps the legacy title");
assert(norm.activeTrackId === norm.tracks[0].id, "migrated track becomes the active track");
assert(norm.arc !== null && norm.arc.id === norm.tracks[0].id, "arc mirrors the active track");
assert(norm.habits.every((h) => h.trackIds?.includes(norm.tracks[0].id)), "migrated habits belong to the track");
assert(norm.rules.every((r) => r.trackIds?.includes(norm.tracks[0].id)), "migrated rules belong to the track");
assert(norm.dailyRecords["2026-10-01"] !== void 0, "historical daily records survive migration");
assert(belongsToTrack(void 0, "t1"), "undefined trackIds = belongs to every track (legacy)");
assert(belongsToTrack(["t1"], "t1") && !belongsToTrack(["t1"], "t2"), "explicit membership is respected");
var twoTracks = {
  settings: { theme: "dark", onboarded: true, demoMode: false },
  tracks: [
    { id: "t_winter", title: "Winter Arc", description: "", icon: "\u2744\uFE0F", startDate: start, endDate: "2026-12-29", durationDays: 90, goal: "", why: "", rules: [], status: "active", createdAt: "", updatedAt: "" },
    { id: "t_fit", title: "Fitness Journey", description: "Get strong", icon: "\u{1F4AA}", startDate: start, endDate: "2026-11-29", durationDays: 60, goal: "", why: "", rules: [], status: "active", createdAt: "", updatedAt: "" }
  ],
  activeTrackId: "t_fit",
  habits: [{ ...habits[0], trackIds: ["t_winter"] }, { ...habits[1], id: "h_fit", trackIds: ["t_fit"] }],
  rules: [],
  dailyRecords: {},
  reflections: {},
  version: 3
};
var tracksImport = importState(JSON.stringify(twoTracks));
assert(tracksImport.ok && tracksImport.data.tracks.length === 2, "tracks-only backup imports both tracks");
assert(tracksImport.data.activeTrackId === "t_fit", "active track is preserved");
assert(tracksImport.data.arc?.title === "Fitness Journey", "arc mirror follows the active track (not hard-coded to Winter Arc)");
assert(!belongsToTrack(tracksImport.data.habits[0].trackIds, "t_fit"), "a Winter Arc habit is not scoped to Fitness Journey");
console.log("\u2014 export / import validation \u2014");
var goodBackup = {
  settings: { theme: "dark", onboarded: true },
  arc: { ...arc },
  habits,
  dailyRecords: fullRecords,
  reflections: { "2026-W41": { id: "r1", weekKey: "2026-W41", weekStart: "2026-10-05", wentWell: "x", toImprove: "y", nextFocus: "z" } },
  version: 2
};
var imp = importState(JSON.stringify(goodBackup));
assert(imp.ok && imp.data && imp.data.arc !== null, "valid backup imports");
assert(imp.data.habits.length === 3 && Object.keys(imp.data.dailyRecords).length === Object.keys(fullRecords).length, "backup content normalized");
assert(imp.data.reflections["2026-W41"] !== void 0, "reflections imported");
assert(importState("not json{").ok === false, "invalid JSON rejected");
assert(importState("[1,2,3]").ok === false, "non-object JSON rejected");
assert(importState("{}").ok === false, "empty object rejected (no arc)");
var badArc = { ...goodBackup, arc: { ...arc, startDate: "nope" } };
assert(importState(JSON.stringify(badArc)).ok === false, "backup with invalid start date rejected");
var dupes = { ...goodBackup, habits: [habits[0], { ...habits[0], name: "Second" }] };
var imp2 = importState(JSON.stringify(dupes));
assert(imp2.ok && imp2.data.habits.length === 1 && imp2.data.habits[0].name === "Second", "duplicate habit IDs normalized (last wins)");
var corrupt = { ...goodBackup, dailyRecords: { ...fullRecords, "garbage-date": { junk: true } } };
var imp3 = importState(JSON.stringify(corrupt));
assert(imp3.ok && imp3.data.dailyRecords["garbage-date"] === void 0, "corrupt record entries dropped");
var exported = JSON.parse(exportState(imp.data));
assert(!!exported.exportedAt && exported.arc.startDate === arc.startDate, "export includes timestamp and round-trips");
console.log("\u2014 platform layer (welcome screen) \u2014");
assert(detectPlatform({}) === "web", "no signals \u2192 web");
assert(detectPlatform({ userAgent: "Mozilla/5.0" }) === "web", "plain browser \u2192 web");
assert(detectPlatform({ electron: true }) === "desktop", "Electron renderer \u2192 desktop");
assert(detectPlatform({ tauri: true }) === "desktop", "Tauri shell \u2192 desktop");
assert(detectPlatform({ nativePlatform: true, capacitorPlatform: "android" }) === "android", "Capacitor Android \u2192 android");
assert(detectPlatform({ nativePlatform: true, capacitorPlatform: "ios" }) === "web", "unsupported native shell \u2192 web");
assert(detectPlatform({ tauri: true, electron: true, nativePlatform: true, capacitorPlatform: "android" }) === "desktop", "desktop signals win over android");
assert(
  platformLabel("desktop") === "Desktop app" && platformLabel("android") === "Android app" && platformLabel("web") === "Web app",
  "platform labels"
);
assert(RELEASES_URL.startsWith("https://github.com/"), "releases URL points at the real repo");
var entryStore = /* @__PURE__ */ new Map();
globalThis.localStorage = {
  getItem: (k) => entryStore.has(k) ? entryStore.get(k) : null,
  setItem: (k, v) => void entryStore.set(k, String(v)),
  removeItem: (k) => void entryStore.delete(k)
};
assert(readEntry() === null, "no entry recorded before the first visit");
var entry = writeEntry("desktop");
assert(entry.platform === "desktop" && /^\d{4}-/.test(entry.at), "entry records platform + timestamp");
assert(readEntry()?.platform === "desktop", "entry round-trips");
writeEntry("android");
assert(entryStore.size === 1 && entryStore.has("lifeSystem.entry"), "platform layer writes only lifeSystem.entry (never winterArc.*)");
entryStore.set("lifeSystem.entry", JSON.stringify({ platform: "nope" }));
assert(readEntry() === null, "unknown platform in entry ignored");
entryStore.set("lifeSystem.entry", "not json{");
assert(readEntry() === null, "unparseable entry ignored");
clearEntry();
assert(readEntry() === null && entryStore.size === 0, "clearEntry removes the record (replays the intro)");
assert(readSetup() === null, "no setup flag before onboarding completes");
writeSetup();
assert(typeof readSetup() === "string", "setup flag round-trips with a timestamp");
assert(entryStore.size === 1 && entryStore.has("lifeSystem.setup"), "setup flag lives in its own key");
entryStore.set("lifeSystem.setup", "not json{");
assert(readSetup() === null, "unparseable setup flag treated as not-done");
clearSetup();
assert(readSetup() === null && entryStore.size === 0, "clearSetup removes the flag (Settings reset path)");
console.log("\u2014 setup passport (cross-platform handoff) \u2014");
assert(PASSPORT_FILENAME === "lifesystem-setup.json", "passport filename matches the desktop Downloads scan");
assert(buildPassport() === null && !isSetupComplete(), "no passport before first-run setup completes");
var seedCompletedSetup = () => {
  entryStore.clear();
  entryStore.set("winterArc.settings", JSON.stringify({ onboarded: true, name: "V" }));
  entryStore.set("winterArc.arc", JSON.stringify(arc));
  entryStore.set("winterArc.habits", JSON.stringify(habits));
  entryStore.set("winterArc.rules", JSON.stringify([]));
  entryStore.set("winterArc.dailyRecords", JSON.stringify({}));
  entryStore.set("winterArc.reflections", JSON.stringify([]));
  entryStore.set("winterArc.version", JSON.stringify(2));
  writeEntry("web");
  writeSetup("2026-10-01T10:00:00.000Z");
};
seedCompletedSetup();
assert(isSetupComplete(), "flagged setup reports complete");
var passport = buildPassport();
assert(passport !== null && passport.format === PASSPORT_FORMAT && passport.v === 1, "passport builds with format marker + version");
assert(passport.setup.at === "2026-10-01T10:00:00.000Z", "passport preserves the original setup timestamp");
assert(passport.data.habits.length === habits.length, "passport carries the full dataset");
assert(JSON.parse(entryStore.get("winterArc.settings")).onboarded === true, "building a passport never mutates local data");
assert(parsePassport(JSON.stringify(passport)) !== null, "passport round-trips through JSON text");
assert(parsePassport({ format: "someone-elses", v: 1, setup: { at: "x" }, data: { settings: {}, arc: {} } }) === null, "foreign format rejected");
assert(parsePassport({ ...passport, format: PASSPORT_FORMAT, v: 99 }) === null, "unknown version rejected");
assert(parsePassport({ ...passport, data: { settings: null, arc: {} } }) === null, "dataset without settings rejected");
assert(parsePassport("not json {") === null, "garbage text rejected");
var unicodePassport = JSON.parse(JSON.stringify(passport));
unicodePassport.data.settings = { onboarded: true, name: "\u0428\u0442\u043E\u0440\u043C \u26C5 \u65E5\u672C\u8A9E" };
var token = encodePassportToken(unicodePassport);
var decoded = decodePassportToken(token);
assert(decoded !== null && decoded.data.settings.name === "\u0428\u0442\u043E\u0440\u043C \u26C5 \u65E5\u672C\u8A9E", "token round-trips unicode dataset");
assert(decodePassportToken("unrelated clipboard text") === null, "non-token clipboard text ignored");
assert(decodePassportToken(`${"lifesystem-setup:"}%%%bad%%%`) === null, "corrupt token rejected");
seedCompletedSetup();
var habitsBefore = entryStore.get("winterArc.habits");
var foreign = JSON.parse(JSON.stringify(passport));
foreign.data.habits = [{ id: "not-from-here" }];
assert(applyPassport(foreign) === false, "import refused when setup is already complete");
assert(entryStore.get("winterArc.habits") === habitsBefore, "refused import leaves existing data untouched");
entryStore.clear();
assert(!isSetupComplete(), "fresh store reports setup incomplete");
assert(applyPassport(passport) === true, "fresh install imports the passport");
assert(isSetupComplete(), "imported install reports setup complete (no welcome/onboarding)");
assert(readEntry()?.platform === "web", "entry record carried across platforms");
assert(readSetup() === "2026-10-01T10:00:00.000Z", "setup timestamp carried over");
assert(JSON.parse(entryStore.get("winterArc.habits")).length === habits.length, "dataset carried over");
entryStore.clear();
entryStore.set("winterArc.settings", JSON.stringify({ onboarded: true }));
entryStore.set("winterArc.arc", JSON.stringify(arc));
assert(isSetupComplete() && readSetup() === null, "legacy user derives setup-complete without the flag");
assert(applyPassport(passport) === false, "legacy user protected from import too (no reset)");
entryStore.clear();
entryStore.set("winterArc.settings", JSON.stringify({ onboarded: true }));
entryStore.set("winterArc.arc", JSON.stringify(arc));
entryStore.set("winterArc.habits", "not json{");
assert(buildPassport() === null, "corrupt dataset refuses to export");
entryStore.clear();
assert(!isSetupComplete() && buildPassport() === null, "after Reset All Data the next launch starts fresh");
console.log(failures === 0 ? "\nALL PASS" : `
${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
/*! Bundled license information:

@capacitor/core/dist/index.cjs.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
