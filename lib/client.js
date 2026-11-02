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
function ToolButton({ label, title, children, className = "", ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: `nd-tool ${className}`, "aria-label": label, title: title ?? label, ...props, children });
}
function Switch({ checked, onChange, label, title, disabled = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      role: "switch",
      className: "nd-switch",
      "aria-checked": checked,
      "aria-label": label,
      title,
      disabled,
      onClick: () => onChange(!checked),
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "nd-switch-thumb" })
    }
  );
}
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
var icons = { chevronUp: IconChevronUpOutlineArtwork, chevronDown: IconChevronDownOutlineArtwork, trash: IconTrashOutlineArtwork, expand: IconFullscreenOutlineArtwork, plus: IconPlusOutlineArtwork };
function HostIcon({ kind }) {
  const Component = icons[kind];
  return Component ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Component, { size: 16, strokeWidth: 1 }) : null;
}

// src/panel.jsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var glyphs = {
  up: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M8 13.5V2.5M3.5 7 8 2.5 12.5 7", stroke: "currentColor" }),
  down: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M8 2.5v11M3.5 9 8 13.5 12.5 9", stroke: "currentColor" }),
  notebook: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M4 1.5h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z", stroke: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M5.5 5h5M5.5 8h5M5.5 11h3", stroke: "currentColor" })
  ] }),
  female: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "8", cy: "5.5", r: "3.5", stroke: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M8 9v6M5 12.5h6", stroke: "currentColor" })
  ] }),
  male: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "6.5", cy: "9.5", r: "3.5", stroke: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M9 7l5-5M10 2h4v4", stroke: "currentColor" })
  ] }),
  person: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "8", cy: "5.5", r: "2.75", stroke: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M2.75 14c0-2.9 2.35-4.75 5.25-4.75s5.25 1.85 5.25 4.75", stroke: "currentColor" })
  ] })
};
function Icon({ kind }) {
  if (!glyphs[kind]) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(HostIcon, { kind });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { viewBox: "0 0 16 16", width: "16", height: "16", fill: "none", strokeWidth: "1", "aria-hidden": "true", children: glyphs[kind] });
}
function TabTitle() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "nd-tab-title-icon", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { kind: "notebook" }) }),
    "\u7A3F\u7EB8"
  ] });
}
var baseOptions = [{ value: "main", label: "Base Prompt" }, { value: "uc", label: "UC", title: "\u603B\u8D1F\u9762\u63D0\u793A\u8BCD" }];
var characterOptions = [{ value: "prompt", label: "Prompt" }, { value: "uc", label: "UC", title: "\u89D2\u8272\u8D1F\u9762\u63D0\u793A\u8BCD" }];
function PromptEditor({ client, field, value, label }) {
  const composing = (0, import_react3.useRef)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "textarea",
    {
      className: "nd-editor",
      "aria-label": label,
      value,
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
function genderOf(prompt) {
  if (/(?:^|[\s,])(?:1?girl|female)(?:[\s,]|$)/i.test(prompt)) return "female";
  if (/(?:^|[\s,])(?:1?boy|male)(?:[\s,]|$)/i.test(prompt)) return "male";
  return "person";
}
function Character({ character, index, count, client, ui, setUi, busy, onDelete }) {
  const tabsId = (0, import_react3.useId)();
  const id = character.id;
  const collapsed = ui.collapsed[id] === true;
  const tab = ui.tabs[id] === "uc" ? "uc" : "prompt";
  const run = (operation) => client.command(operation).catch(() => {
  });
  const n = index + 1;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: `nd-card nd-character${character.enabled ? "" : " nd-disabled"}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nd-card-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "nd-gender", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { kind: genderOf(character.prompt) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "input",
        {
          "aria-label": `\u89D2\u8272 ${n} \u540D\u79F0`,
          className: "nd-name",
          value: character.name,
          maxLength: 128,
          placeholder: `\u89D2\u8272 ${n}`,
          onChange: (event) => client.edit(`character:${id}:name`, event.currentTarget.value),
          onBlur: () => client.flush().catch(() => {
          })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nd-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          Switch,
          {
            checked: character.enabled,
            label: `\u542F\u7528\u89D2\u8272 ${n}`,
            title: character.enabled ? `\u505C\u7528\u89D2\u8272 ${n}` : `\u542F\u7528\u89D2\u8272 ${n}`,
            disabled: busy,
            onChange: (enabled) => run({ type: "set_character", id, patch: { enabled } })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ToolButton, { label: `\u4E0A\u79FB\u89D2\u8272 ${n}`, disabled: busy || index === 0, onClick: () => run({ type: "move_character", id, index: index - 1 }), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { kind: "up" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ToolButton, { label: `\u4E0B\u79FB\u89D2\u8272 ${n}`, disabled: busy || index === count - 1, onClick: () => run({ type: "move_character", id, index: index + 1 }), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { kind: "down" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ToolButton, { label: `\u5220\u9664\u89D2\u8272 ${n}`, className: "nd-tool-danger", disabled: busy, onClick: () => onDelete(character, index), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { kind: "trash" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          ToolButton,
          {
            label: `${collapsed ? "\u5C55\u5F00" : "\u6536\u8D77"}\u89D2\u8272 ${n}`,
            "aria-expanded": !collapsed,
            "aria-controls": `nd-character-${id}`,
            onClick: () => setUi((previous) => ({ ...previous, collapsed: { ...previous.collapsed, [id]: !collapsed } })),
            children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { kind: collapsed ? "chevronDown" : "chevronUp" })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nd-card-body", id: `nd-character-${id}`, hidden: collapsed, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        PromptTabs,
        {
          id: tabsId,
          value: tab,
          options: characterOptions,
          label: `\u89D2\u8272 ${n} \u63D0\u793A\u8BCD\u7C7B\u578B`,
          onChange: (value) => setUi((previous) => ({ ...previous, tabs: { ...previous.tabs, [id]: value } }))
        }
      ),
      characterOptions.map((option) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "nd-prompt-panel", role: "tabpanel", id: `${tabsId}-${option.value}-panel`, "aria-labelledby": `${tabsId}-${option.value}`, hidden: tab !== option.value, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PromptEditor, { client, field: `character:${id}:${option.value}`, value: character[option.value], label: `\u89D2\u8272 ${n} ${option.value === "prompt" ? "\u6B63\u5411\u63D0\u793A\u8BCD" : "UC"}` }) }, option.value))
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
      !conflict.deleted && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { variant: "outline", onClick: () => client.resolveConflict(conflict.field, "local", conflict.revision).catch(() => {
      }), children: "\u4FDD\u7559\u6211\u7684\u4FEE\u6539" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { variant: "outline", onClick: () => client.resolveConflict(conflict.field, "remote", conflict.revision).catch(() => {
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
    state.error && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { variant: "outline", onClick: () => client.refresh(), children: "\u91CD\u65B0\u52A0\u8F7D" })
  ] });
  const draft = state.draft;
  const busy = state.commandPending;
  const [saveLabel, tone] = state.phase === "conflict" ? ["\u5B58\u5728\u7248\u672C\u51B2\u7A81", "warn"] : state.error ? ["\u540C\u6B65\u5F02\u5E38", "error"] : state.phase === "saving" ? ["\u6B63\u5728\u4FDD\u5B58\u2026", ""] : state.pending ? ["\u7B49\u5F85\u4FDD\u5B58\u2026", ""] : ["\u5DF2\u540C\u6B65", ""];
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
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("header", { className: "nd-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "nd-status", "data-tone": tone || void 0, role: "status", children: saveLabel }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ToolButton, { label: expanded ? "\u8FD8\u539F\u7F16\u8F91\u533A" : "\u5C55\u5F00\u7F16\u8F91\u533A", "aria-pressed": expanded, onClick: () => setExpanded((value) => !value), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { kind: "expand" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nd-body", children: [
      state.error && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nd-error", role: "alert", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: state.error }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { onClick: () => state.pending ? client.flush().catch(() => {
        }) : client.refresh(), children: "\u91CD\u8BD5" })
      ] }),
      state.conflicts.map((conflict) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Conflict, { conflict, client }, conflict.field)),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "nd-card nd-base", "aria-label": "\u4E3B\u63D0\u793A\u8BCD\u4E0E\u8D1F\u9762\u63D0\u793A\u8BCD", children: [
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
        baseOptions.map((option) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "nd-prompt-panel", role: "tabpanel", id: `${tabsId}-${option.value}-panel`, "aria-labelledby": `${tabsId}-${option.value}`, hidden: ui.baseTab !== option.value, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PromptEditor, { client, field: option.value, value: draft[option.value], label: option.value === "main" ? "Base Prompt" : "\u603B\u8D1F\u9762 UC" }) }, option.value))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "nd-characters", "aria-label": "\u89D2\u8272\u63D0\u793A\u8BCD", hidden: expanded, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("h2", { className: "nd-section-label", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\u89D2\u8272" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: draft.characters.length })
        ] }),
        draft.characters.map((character, index) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Character, { character, index, count: draft.characters.length, client, ui, setUi, busy, onDelete: removeCharacter }, character.id)),
        removed && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nd-notice", role: "status", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
            "\u5DF2\u79FB\u9664",
            removed.character.name ? `\u300C${removed.character.name}\u300D` : "\u89D2\u8272\u680F"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { disabled: busy, onClick: restoreCharacter, children: "\u64A4\u9500" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("button", { type: "button", className: "nd-creator", disabled: busy || draft.characters.length >= 22, onClick: () => client.command({ type: "add_character", character: {} }).catch(() => {
        }), children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { kind: "plus" }),
          "\u6DFB\u52A0\u89D2\u8272\u680F"
        ] })
      ] })
    ] })
  ] });
}

// src/style.css
var style_default = `/* Layout follows the host's own sidebar pages; controls are adapted from
 * dsh-v0.2.1-rc.5 ui-primitives (MIT, see NOTICE).
 * - Panel frame: the Workspace files tab (38px header, hairline seam, 28px tools).
 * - Cards: the settings-card material (R20, 0.5px stroke, no shadow); elevation
 *   is reserved for floating surfaces and the composer.
 * - Add row: the Models page dashed "add" button.
 * The host owns colors, fonts, radii and focus. No local palette.
 */
.nai-desk {
  height: 100%; min-height: 0; min-width: 0; display: flex; flex-direction: column; container-type: inline-size;
  color: var(--dsw-alias-label-primary); font-family: var(--dsw-font-family);
  font-size: var(--dsh-content-font-size-secondary, 13px); line-height: 1.5;
}
.nai-desk * { box-sizing: border-box; }
.nai-desk [hidden] { display: none !important; }
.nai-desk button, .nai-desk input, .nai-desk textarea { font-family: inherit; }
.nai-desk svg { flex: none; }
.nd-tab-title-icon { display: inline-flex; flex: none; color: var(--dsw-alias-label-secondary); }

/* Header: same frame as the Workspace files tab, so its seam lines up with the conversation header. */
.nai-desk .nd-header {
  flex: none; display: flex; align-items: center; gap: 4px; height: 38px; padding: 0 6px 0 16px;
  border-bottom: .5px solid var(--dsw-alias-border-l3);
}
.nai-desk .nd-status { margin-right: auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.nai-desk .nd-status[data-tone="error"] { color: var(--dsw-alias-state-error-primary); }
.nai-desk .nd-status[data-tone="warn"] { color: var(--dsw-alias-state-warn-label); }
.nai-desk .nd-tool {
  display: inline-flex; align-items: center; justify-content: center; flex: none; width: 28px; height: 28px; padding: 6px;
  border: 0; border-radius: var(--dsw-radius-sm); background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; line-height: 1;
}
.nai-desk .nd-tool[aria-pressed="true"] { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
.nai-desk .nd-tool:disabled { opacity: .4; cursor: default; }

.nai-desk .nd-body { flex: 1 1 auto; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 12px; padding: 12px 16px 16px; }

/* Settings-card material: the host's independent content card. */
.nai-desk .nd-card {
  display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 12px;
  border: .5px solid var(--dsw-alias-settings-card-stroke); border-radius: var(--dsw-radius-xl); background: var(--dsw-alias-settings-card-fill);
}
.nai-desk .nd-card:has(.nd-editor:focus) { border-color: var(--dsw-alias-state-business-primary); }
.nai-desk .nd-card-head { display: flex; align-items: center; gap: 6px; min-height: 28px; min-width: 0; }
.nai-desk .nd-card-body { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.nai-desk .nd-editor {
  display: block; width: 100%; min-width: 0; margin: 0; padding: 0 2px; border: 0; outline: none; resize: none;
  background: transparent; color: var(--dsw-alias-label-primary);
  font-size: var(--dsh-content-font-size, 14px); line-height: 1.6;
  field-sizing: content; min-height: 3lh; max-height: 18lh; overflow-y: auto;
}
.nai-desk .nd-base .nd-editor { min-height: 5lh; }
.nai-desk .nd-editor::placeholder { color: var(--dsw-alias-label-caption); opacity: 1; }

/* SegmentedControl: one indicator, equal tracks and roving keyboard focus. */
.nai-desk .nd-tabs {
  position: relative; align-self: flex-start; display: inline-grid; grid-auto-flow: column; grid-auto-columns: 1fr;
  gap: 2px; padding: 4px; border-radius: var(--dsw-radius-md); background: var(--dsw-alias-interactive-bg-hover); min-width: 0;
}
.nai-desk .nd-tab-indicator {
  position: absolute; top: 4px; left: 4px;
  width: calc((100% - 8px - 2px * (var(--nd-segment-count) - 1)) / var(--nd-segment-count));
  height: calc(100% - 8px); border: 0; border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-1); box-shadow: var(--dsw-elevation-soft);
  transform: translateX(calc(var(--nd-segment-index) * (100% + 2px)));
  transition: transform 160ms var(--ds-ease-in-out); pointer-events: none;
}
.nai-desk .nd-tab {
  position: relative; z-index: 1; height: 28px; padding: 0 16px; border: 0; border-radius: var(--dsw-radius-sm);
  background: transparent; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; font-weight: 500; white-space: nowrap; cursor: pointer;
}
.nai-desk .nd-tab[aria-selected="true"] { color: var(--dsw-alias-label-primary); }

/* Characters: settings rows with an inline-editable name. */
.nai-desk .nd-characters { display: flex; flex-direction: column; gap: 12px; }
.nai-desk .nd-section-label {
  display: flex; align-items: baseline; gap: 6px; margin: 4px 2px 0;
  color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; font-weight: 500;
}
.nai-desk .nd-section-label span:last-child { color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }
.nai-desk .nd-gender { display: inline-flex; flex: none; padding-left: 2px; color: var(--dsw-alias-label-tertiary); }
.nai-desk .nd-name {
  flex: 1 1 auto; min-width: 0; height: 28px; padding: 0 6px; border: .5px solid transparent; border-radius: var(--dsw-radius-sm);
  outline: none; background: transparent; color: var(--dsw-alias-label-primary); font-size: 14px; line-height: 22px; font-weight: 500;
  text-overflow: ellipsis;
}
.nai-desk .nd-name::placeholder { color: var(--dsw-alias-label-caption); opacity: 1; }
.nai-desk .nd-name:focus { border-color: var(--dsw-alias-state-business-primary); }
.nai-desk .nd-actions { display: flex; align-items: center; gap: 2px; flex: none; }
.nai-desk .nd-actions .nd-switch { margin-right: 6px; }
.nai-desk .nd-disabled .nd-name, .nai-desk .nd-disabled .nd-gender { color: var(--dsw-alias-label-tertiary); }
.nai-desk .nd-disabled .nd-card-body { opacity: .5; }

/* Switch: 36\xD720 capsule; the state lives in aria-checked. */
.nai-desk .nd-switch {
  position: relative; flex: 0 0 auto; width: 36px; height: 20px; padding: 2px; border: 0;
  border-radius: 999px; corner-shape: round; background: var(--dsw-alias-border-l3); cursor: pointer;
}
.nai-desk .nd-switch[aria-checked="true"] { background: var(--dsw-alias-brand-primary); }
.nai-desk .nd-switch:disabled { cursor: default; opacity: .5; }
.nai-desk .nd-switch-thumb {
  display: block; width: 16px; height: 16px; border-radius: 50%; corner-shape: round;
  background: var(--dsw-alias-label-primary-foreground); transition: transform 120ms ease;
}
.nai-desk .nd-switch[aria-checked="false"] .nd-switch-thumb { background: var(--dsw-alias-switch-thumb); }
.nai-desk .nd-switch[aria-checked="true"] .nd-switch-thumb { transform: translateX(16px); }

/* Dashed add row, as on the Models settings page. */
.nai-desk .nd-creator {
  display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; height: 44px; padding: 0 16px;
  border: 1px dashed var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-lg); background: transparent;
  color: var(--dsw-alias-label-primary); font-size: 14px; line-height: 20px; cursor: pointer;
}
.nai-desk .nd-creator:disabled { opacity: .4; cursor: default; }

/* Button: compact 28/R8, standard 36/R12. */
.nai-desk .nd-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px; flex-shrink: 0; padding: 0 14px;
  border: none; border-radius: var(--dsw-radius-md); background: transparent; color: var(--dsw-alias-label-primary); cursor: pointer;
}
.nai-desk .nd-button-md { height: 36px; font-size: 14px; line-height: 20px; }
.nai-desk .nd-button-sm { height: 28px; padding: 0 10px; border-radius: var(--dsw-radius-sm); font-size: 12px; line-height: 18px; }
.nai-desk .nd-button-outline { border: .5px solid var(--dsw-alias-border-l3); }
.nai-desk .nd-button:disabled { opacity: .4; cursor: default; }
.nai-desk .nd-button:active:not(:disabled) { background: var(--dsw-alias-interactive-bg-active); }

/* Notices: undo row, error note and conflict card use the host's state materials. */
.nai-desk .nd-notice, .nai-desk .nd-error {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
  padding: 4px 4px 4px 12px; border-radius: var(--dsw-radius-md); font-size: 13px; line-height: 20px;
}
.nai-desk .nd-notice { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }
.nai-desk .nd-error { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent); color: var(--dsw-alias-state-error-primary); overflow-wrap: anywhere; }
.nai-desk .nd-conflict {
  display: flex; flex-direction: column; gap: 8px; padding: 12px 14px;
  border: .5px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 40%, transparent); border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-state-warn-tertiary);
}
.nai-desk .nd-conflict strong { color: var(--dsw-alias-state-warn-label); font-size: 13px; line-height: 20px; font-weight: 500; }
.nai-desk .nd-conflict p { margin: 0; color: var(--dsw-alias-label-secondary); }
.nai-desk .nd-conflict label { display: flex; flex-direction: column; gap: 4px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.nai-desk .nd-conflict textarea {
  width: 100%; max-height: 127px; padding: 3px 8px; resize: none; field-sizing: content; outline: none;
  border: .5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px;
}
.nai-desk .nd-conflict-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }

