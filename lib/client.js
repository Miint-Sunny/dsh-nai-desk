window.__ModuleLoader__.load({id:"dsh-nai5-prompting",factory:(require)=>{var module={exports:{}};var exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.jsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react4 = __toESM(require("react"), 1);

// src/client-state.js
function fieldParts(field) {
  if (field === "main" || field === "uc") return { key: field };
  const match = /^character:([a-zA-Z0-9_-]+):(prompt|uc|name)$/.exec(field);
  if (!match) throw new Error("\u8349\u7A3F\u5B57\u6BB5\u6807\u8BC6\u65E0\u6548\u3002");
  return { id: match[1], key: match[2] };
}
function fieldValue(snapshot, field) {
  const { id, key } = fieldParts(field);
  return id ? snapshot?.characters.find((c) => c.id === id)?.[key] : snapshot?.[key];
}
function operationFor(field, value) {
  const { id, key } = fieldParts(field);
  return id ? { type: "set_character", id, patch: { [key]: value } } : { type: key === "main" ? "set_main" : "set_uc", text: value };
}
function checkedSnapshot(value, sessionId) {
  if (value?.schemaVersion !== 1 || value.sessionId !== sessionId || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.main !== "string" || typeof value.uc !== "string" || !Array.isArray(value.characters)) throw new Error("\u6536\u5230\u7684\u8349\u7A3F\u683C\u5F0F\u6216\u4F1A\u8BDD\u6807\u8BC6\u4E0D\u5339\u914D\uFF0C\u8BF7\u4FDD\u7559\u672A\u4FDD\u5B58\u5185\u5BB9\u540E\u91CD\u8BD5\u3002");
  const ids = /* @__PURE__ */ new Set();
  for (const c of value.characters) {
    if (!c || typeof c.id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(c.id) || ids.has(c.id) || typeof c.prompt !== "string" || typeof c.uc !== "string" || typeof c.name !== "string" || typeof c.enabled !== "boolean") throw new Error("\u6536\u5230\u7684\u89D2\u8272\u63D0\u793A\u8BCD\u6570\u636E\u683C\u5F0F\u65E0\u6548\uFF0C\u8BF7\u4FDD\u7559\u672A\u4FDD\u5B58\u5185\u5BB9\u540E\u91CD\u8BD5\u3002");
    ids.add(c.id);
  }
  return structuredClone(value);
}
var sleep = (ms, signal) => new Promise((resolve) => {
  const finish = () => {
    clearTimeout(timer);
    signal.removeEventListener("abort", finish);
    resolve();
  };
  const timer = setTimeout(finish, ms);
  signal.addEventListener("abort", finish, { once: true });
  if (signal.aborted) finish();
});
var DeskClient = class {
  #sessionId;
  #request;
  #autoSaveMs;
  #allowWatch;
  #watchWanted;
  #server = null;
  #pending = /* @__PURE__ */ new Map();
  #conflicts = /* @__PURE__ */ new Map();
  #listeners = /* @__PURE__ */ new Set();
  #version = 0;
  #loading = true;
  #saving = false;
  #commanding = false;
  #error = null;
  #closed = false;
  #startPromise;
  #flushPromise;
  #saveTimer;
  #watchController;
  #controller = new AbortController();
  #state;
  constructor({ sessionId, request, autoSaveMs = 180, watch = true }) {
    this.#sessionId = sessionId;
    this.#request = request;
    this.#autoSaveMs = autoSaveMs;
    this.#allowWatch = watch;
    this.#watchWanted = watch;
    this.#publish();
  }
  getSnapshot = () => this.#state;
  subscribe = (listener) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  #publish() {
    if (this.#closed) return;
    const draft = this.#server ? structuredClone(this.#server) : null;
    if (draft) for (const [field, pending] of this.#pending) {
      const { id, key } = fieldParts(field);
      if (!id) draft[key] = pending.value;
      else {
        const target = draft.characters.find((c) => c.id === id);
        if (target) target[key] = pending.value;
      }
    }
    this.#state = {
      phase: this.#loading ? "loading" : this.#conflicts.size ? "conflict" : this.#error ? "error" : this.#saving ? "saving" : "ready",
      draft,
      server: this.#server,
      pending: this.#pending.size,
      commandPending: this.#commanding,
      conflicts: [...this.#conflicts.values()],
      error: this.#error
    };
    for (const listener of this.#listeners) listener();
  }
  #adopt(value) {
    if (this.#closed) return;
    const snapshot = checkedSnapshot(value, this.#sessionId);
    if (this.#server && snapshot.revision < this.#server.revision) return;
    this.#server = snapshot;
    for (const [field, conflict] of this.#conflicts) {
      const remote = fieldValue(snapshot, field);
      if (remote !== conflict.remote) this.#conflicts.set(field, {
        ...conflict,
        remote,
        deleted: remote === void 0,
        revision: snapshot.revision,
        notice: "\u5DF2\u4FDD\u5B58\u7248\u672C\u518D\u6B21\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u6BD4\u8F83\u540E\u9009\u62E9\u4FDD\u7559\u7684\u5185\u5BB9\u3002"
      });
    }
  }
  #send(data, signal = this.#controller.signal) {
    return this.#request({ ...data, sessionId: this.#sessionId }, signal);
  }
  start() {
    if (!this.#startPromise) this.#startPromise = this.refresh();
    return this.#startPromise;
  }
  async refresh() {
    if (this.#closed) return;
    try {
      const value = await this.#send({ action: "read" });
      if (this.#closed) return;
      this.#adopt(value);
      this.#error = null;
    } catch (error) {
      if (!this.#closed) this.#error = error.message;
    } finally {
      this.#loading = false;
      this.#publish();
    }
    if (this.#allowWatch && this.#watchWanted) this.resume();
  }
  edit(field, value, { deferSave = false } = {}) {
    if (this.#closed || !this.#server) throw new Error("\u8349\u7A3F\u5C1A\u672A\u52A0\u8F7D\u5B8C\u6210\uFF0C\u8BF7\u7A0D\u5019\u518D\u7F16\u8F91\u3002");
    if (typeof value !== "string") throw new Error("\u63D0\u793A\u8BCD\u5B57\u6BB5\u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u3002");
    const current = fieldValue(this.#server, field);
    if (current === void 0) throw new Error("\u89D2\u8272\u63D0\u793A\u8BCD\u6761\u76EE\u5DF2\u5220\u9664\uFF0C\u8BF7\u68C0\u67E5\u5F53\u524D\u8349\u7A3F\u3002");
    const previous = this.#pending.get(field);
    this.#pending.set(field, { value, base: previous ? previous.base : current, version: ++this.#version });
    if (this.#conflicts.has(field)) this.#conflicts.set(field, { ...this.#conflicts.get(field), local: value });
    this.#error = null;
    this.#publish();
    clearTimeout(this.#saveTimer);
    if (!deferSave && this.#autoSaveMs !== null) this.#saveTimer = setTimeout(() => {
      this.flush().catch(() => {
      });
    }, this.#autoSaveMs);
  }
  flush() {
    clearTimeout(this.#saveTimer);
    if (this.#closed) return Promise.resolve();
    if (this.#flushPromise) return this.#flushPromise;
    const promise = this.#drain();
    this.#flushPromise = promise;
    promise.finally(() => {
      if (this.#flushPromise === promise) this.#flushPromise = void 0;
    }).catch(() => {
    });
    return promise;
  }
  async #drain() {
    this.#saving = true;
    this.#error = null;
    this.#publish();
    try {
      while (!this.#closed) {
        const selected = [...this.#pending].find(([field2]) => !this.#conflicts.has(field2));
        if (!selected) break;
        const [field, pending] = selected;
        const remote = fieldValue(this.#server, field);
        if (remote === pending.value) {
          this.#pending.delete(field);
          continue;
        }
        if (remote === void 0 || remote !== pending.base) {
          this.#conflicts.set(field, { field, local: pending.value, remote, deleted: remote === void 0, revision: this.#server.revision });
          continue;
        }
        try {
          const updated = await this.#send({ action: "mutate", expectedRevision: this.#server.revision, operation: operationFor(field, pending.value) });
          if (this.#closed) return;
          this.#adopt(updated);
          const latest = this.#pending.get(field);
          if (latest?.version === pending.version) this.#pending.delete(field);
          else if (latest) latest.base = fieldValue(updated, field);
        } catch (error) {
          if (this.#closed) return;
          if (error.code === "conflict" && error.current) {
            this.#adopt(error.current);
            continue;
          }
          this.#error = error.message;
          throw error;
        }
      }
    } finally {
      this.#saving = false;
      this.#publish();
    }
  }
  async resolveConflict(field, choice, shownRevision) {
    const pending = this.#pending.get(field);
    const conflict = this.#conflicts.get(field);
    if (!pending || !conflict) return;
    if (shownRevision !== conflict.revision) {
      this.#conflicts.set(field, { ...conflict, notice: "\u5DF2\u4FDD\u5B58\u7248\u672C\u518D\u6B21\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u6BD4\u8F83\u540E\u9009\u62E9\u4FDD\u7559\u7684\u5185\u5BB9\u3002" });
      this.#publish();
      return;
    }
    if (choice === "remote") this.#pending.delete(field);
    else if (choice === "local") {
      const remote = fieldValue(this.#server, field);
      if (remote === void 0) throw new Error("\u8BE5\u89D2\u8272\u63D0\u793A\u8BCD\u5DF2\u5220\u9664\u3002\u5148\u4ECE\u51B2\u7A81\u6846\u4FDD\u7559\u672A\u4FDD\u5B58\u5185\u5BB9\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u65B0\u5EFA\u89D2\u8272\u6761\u76EE\u3002");
      pending.base = remote;
    } else throw new Error("\u51B2\u7A81\u5904\u7406\u65B9\u5F0F\u5FC5\u987B\u662F local \u6216 remote\u3002");
    this.#conflicts.delete(field);
    this.#publish();
    await this.flush();
  }
  async command(operation) {
    if (this.#commanding) throw new Error("\u89D2\u8272\u64CD\u4F5C\u5C1A\u672A\u5B8C\u6210\uFF0C\u8BF7\u7A0D\u5019\u3002");
    this.#commanding = true;
    this.#publish();
    try {
      await this.flush();
      if (this.#closed) throw new Error("\u7F16\u8F91\u5668\u5DF2\u5173\u95ED\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u8349\u7A3F\u3002");
      if (this.#conflicts.size || this.#pending.size) throw new Error("\u5148\u4FDD\u5B58\u6587\u672C\u6216\u5904\u7406\u7248\u672C\u51B2\u7A81\uFF0C\u518D\u8C03\u6574\u89D2\u8272\u6761\u76EE\u3002");
      this.#saving = true;
      this.#error = null;
      this.#publish();
      const next = await this.#send({ action: "mutate", expectedRevision: this.#server.revision, operation });
      if (this.#closed) return;
      this.#adopt(next);
      return next;
    } catch (error) {
      if (error.code === "conflict" && error.current) this.#adopt(error.current);
      this.#error = error.message;
      throw error;
    } finally {
      this.#saving = false;
      this.#commanding = false;
      this.#publish();
    }
  }
  pause() {
    this.#watchWanted = false;
    this.#watchController?.abort();
    this.#watchController = void 0;
  }
  resume() {
    this.#watchWanted = true;
    if (this.#closed || !this.#server || !this.#allowWatch || this.#watchController) return;
    const controller = new AbortController();
    this.#watchController = controller;
    const run = async () => {
      let delay = 500;
      while (!controller.signal.aborted && !this.#closed) {
        try {
          const value = await this.#send({ action: "watch", revision: this.#server.revision }, controller.signal);
          if (controller.signal.aborted || this.#closed) return;
          this.#adopt(value);
          this.#error = null;
          this.#publish();
          delay = 500;
        } catch (error) {
          if (controller.signal.aborted || this.#closed) return;
          this.#error = error.message;
          this.#publish();
          await sleep(delay, controller.signal);
          delay = Math.min(delay * 2, 15e3);
        }
      }
    };
    run().catch((error) => {
      if (!this.#closed) {
        this.#error = error.message;
        this.#publish();
      }
    });
  }
  close() {
    if (this.#closed) return;
    this.#closed = true;
    clearTimeout(this.#saveTimer);
    this.pause();
    this.#controller.abort();
    this.#listeners.clear();
  }
};

// src/protocol.js
var API_PATH = "/api/nai-desk/v1";
var PRESET_ID = "nai5-prompting";
var PANEL_ID = "dsh-nai-desk";
var PANEL_KIND = "nai-desk";

// src/transport.js
async function requestDraft(data, signal) {
  const transport = globalThis.__DSH_TRANSPORT__;
  const response = await (transport?.fetch ? transport.fetch(API_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
    signal
  }) : globalThis.fetch(API_PATH, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
    signal
  }));
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`\u65E0\u6CD5\u89E3\u6790\u8349\u7A3F\u670D\u52A1\u7684\u54CD\u5E94\uFF08HTTP ${response.status}\uFF09\u3002\u4FDD\u7559\u672A\u4FDD\u5B58\u5185\u5BB9\u540E\u91CD\u8BD5\u3002`);
  }
  if (!response.ok) {
    const error = new Error(typeof body.error?.message === "string" ? body.error.message : "\u8349\u7A3F\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u4FDD\u7559\u672A\u4FDD\u5B58\u5185\u5BB9\u540E\u91CD\u8BD5\u3002");
    error.code = body.error?.code;
    if (body.error?.current) error.current = body.error.current;
    throw error;
  }
  return body;
}

// src/panel.jsx
var import_react3 = __toESM(require("react"), 1);

// src/controls.jsx
var import_react = __toESM(require("react"), 1);
var import_jsx_runtime = require("react/jsx-runtime");
var Button = (0, import_react.forwardRef)(function Button2({ variant = "ghost", size = "sm", className = "", children, ...props }, ref) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { ref, type: "button", className: `nd-button nd-button-${variant} nd-button-${size} ${className}`, ...props, children });
});
function PromptTabs({ id, value, options, onChange, label }) {
  const list = (0, import_react.useRef)(null);
  const selected = options.findIndex((option) => option.value === value);
  (0, import_react.useEffect)(() => {
    if (list.current?.contains(document.activeElement)) list.current.querySelector('[role="tab"][aria-selected="true"]')?.focus();
  }, [value]);
  const onKeyDown = (event) => {
    const key = event.key;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(key)) return;
    event.preventDefault();
    const index = key === "Home" ? 0 : key === "End" ? options.length - 1 : (selected + (key === "ArrowRight" || key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    if (index !== selected) onChange(options[index].value);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      ref: list,
      className: "nd-tabs",
      role: "tablist",
      "aria-label": label,
      style: { "--nd-segment-count": options.length, "--nd-segment-index": selected },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "nd-tab-indicator", "aria-hidden": "true" }),
        options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            role: "tab",
            className: "nd-tab",
            id: `${id}-${option.value}`,
            "aria-controls": `${id}-${option.value}-panel`,
            "aria-selected": option.value === value,
            tabIndex: option.value === value ? 0 : -1,
            title: option.title,
            onClick: () => {
              if (option.value !== value) onChange(option.value);
            },
            onKeyDown,
            children: option.label
          },
          option.value
        ))
      ]
    }
  );
}

// src/host-icons.jsx
var import_react2 = __toESM(require("react"), 1);
var import_jsx_runtime2 = require("react/jsx-runtime");
var IconChevronUpOutlineArtwork = ({ size = 14, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: size, height: size, className, viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", strokeWidth, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M12 10L8.70711 6.70711C8.31658 6.31658 7.68342 6.31658 7.29289 6.70711L4 10", stroke: "currentColor" }) });
var IconChevronDownOutlineArtwork = ({ size = 14, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: size, height: size, className, viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", strokeWidth, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M4 6L7.29289 9.29289C7.68342 9.68342 8.31658 9.68342 8.70711 9.29289L12 6", stroke: "currentColor" }) });
var IconCheckOutlineArtwork = ({ size = 16, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: size, height: size, className, viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", strokeWidth, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M2.25 8.5L5.49732 11.7473C5.90519 12.1552 6.57263 12.1344 6.95426 11.7018L13.75 4", stroke: "currentColor" }) });
var IconTrashOutlineArtwork = ({ size = 16, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: size, height: size, className, viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", strokeWidth, children: [
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M1.28149 3.88831H14.7187", stroke: "currentColor" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M5.41602 3.88833V2.47962C5.41602 2.29282 5.52492 2.11366 5.71876 1.98157C5.9126 1.84948 6.17551 1.77527 6.44964 1.77527H9.55053C9.82466 1.77527 10.0876 1.84948 10.2814 1.98157C10.4753 2.11366 10.5842 2.29282 10.5842 2.47962V3.88833", stroke: "currentColor" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M2.57349 3.88831L3.19366 13.2943C3.21937 13.5502 3.33952 13.7872 3.53065 13.9593C3.72178 14.1313 3.97016 14.2259 4.22729 14.2246H11.7728C12.0299 14.2259 12.2783 14.1313 12.4694 13.9593C12.6605 13.7872 12.7807 13.5502 12.8064 13.2943L13.4266 3.88831", stroke: "currentColor" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M6.44946 6.98926V11.1238", stroke: "currentColor" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M9.55054 6.98926V11.1238", stroke: "currentColor" })
] });
var IconFullscreenOutlineArtwork = ({ size = 16, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: size, height: size, className, viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", strokeWidth, children: [
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M2.33154 9.40576V13.1685C2.3318 13.4444 2.55556 13.6685 2.83154 13.6685H6.49463V14.6685H2.83154C2.00328 14.6685 1.3318 13.9967 1.33154 13.1685V9.40576H2.33154ZM13.1685 1.33154C13.9964 1.33199 14.6683 2.00352 14.6685 2.83154V6.40576H13.6685V2.83154C13.6683 2.5558 13.4441 2.33199 13.1685 2.33154H9.49463V1.33154H13.1685Z", fill: "currentColor" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M9.4292 6.57077L13.914 2.08594", stroke: "currentColor" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M6.57077 9.4292L2.08594 13.914", stroke: "currentColor" })
] });
var IconPlusOutlineArtwork = ({ size = 16, className, strokeWidth }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: size, height: size, className, viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", strokeWidth, children: [
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M8 2V14", stroke: "currentColor" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M2 8H14", stroke: "currentColor" })
] });
var icons = { up: IconChevronUpOutlineArtwork, down: IconChevronDownOutlineArtwork, check: IconCheckOutlineArtwork, trash: IconTrashOutlineArtwork, expand: IconFullscreenOutlineArtwork, plus: IconPlusOutlineArtwork };
function HostIcon({ kind }) {
  const Component = icons[kind];
  return Component ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Component, { size: 16, strokeWidth: 1 }) : null;
}

// src/panel.jsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function Icon({ kind }) {
  if (["up", "down", "check", "trash", "expand", "plus"].includes(kind)) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(HostIcon, { kind });
  const paths = {
    minus: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M5 12h14" }),
    restore: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M3 8h5V3M21 8h-5V3M8 21v-5H3M16 21v-5h5" }),
    fold: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "m7 3 5 5 5-5M7 21l5-5 5 5M5 12h14" }),
    unfold: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "m7 8 5-5 5 5M7 16l5 5 5-5M5 12h14" }),
    notebook: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_jsx_runtime3.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M7 3h13v18H7zM3 7h6M3 12h6M3 17h6M12 8h4M12 12h4" }) })
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: paths[kind] });
}
function IconButton({ label, icon, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { className: "nd-icon", title: label, "aria-label": label, ...props, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { kind: icon }) });
}
var baseOptions = [{ value: "main", label: "Base Prompt" }, { value: "uc", label: "UC", title: "\u603B\u8D1F\u9762\u63D0\u793A\u8BCD" }];
var characterOptions = [{ value: "prompt", label: "Prompt" }, { value: "uc", label: "UC", title: "\u89D2\u8272\u8D1F\u9762\u63D0\u793A\u8BCD" }];
function PromptEditor({ client, field, value, label, rows = 5 }) {
  const composing = (0, import_react3.useRef)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "textarea",
    {
      "aria-label": label,
      value,
      rows,
      spellCheck: false,
      placeholder: field === "main" ? "\u4F8B\u5982\uFF1Aoutdoors, soft lighting" : field.endsWith(":prompt") ? "\u4F8B\u5982\uFF1Agirl, blue jacket" : "",
      onCompositionStart: () => {
        composing.current = true;
      },
      onCompositionEnd: (event) => {
        composing.current = false;
        client.edit(field, event.currentTarget.value);
      },
      onChange: (event) => client.edit(field, event.currentTarget.value, { deferSave: composing.current }),
      onBlur: () => {
        if (!composing.current) client.flush().catch(() => {
        });
      }
    }
  );
}
var defaultUi = () => ({ baseTab: "main", collapsed: {}, tabs: {} });
function readUi(sessionId) {
  try {
    const saved = JSON.parse(localStorage.getItem(`dsh.nai-desk.ui.v1.${sessionId}`) ?? "null");
    if (saved && ["main", "uc"].includes(saved.baseTab) && saved.collapsed && typeof saved.collapsed === "object" && saved.tabs && typeof saved.tabs === "object") return saved;
  } catch {
  }
  return defaultUi();
}
function Character({ character, index, count, client, ui, setUi, busy, onDelete }) {
  const tabsId = (0, import_react3.useId)();
  const id = character.id;
  const collapsed = ui.collapsed[id] === true;
  const tab = ui.tabs[id] === "uc" ? "uc" : "prompt";
  const run = (operation) => client.command(operation).catch(() => {
  });
  const gender = /(?:^|[\s,])(?:1?girl|female)(?:[\s,]|$)/i.test(character.prompt) ? "\u2640" : /(?:^|[\s,])(?:1?boy|male)(?:[\s,]|$)/i.test(character.prompt) ? "\u2642" : "\u25CB";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: `nd-card nd-character${character.enabled ? "" : " nd-disabled"}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nd-character-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "nd-gender", "aria-hidden": "true", children: gender }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "nd-name-field", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "input",
        {
          "aria-label": `\u89D2\u8272 ${index + 1} \u540D\u79F0`,
          className: "nd-name",
          value: character.name,
          maxLength: 128,
          onChange: (event) => client.edit(`character:${id}:name`, event.currentTarget.value),
          onBlur: () => client.flush().catch(() => {
          })
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nd-character-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconButton, { label: `\u4E0A\u79FB\u89D2\u8272 ${index + 1}`, icon: "up", disabled: busy || index === 0, onClick: () => run({ type: "move_character", id, index: index - 1 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconButton, { label: `\u4E0B\u79FB\u89D2\u8272 ${index + 1}`, icon: "down", disabled: busy || index === count - 1, onClick: () => run({ type: "move_character", id, index: index + 1 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconButton, { label: `\u542F\u7528\u89D2\u8272 ${index + 1} \u7684\u63D0\u793A\u8BCD`, title: `${character.enabled ? "\u505C\u7528" : "\u542F\u7528"}\u89D2\u8272 ${index + 1} \u7684\u63D0\u793A\u8BCD`, icon: character.enabled ? "check" : "minus", "aria-pressed": character.enabled, disabled: busy, onClick: () => run({ type: "set_character", id, patch: { enabled: !character.enabled } }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconButton, { label: `\u5220\u9664\u89D2\u8272 ${index + 1}`, icon: "trash", disabled: busy, onClick: () => onDelete(character, index) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconButton, { label: `${collapsed ? "\u5C55\u5F00" : "\u6536\u8D77"}\u89D2\u8272 ${index + 1}`, icon: collapsed ? "unfold" : "fold", "aria-expanded": !collapsed, "aria-controls": `nd-character-${id}`, onClick: () => setUi((previous) => ({ ...previous, collapsed: { ...previous.collapsed, [id]: !collapsed } })) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nd-character-body", id: `nd-character-${id}`, hidden: collapsed, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "nd-editor-tools", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        PromptTabs,
        {
          id: tabsId,
          value: tab,
          options: characterOptions,
          label: `\u89D2\u8272 ${index + 1} \u63D0\u793A\u8BCD\u7C7B\u578B`,
          onChange: (value) => setUi((previous) => ({ ...previous, tabs: { ...previous.tabs, [id]: value } }))
        }
      ) }),
      characterOptions.map((option) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { role: "tabpanel", id: `${tabsId}-${option.value}-panel`, "aria-labelledby": `${tabsId}-${option.value}`, hidden: tab !== option.value, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PromptEditor, { client, field: `character:${id}:${option.value}`, value: character[option.value], label: `\u89D2\u8272 ${index + 1} ${option.value === "prompt" ? "\u6B63\u5411\u63D0\u793A\u8BCD" : "UC"}` }) }, option.value))
    ] })
  ] });
}
function Conflict({ conflict, client }) {
  const label = conflict.field === "main" ? "\u4E3B\u63D0\u793A\u8BCD" : conflict.field === "uc" ? "\u8349\u7A3F\u7EA7 UC" : conflict.field.endsWith(":name") ? "\u89D2\u8272\u540D\u79F0" : conflict.field.endsWith(":uc") ? "\u89D2\u8272\u7EA7 UC" : "\u89D2\u8272\u63D0\u793A\u8BCD";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "nd-conflict", role: "alert", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: conflict.deleted ? "\u8349\u7A3F\u4E2D\u7684\u8BE5\u89D2\u8272\u63D0\u793A\u8BCD\u5DF2\u5220\u9664" : `${label}\u5B58\u5728\u7248\u672C\u51B2\u7A81` }),
    conflict.notice && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: conflict.notice }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { children: [
      "\u672A\u4FDD\u5B58\u7684\u672C\u5730\u5185\u5BB9",
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("textarea", { readOnly: true, value: conflict.local, rows: 3 })
    ] }),
    !conflict.deleted && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { children: [
      "\u5F53\u524D\u5DF2\u4FDD\u5B58\u5185\u5BB9",
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("textarea", { readOnly: true, value: conflict.remote ?? "", rows: 3 })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nd-conflict-actions", children: [
      !conflict.deleted && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { onClick: () => client.resolveConflict(conflict.field, "local", conflict.revision).catch(() => {
      }), children: "\u4FDD\u7559\u6211\u7684\u4FEE\u6539" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { onClick: () => client.resolveConflict(conflict.field, "remote", conflict.revision).catch(() => {
      }), children: conflict.deleted ? "\u653E\u5F03\u8FD9\u6BB5\u672A\u4FDD\u5B58\u5185\u5BB9" : "\u4F7F\u7528\u5DF2\u4FDD\u5B58\u7248\u672C" })
    ] })
  ] });
}
function Panel(props) {
  if (typeof props.sessionId !== "string") return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "nai-desk nd-message", children: "\u9009\u62E9\u4E00\u4E2A NAI5 \u63D0\u793A\u8BCD\u4F1A\u8BDD\u4EE5\u6253\u5F00\u8349\u7A3F\u3002" });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(SessionPanel, { ...props }, props.sessionId);
}
function SessionPanel({ sessionId, sessionList, getClient, acquireClient, useTabInfo }) {
  const tabsId = (0, import_react3.useId)();
  const presetSnapshot = (0, import_react3.useCallback)(() => sessionList.getSnapshot().byId[sessionId]?.projectionValues?.agentPreset, [sessionList, sessionId]);
  const preset = (0, import_react3.useSyncExternalStore)(sessionList.subscribe, presetSnapshot, presetSnapshot);
  const client = (0, import_react3.useMemo)(() => getClient(sessionId), [getClient, sessionId]);
  const state = (0, import_react3.useSyncExternalStore)(client.subscribe, client.getSnapshot, client.getSnapshot);
  const tabInfo = useTabInfo?.();
  const visible = tabInfo?.tab?.visible !== false;
  const [ui, setUi] = (0, import_react3.useState)(() => readUi(sessionId));
  const [expanded, setExpanded] = (0, import_react3.useState)(false);
  const [removed, setRemoved] = (0, import_react3.useState)(null);
  (0, import_react3.useEffect)(() => {
    if (preset !== PRESET_ID || !visible) return;
    return acquireClient(sessionId);
  }, [preset, visible, acquireClient, sessionId]);
  (0, import_react3.useEffect)(() => {
    try {
      localStorage.setItem(`dsh.nai-desk.ui.v1.${sessionId}`, JSON.stringify(ui));
    } catch {
    }
  }, [sessionId, ui]);
  if (preset !== PRESET_ID) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "nai-desk nd-message", children: "\u9009\u62E9\u4F7F\u7528 NAI5 \u63D0\u793A\u8BCD\u9884\u8BBE\u7684\u4F1A\u8BDD\u4EE5\u6253\u5F00\u8349\u7A3F\u3002" });
  if (!state.draft) return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nai-desk nd-message", role: "status", children: [
    state.error ?? "\u6B63\u5728\u52A0\u8F7D\u8349\u7A3F\u2026",
    state.error && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { onClick: () => client.refresh(), children: "\u91CD\u65B0\u52A0\u8F7D" })
  ] });
  const draft = state.draft;
  const busy = state.commandPending;
  const saveLabel = state.phase === "conflict" ? "\u5B58\u5728\u7248\u672C\u51B2\u7A81" : state.error ? "\u540C\u6B65\u5F02\u5E38" : state.phase === "saving" ? "\u6B63\u5728\u4FDD\u5B58\u2026" : state.pending ? "\u7B49\u5F85\u4FDD\u5B58\u2026" : "\u5DF2\u540C\u6B65";
  const removeCharacter = async (character, index) => {
    try {
      await client.command({ type: "remove_character", id: character.id });
      setRemoved({ character: structuredClone(character), index });
    } catch {
    }
  };
  const restoreCharacter = async () => {
    if (!removed) return;
    try {
      await client.command({ type: "add_character", character: removed.character, index: Math.min(removed.index, client.getSnapshot().draft.characters.length) });
      setRemoved(null);
    } catch {
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: `nai-desk${expanded ? " nd-expanded" : ""}`, onKeyDown: (event) => {
    if (event.key === "Escape" && expanded) {
      setExpanded(false);
      event.stopPropagation();
    }
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "nd-status", children: saveLabel }),
    state.error && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nd-error", role: "alert", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: state.error }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { onClick: () => state.pending ? client.flush().catch(() => {
      }) : client.refresh(), children: "\u91CD\u8BD5" })
    ] }),
    state.conflicts.map((conflict) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Conflict, { conflict, client }, conflict.field)),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nd-content", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "nd-base nd-card", "aria-label": "\u4E3B\u63D0\u793A\u8BCD\u4E0E\u8D1F\u9762\u63D0\u793A\u8BCD", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nd-editor-tools", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            PromptTabs,
            {
              id: tabsId,
              value: ui.baseTab,
              options: baseOptions,
              label: "\u4E3B\u63D0\u793A\u8BCD\u7C7B\u578B",
              onChange: (value) => setUi((previous) => ({ ...previous, baseTab: value }))
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconButton, { label: expanded ? "\u8FD8\u539F\u7F16\u8F91\u533A" : "\u5C55\u5F00\u7F16\u8F91\u533A", icon: expanded ? "restore" : "expand", "aria-pressed": expanded, onClick: () => setExpanded((value) => !value) })
        ] }),
        baseOptions.map((option) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "nd-prompt-panel", role: "tabpanel", id: `${tabsId}-${option.value}-panel`, "aria-labelledby": `${tabsId}-${option.value}`, hidden: ui.baseTab !== option.value, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PromptEditor, { client, field: option.value, value: draft[option.value], label: option.value === "main" ? "Base Prompt" : "\u603B\u8D1F\u9762 UC", rows: 6 }) }, option.value))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "nd-characters", "aria-label": "\u89D2\u8272\u63D0\u793A\u8BCD", hidden: expanded, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nd-section-label", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\u89D2\u8272\u63D0\u793A\u8BCD" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
            draft.characters.length,
            " \u4E2A\u89D2\u8272"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "nd-character-list", children: draft.characters.map((character, index) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Character, { character, index, count: draft.characters.length, client, ui, setUi, busy, onDelete: removeCharacter }, character.id)) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Button, { variant: "outline", size: "md", className: "nd-add", disabled: busy || draft.characters.length >= 22, onClick: () => client.command({ type: "add_character", character: {} }).catch(() => {
        }), children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { kind: "plus" }),
          "\u6DFB\u52A0\u89D2\u8272\u680F"
        ] })
      ] })
    ] }),
    removed && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nd-undo", role: "status", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
        "\u5DF2\u79FB\u9664 ",
        removed.character.name || "\u89D2\u8272\u680F"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { disabled: busy, onClick: restoreCharacter, children: "\u64A4\u9500" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "nd-footer", children: "\u8349\u7A3F\u6309\u4F1A\u8BDD\u4FDD\u5B58 \xB7 \u53EF\u624B\u52A8\u9009\u62E9\u6587\u672C" })
  ] });
}

// src/style.css
var style_default = '/* Controls adapted from dsh-v0.2.1-rc.5 ui-primitives (MIT, see NOTICE).\n * The host owns colors, fonts, radii, focus and elevation. No local palette.\n */\n.nai-desk {\n  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base); font: var(--dsw-font-s-14);\n  height: 100%; min-height: 0; min-width: 0; display: flex; flex-direction: column; overflow: auto; container-type: inline-size;\n}\n.nai-desk * { box-sizing: border-box; }\n.nai-desk [hidden] { display: none !important; }\n.nai-desk button, .nai-desk input, .nai-desk textarea { font-family: var(--dsw-font-family); }\n.nai-desk svg { flex: none; }\n\n/* Button: compact 28/R8, standard 36/R12, host ghost/outline states. */\n.nai-desk .nd-button {\n  display: inline-flex; align-items: center; justify-content: center; gap: 4px;\n  border: none; border-radius: var(--dsw-radius-md); cursor: pointer; font: var(--dsw-font-s-14);\n  color: var(--dsw-alias-label-primary); background: transparent; padding: 0 14px; flex-shrink: 0;\n}\n.nai-desk .nd-button-md { min-height: 36px; }\n.nai-desk .nd-button-sm { min-height: 28px; padding: 0 10px; border-radius: var(--dsw-radius-sm); font: var(--dsw-font-xxs-12); }\n.nai-desk .nd-button:disabled { cursor: not-allowed; opacity: .4; }\n.nai-desk .nd-button:active:not(:disabled) { background: var(--dsw-alias-interactive-bg-active); }\n.nai-desk .nd-button-outline { border: .5px solid var(--dsw-alias-border-l3); }\n.nai-desk .nd-icon { width: 28px; height: 28px; padding: 6px; color: var(--dsw-alias-label-secondary); }\n.nai-desk .nd-icon[aria-pressed="true"] { color: var(--dsw-alias-state-business-primary); background: var(--dsw-alias-button-ghost-active-fill); }\n.nai-desk button:focus-visible, .nai-desk textarea:focus-visible {\n  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: -2px;\n}\n.nai-desk .nd-status { padding: 12px 16px; color: var(--dsw-alias-label-tertiary); font: var(--dsw-font-xxs-12); }\n.nai-desk .nd-content { display: flex; flex-direction: column; gap: 20px; padding: 0 16px 12px; }\n.nai-desk .nd-card { background: var(--dsw-alias-bg-layer-1); border: .5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-lg); overflow: hidden; min-width: 0; }\n.nai-desk .nd-editor-tools { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 12px 12px 4px; }\n\n/* SegmentedControl: one indicator, equal tracks and roving keyboard focus. */\n.nai-desk .nd-tabs {\n  position: relative; display: inline-grid; grid-auto-flow: column; grid-auto-columns: 1fr;\n  gap: 2px; padding: 4px; border-radius: var(--dsw-radius-md); background: var(--dsw-alias-interactive-bg-hover); min-width: 0;\n}\n.nai-desk .nd-tab-indicator {\n  position: absolute; top: 4px; left: 4px;\n  width: calc((100% - 8px - 2px * (var(--nd-segment-count) - 1)) / var(--nd-segment-count));\n  height: calc(100% - 8px); border: 0; border-radius: var(--dsw-radius-sm);\n  background: var(--dsw-alias-bg-layer-1); box-shadow: var(--dsw-elevation-soft);\n  transform: translateX(calc(var(--nd-segment-index) * (100% + 2px)));\n  transition: transform 160ms var(--ds-ease-in-out); pointer-events: none;\n}\n.nai-desk .nd-tab {\n  position: relative; z-index: 1; height: 28px; padding: 0 16px; border: 0; border-radius: var(--dsw-radius-sm);\n  background: transparent; color: var(--dsw-alias-label-secondary); font: var(--dsw-font-xs-strong-13); white-space: nowrap; cursor: pointer;\n}\n.nai-desk .nd-tab[aria-selected="true"] { color: var(--dsw-alias-label-primary); }\n.nai-desk textarea {\n  display: block; width: 100%; min-width: 0; min-height: 120px; padding: 12px 16px 16px;\n  resize: vertical; color: var(--dsw-alias-label-primary); background: transparent; border: 0;\n  font-family: var(--dsw-font-family); font-size: var(--dsh-content-font-size, 14px); line-height: 1.65;\n}\n.nai-desk textarea::placeholder { color: var(--dsw-alias-label-dimmed); opacity: 1; }\n.nai-desk .nd-section-label { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; color: var(--dsw-alias-label-secondary); font: var(--dsw-font-xs-13); }\n.nai-desk .nd-section-label span:last-child { color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }\n.nai-desk .nd-character-list { display: grid; gap: 12px; }\n.nai-desk .nd-character-head { display: flex; align-items: center; gap: 6px; padding: 8px 12px; }\n.nai-desk .nd-gender { flex: none; color: var(--dsw-alias-label-tertiary); font: var(--dsw-font-s-14); }\n\n/* Input: H32/R12, shared outline and business-color focus. */\n.nai-desk .nd-name-field {\n  display: inline-flex; align-items: center; height: 32px; padding: 0 8px; min-width: 0; flex: 1;\n  border: .5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1);\n}\n.nai-desk .nd-name-field:focus-within { border-color: var(--dsw-alias-state-business-primary); }\n.nai-desk .nd-name { width: 100%; min-width: 0; border: none; outline: none; background: transparent; color: var(--dsw-alias-label-primary); font: var(--dsw-font-s-14); padding: 0; }\n.nai-desk .nd-character-actions { display: flex; flex-shrink: 0; gap: 2px; }\n.nai-desk .nd-character-body { border-top: .5px solid var(--dsw-alias-border-l4); }\n.nai-desk .nd-disabled .nd-name { text-decoration: line-through; color: var(--dsw-alias-label-tertiary); }\n.nai-desk .nd-add { width: 100%; margin-top: 12px; color: var(--dsw-alias-label-secondary); }\n.nai-desk .nd-footer { color: var(--dsw-alias-label-tertiary); font: var(--dsw-font-xxs-12); padding: 12px 16px; margin-top: auto; }\n.nai-desk .nd-undo, .nai-desk .nd-error { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; justify-content: space-between; margin: 0 16px 12px; padding: 8px 12px; border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); font: var(--dsw-font-xs-13); }\n.nai-desk .nd-error { color: var(--dsw-alias-state-error-primary); border: 1px solid var(--dsw-alias-state-error-secondary); }\n.nai-desk .nd-conflict { margin: 0 16px 12px; padding: 12px; border: 1px solid var(--dsw-alias-state-warn-secondary); border-radius: var(--dsw-radius-lg); background: var(--dsw-alias-bg-layer-1); }\n.nai-desk .nd-conflict strong { display: block; color: var(--dsw-alias-state-warn-label); font: var(--dsw-font-xs-strong-13); margin-bottom: 8px; }\n.nai-desk .nd-conflict label { display: block; font: var(--dsw-font-xxs-12); color: var(--dsw-alias-label-secondary); margin-block: 8px; }\n.nai-desk .nd-conflict textarea { border: .5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); margin-top: 4px; }\n.nai-desk .nd-conflict-actions { display: flex; gap: 8px; flex-wrap: wrap; }\n.nai-desk.nd-message { height: auto; padding: 20px 16px; gap: 12px; }\n.nai-desk.nd-expanded .nd-content { flex: 1; min-height: 300px; }\n.nai-desk.nd-expanded .nd-base { flex: 1; display: flex; flex-direction: column; }\n.nai-desk.nd-expanded .nd-prompt-panel { flex: 1; display: flex; min-height: 0; }\n.nai-desk.nd-expanded .nd-base textarea { flex: 1; min-height: 260px; resize: none; }\n@media (hover: hover) {\n  .nai-desk .nd-button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }\n  .nai-desk .nd-icon:hover:not(:disabled), .nai-desk .nd-tab:hover { color: var(--dsw-alias-label-primary); }\n}\n@container (max-width: 370px) {\n  .nai-desk .nd-character-head { flex-wrap: wrap; }\n  .nai-desk .nd-character-actions { margin-left: auto; }\n  .nai-desk .nd-name-field { flex-basis: calc(100% - 24px); }\n  .nai-desk .nd-content { padding-inline: 12px; }\n  .nai-desk .nd-tab { padding-inline: 12px; }\n}\n@media (pointer: coarse) {\n  .nai-desk .nd-button, .nai-desk .nd-tab { min-height: 44px; }\n  .nai-desk .nd-icon { width: 44px; min-height: 44px; }\n  .nai-desk .nd-character-head { flex-wrap: wrap; }\n  .nai-desk .nd-character-actions { width: 100%; justify-content: flex-end; }\n  .nai-desk textarea, .nai-desk .nd-name { font-size: max(16px, var(--dsh-content-font-size, 14px)); }\n}\n@media (prefers-reduced-motion: reduce) { .nai-desk .nd-tab-indicator { transition: none; } }\n';

// src/client.jsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var inject = ["slots", "sidebarRightTabs", "sessions", "uiSession"];
function apply(ctx) {
  const clients = /* @__PURE__ */ new Map();
  const watchers = /* @__PURE__ */ new Map();
  const getClient = (id) => {
    if (!clients.has(id)) {
      const client = new DeskClient({ sessionId: id, request: requestDraft });
      client.pause();
      clients.set(id, client);
    }
    return clients.get(id);
  };
  const acquireClient = (id) => {
    const client = getClient(id);
    watchers.set(id, (watchers.get(id) ?? 0) + 1);
    client.resume();
    client.start();
    return () => {
      const count = Math.max(0, (watchers.get(id) ?? 1) - 1);
      watchers.set(id, count);
      if (!count) client.pause();
    };
  };
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = PANEL_ID;
    style.textContent = style_default;
    document.head.append(style);
    return () => style.remove();
  }, "nai-desk: styles");
  ctx.effect(() => {
    const current = ctx.uiSession.adapter.current;
    const list = ctx.sessions.list;
    let unregister;
    const sync = () => {
      const id = current.getSnapshot().key;
      const eligible = list.getSnapshot().byId[id]?.projectionValues?.agentPreset === PRESET_ID;
      if (eligible && !unregister) unregister = ctx.sidebarRightTabs.register({
        id: PANEL_ID,
        kind: PANEL_KIND,
        keepMounted: true,
        priority: "extension",
        title: () => "\u63D0\u793A\u8BCD\u7A3F\u7EB8",
        guide: [{ id: "open", order: 45, title: () => "\u63D0\u793A\u8BCD\u7A3F\u7EB8", description: () => "\u7F16\u8F91\u5F53\u524D\u4F1A\u8BDD\u7684\u63D0\u793A\u8BCD\u8349\u7A3F", icon: () => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { kind: "notebook" }) }]
      });
      else if (!eligible && unregister) {
        unregister();
        unregister = void 0;
      }
    };
    const offCurrent = current.subscribe(sync), offList = list.subscribe(sync);
    sync();
    return () => {
      offCurrent();
      offList();
      unregister?.();
    };
  }, "nai-desk: NAI5 tab availability");
  ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
    name: "sidebar.right.pane.tab",
    key: PANEL_ID,
    inject: (sessionId) => ({ sessionId, sessionList: ctx.sessions.list, getClient, acquireClient })
  }, Panel));
  ctx.effect(() => {
    const beforeUnload = (event) => {
      if ([...clients.values()].some((client) => client.getSnapshot().pending > 0)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    if (typeof window.addEventListener === "function") window.addEventListener("beforeunload", beforeUnload);
    return () => {
      if (typeof window.removeEventListener === "function") window.removeEventListener("beforeunload", beforeUnload);
      for (const client of clients.values()) client.close();
      clients.clear();
      watchers.clear();
    };
  }, "nai-desk: clients");
}

return module.exports;}});