.nai-desk.nd-message { height: auto; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 12px 16px; color: var(--dsw-alias-label-secondary); line-height: 1.6; }

/* Full-column editing: the base card takes the whole body. */
.nai-desk.nd-expanded .nd-base { flex: 1 1 auto; min-height: 300px; }
.nai-desk.nd-expanded .nd-base .nd-prompt-panel { flex: 1 1 auto; display: flex; min-height: 0; }
.nai-desk.nd-expanded .nd-base .nd-editor { flex: 1 1 auto; height: auto; max-height: none; }

.nai-desk .nd-tool:focus-visible, .nai-desk .nd-button:focus-visible, .nai-desk .nd-tab:focus-visible, .nai-desk .nd-creator:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: -2px;
}
.nai-desk .nd-switch:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px; }
@media (hover: hover) {
  .nai-desk .nd-tool:hover:not(:disabled) { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
  .nai-desk .nd-tool-danger:hover:not(:disabled) { color: var(--dsw-alias-state-error-primary); background: var(--dsw-alias-interactive-bg-hover-danger); }
  .nai-desk .nd-button:hover:not(:disabled), .nai-desk .nd-creator:hover:not(:disabled), .nai-desk .nd-name:hover:not(:focus) { background: var(--dsw-alias-interactive-bg-hover); }
  .nai-desk .nd-tab:hover { color: var(--dsw-alias-label-primary); }
}
@container (max-width: 370px) {
  .nai-desk .nd-body { padding-inline: 12px; }
  .nai-desk .nd-character .nd-card-head { flex-wrap: wrap; }
  .nai-desk .nd-name { flex-basis: calc(100% - 26px); }
  .nai-desk .nd-actions { margin-left: auto; }
  .nai-desk .nd-tab { padding-inline: 12px; }
}
@media (pointer: coarse) {
  .nai-desk .nd-button, .nai-desk .nd-tab, .nai-desk .nd-name { min-height: 44px; }
  .nai-desk .nd-tool { width: 44px; height: 44px; }
  .nai-desk .nd-character .nd-card-head { flex-wrap: wrap; }
  .nai-desk .nd-actions { width: 100%; justify-content: flex-end; }
  .nai-desk .nd-editor, .nai-desk .nd-name { font-size: max(16px, var(--dsh-content-font-size, 14px)); }
}
@media (prefers-reduced-motion: reduce) { .nai-desk .nd-tab-indicator, .nai-desk .nd-switch-thumb { transition: none; } }
`;

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
        title: () => "\u7A3F\u7EB8",
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
  ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
    name: "sidebar.right.pane.tab.title",
    key: PANEL_ID,
    inject: (sessionId) => ({ sessionId })
  }, TabTitle));
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
