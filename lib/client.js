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
var import_react2 = __toESM(require("react"), 1);

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
var import_react = __toESM(require("react"), 1);
var import_jsx_runtime = require("react/jsx-runtime");
function Icon({ kind }) {
  const paths = {
    up: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m6 14 6-6 6 6" }),
    down: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m6 10 6 6 6-6" }),
    check: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m5 12 4 4L19 6" }),
    minus: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5 12h14" }),
    trash: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 10v7M14 10v7" }) }),
    expand: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" }),
    restore: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 8h5V3M21 8h-5V3M8 21v-5H3M16 21v-5h5" }),
    fold: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m7 3 5 5 5-5M7 21l5-5 5 5M5 12h14" }),
    unfold: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m7 8 5-5 5 5M7 16l5 5 5-5M5 12h14" }),
    plus: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 4v16M4 12h16" }),
    notebook: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M7 3h13v18H7zM3 7h6M3 12h6M3 17h6M12 8h4M12 12h4" }) })
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: paths[kind] });
}
function IconButton({ label, icon, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "nd-icon", title: label, "aria-label": label, ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { kind: icon }) });
}
function PromptEditor({ client, field, value, label, rows = 5 }) {
  const composing = (0, import_react.useRef)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
  const id = character.id;
  const collapsed = ui.collapsed[id] === true;
  const tab = ui.tabs[id] === "uc" ? "uc" : "prompt";
  const run = (operation) => client.command(operation).catch(() => {
  });
  const gender = /(?:^|[\s,])(?:1?girl|female)(?:[\s,]|$)/i.test(character.prompt) ? "\u2640" : /(?:^|[\s,])(?:1?boy|male)(?:[\s,]|$)/i.test(character.prompt) ? "\u2642" : "\u25CB";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: `nd-card nd-character${character.enabled ? "" : " nd-disabled"}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "nd-character-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "nd-gender", "aria-hidden": "true", children: gender }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "nd-character-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconButton, { label: `\u4E0A\u79FB\u89D2\u8272 ${index + 1}`, icon: "up", disabled: busy || index === 0, onClick: () => run({ type: "move_character", id, index: index - 1 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconButton, { label: `\u4E0B\u79FB\u89D2\u8272 ${index + 1}`, icon: "down", disabled: busy || index === count - 1, onClick: () => run({ type: "move_character", id, index: index + 1 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconButton, { label: `\u542F\u7528\u89D2\u8272 ${index + 1} \u7684\u63D0\u793A\u8BCD`, title: `${character.enabled ? "\u505C\u7528" : "\u542F\u7528"}\u89D2\u8272 ${index + 1} \u7684\u63D0\u793A\u8BCD`, icon: character.enabled ? "check" : "minus", "aria-pressed": character.enabled, disabled: busy, onClick: () => run({ type: "set_character", id, patch: { enabled: !character.enabled } }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconButton, { label: `\u5220\u9664\u89D2\u8272 ${index + 1}`, icon: "trash", disabled: busy, onClick: () => onDelete(character, index) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconButton, { label: `${collapsed ? "\u5C55\u5F00" : "\u6536\u8D77"}\u89D2\u8272 ${index + 1}`, icon: collapsed ? "unfold" : "fold", "aria-expanded": !collapsed, "aria-controls": `nd-character-${id}`, onClick: () => setUi((previous) => ({ ...previous, collapsed: { ...previous.collapsed, [id]: !collapsed } })) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "nd-character-body", id: `nd-character-${id}`, hidden: collapsed, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "nd-editor-tools", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "nd-tabs", role: "group", "aria-label": `\u89D2\u8272 ${index + 1} \u63D0\u793A\u8BCD\u7C7B\u578B`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "aria-pressed": tab === "prompt", onClick: () => setUi((previous) => ({ ...previous, tabs: { ...previous.tabs, [id]: "prompt" } })), children: "Prompt" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "aria-pressed": tab === "uc", title: "\u89D2\u8272\u8D1F\u9762\u63D0\u793A\u8BCD", onClick: () => setUi((previous) => ({ ...previous, tabs: { ...previous.tabs, [id]: "uc" } })), children: "UC" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PromptEditor, { client, field: `character:${id}:${tab}`, value: character[tab], label: `\u89D2\u8272 ${index + 1} ${tab === "prompt" ? "\u6B63\u5411\u63D0\u793A\u8BCD" : "UC"}` })
    ] })
  ] });
}
function Conflict({ conflict, client }) {
  const label = conflict.field === "main" ? "\u4E3B\u63D0\u793A\u8BCD" : conflict.field === "uc" ? "\u8349\u7A3F\u7EA7 UC" : conflict.field.endsWith(":name") ? "\u89D2\u8272\u540D\u79F0" : conflict.field.endsWith(":uc") ? "\u89D2\u8272\u7EA7 UC" : "\u89D2\u8272\u63D0\u793A\u8BCD";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "nd-conflict", role: "alert", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: conflict.deleted ? "\u8349\u7A3F\u4E2D\u7684\u8BE5\u89D2\u8272\u63D0\u793A\u8BCD\u5DF2\u5220\u9664" : `${label}\u5B58\u5728\u7248\u672C\u51B2\u7A81` }),
    conflict.notice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: conflict.notice }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
      "\u672A\u4FDD\u5B58\u7684\u672C\u5730\u5185\u5BB9",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { readOnly: true, value: conflict.local, rows: 3 })
    ] }),
    !conflict.deleted && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
      "\u5F53\u524D\u5DF2\u4FDD\u5B58\u5185\u5BB9",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { readOnly: true, value: conflict.remote ?? "", rows: 3 })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "nd-conflict-actions", children: [
      !conflict.deleted && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => client.resolveConflict(conflict.field, "local", conflict.revision).catch(() => {
      }), children: "\u4FDD\u7559\u6211\u7684\u4FEE\u6539" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => client.resolveConflict(conflict.field, "remote", conflict.revision).catch(() => {
      }), children: conflict.deleted ? "\u653E\u5F03\u8FD9\u6BB5\u672A\u4FDD\u5B58\u5185\u5BB9" : "\u4F7F\u7528\u5DF2\u4FDD\u5B58\u7248\u672C" })
    ] })
  ] });
}
function Panel(props) {
  if (typeof props.sessionId !== "string") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "nai-desk nd-message", children: "\u9009\u62E9\u4E00\u4E2A NAI5 \u63D0\u793A\u8BCD\u4F1A\u8BDD\u4EE5\u6253\u5F00\u8349\u7A3F\u3002" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionPanel, { ...props }, props.sessionId);
}
function SessionPanel({ sessionId, sessionList, getClient, acquireClient, useTabInfo }) {
  const presetSnapshot = (0, import_react.useCallback)(() => sessionList.getSnapshot().byId[sessionId]?.projectionValues?.agentPreset, [sessionList, sessionId]);
  const preset = (0, import_react.useSyncExternalStore)(sessionList.subscribe, presetSnapshot, presetSnapshot);
  const client = (0, import_react.useMemo)(() => getClient(sessionId), [getClient, sessionId]);
  const state = (0, import_react.useSyncExternalStore)(client.subscribe, client.getSnapshot, client.getSnapshot);
  const tabInfo = useTabInfo?.();
  const visible = tabInfo?.tab?.visible !== false;
  const [ui, setUi] = (0, import_react.useState)(() => readUi(sessionId));
  const [expanded, setExpanded] = (0, import_react.useState)(false);
  const [removed, setRemoved] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    if (preset !== PRESET_ID || !visible) return;
    return acquireClient(sessionId);
  }, [preset, visible, acquireClient, sessionId]);
  (0, import_react.useEffect)(() => {
    try {
      localStorage.setItem(`dsh.nai-desk.ui.v1.${sessionId}`, JSON.stringify(ui));
    } catch {
    }
  }, [sessionId, ui]);
  if (preset !== PRESET_ID) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "nai-desk nd-message", children: "\u9009\u62E9\u4F7F\u7528 NAI5 \u63D0\u793A\u8BCD\u9884\u8BBE\u7684\u4F1A\u8BDD\u4EE5\u6253\u5F00\u8349\u7A3F\u3002" });
  if (!state.draft) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "nai-desk nd-message", role: "status", children: [
    state.error ?? "\u6B63\u5728\u52A0\u8F7D\u8349\u7A3F\u2026",
    state.error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => client.refresh(), children: "\u91CD\u65B0\u52A0\u8F7D" })
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `nai-desk${expanded ? " nd-expanded" : ""}`, onKeyDown: (event) => {
    if (event.key === "Escape" && expanded) {
      setExpanded(false);
      event.stopPropagation();
    }
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "nd-status", children: saveLabel }),
    state.error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "nd-error", role: "alert", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: state.error }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => state.pending ? client.flush().catch(() => {
      }) : client.refresh(), children: "\u91CD\u8BD5" })
    ] }),
    state.conflicts.map((conflict) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Conflict, { conflict, client }, conflict.field)),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "nd-content", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "nd-base nd-card", "aria-label": "\u4E3B\u63D0\u793A\u8BCD\u4E0E\u8D1F\u9762\u63D0\u793A\u8BCD", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "nd-editor-tools", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "nd-tabs", role: "group", "aria-label": "\u4E3B\u63D0\u793A\u8BCD\u7C7B\u578B", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "aria-pressed": ui.baseTab === "main", onClick: () => setUi((previous) => ({ ...previous, baseTab: "main" })), children: "Base Prompt" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "aria-pressed": ui.baseTab === "uc", title: "\u603B\u8D1F\u9762\u63D0\u793A\u8BCD", onClick: () => setUi((previous) => ({ ...previous, baseTab: "uc" })), children: "UC" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconButton, { label: expanded ? "\u8FD8\u539F\u7F16\u8F91\u533A" : "\u5C55\u5F00\u7F16\u8F91\u533A", icon: expanded ? "restore" : "expand", "aria-pressed": expanded, onClick: () => setExpanded((value) => !value) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PromptEditor, { client, field: ui.baseTab, value: draft[ui.baseTab], label: ui.baseTab === "main" ? "Base Prompt" : "\u603B\u8D1F\u9762 UC", rows: 6 }, ui.baseTab)
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "nd-characters", "aria-label": "\u89D2\u8272\u63D0\u793A\u8BCD", hidden: expanded, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "nd-section-label", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u89D2\u8272\u63D0\u793A\u8BCD" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            draft.characters.length,
            " \u4E2A\u89D2\u8272"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "nd-character-list", children: draft.characters.map((character, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Character, { character, index, count: draft.characters.length, client, ui, setUi, busy, onDelete: removeCharacter }, character.id)) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: "nd-add", disabled: busy || draft.characters.length >= 22, onClick: () => client.command({ type: "add_character", character: {} }).catch(() => {
        }), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { kind: "plus" }),
          "\u6DFB\u52A0\u89D2\u8272\u680F"
        ] })
      ] })
    ] }),
    removed && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "nd-undo", role: "status", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u5DF2\u79FB\u9664 ",
        removed.character.name || "\u89D2\u8272\u680F"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: busy, onClick: restoreCharacter, children: "\u64A4\u9500" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "nd-footer", children: "\u8349\u7A3F\u6309\u4F1A\u8BDD\u4FDD\u5B58 \xB7 \u53EF\u624B\u52A8\u9009\u62E9\u6587\u672C" })
  ] });
}

// src/style.css
var style_default = '.nai-desk {\n  --nd-ink: var(--dsw-alias-label-primary, light-dark(#252525, #eee));\n  --nd-muted: var(--dsw-alias-label-secondary, light-dark(#646464, #aaa));\n  --nd-paper: var(--dsw-alias-bg-layer-1, light-dark(#fff, #202020));\n  --nd-field: light-dark(#fafafa, #191919);\n  --nd-bar: light-dark(#f4f4f4, #252525);\n  --nd-line: var(--dsw-alias-border-l3, light-dark(#dedede, #3b3b3b));\n  --nd-selected: var(--dsw-alias-interactive-bg-hover, light-dark(#e8e8e8, #393939));\n  color: var(--nd-ink); background: var(--nd-paper); font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n  height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: auto; container-type: inline-size;\n}\n.nai-desk * { box-sizing: border-box; }\n.nai-desk [hidden] { display: none !important; }\n.nai-desk button { font: inherit; font-size: 13px; color: var(--nd-muted); background: transparent; border: 0; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 6px 9px; min-height: 32px; cursor: pointer; }\n.nai-desk button:hover:not(:disabled) { color: var(--nd-ink); background: var(--nd-selected); }\n.nai-desk button:active:not(:disabled) { opacity: .75; }\n.nai-desk button:disabled { opacity: .35; cursor: default; }\n.nai-desk button:focus-visible, .nai-desk input:focus-visible, .nai-desk textarea:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }\n.nai-desk .nd-icon { width: 30px; min-height: 30px; padding: 6px; flex: 0 0 auto; }\n.nai-desk svg { flex: 0 0 auto; }\n.nai-desk .nd-status { padding: 12px 16px; color: var(--nd-muted); font-size: 12px; }\n.nai-desk .nd-content { display: flex; flex-direction: column; gap: 16px; padding: 0 14px 12px; }\n.nai-desk .nd-card { background: var(--nd-field); border: 1px solid var(--nd-line); border-radius: 8px; overflow: hidden; min-width: 0; }\n.nai-desk .nd-editor-tools { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 10px 4px; }\n.nai-desk .nd-tabs { display: flex; gap: 4px; }\n.nai-desk .nd-tabs button { font-weight: 500; }\n.nai-desk .nd-tabs button[aria-pressed="true"] { background: var(--nd-selected); color: var(--nd-ink); }\n.nai-desk textarea { display: block; width: 100%; min-width: 0; padding: 10px 14px 14px; resize: vertical; color: var(--nd-ink); background: var(--nd-field); border: 0; font: inherit; font-size: 14px; line-height: 1.65; min-height: 120px; }\n.nai-desk textarea::placeholder { color: var(--nd-muted); opacity: 1; }\n.nai-desk .nd-section-label { display: flex; justify-content: space-between; gap: 12px; color: var(--nd-muted); font-size: 13px; margin-bottom: 8px; }\n.nai-desk .nd-character-list { display: grid; gap: 12px; }\n.nai-desk .nd-character-head { display: flex; align-items: center; gap: 4px; padding: 6px 8px; background: var(--nd-bar); }\n.nai-desk .nd-gender { flex-shrink: 0; padding-inline: 3px; font-size: 17px; }\n.nai-desk .nd-name { width: 100%; min-width: 0; flex: 1; color: var(--nd-ink); background: transparent; border: 0; border-radius: 4px; font: inherit; font-weight: 500; padding: 4px; }\n.nai-desk .nd-character-actions { display: flex; flex-shrink: 0; gap: 1px; }\n.nai-desk .nd-character-actions button[aria-pressed="true"] { color: var(--nd-ink); }\n.nai-desk .nd-character-body { border-top: 1px solid var(--nd-line); }\n.nai-desk .nd-disabled .nd-name { text-decoration: line-through; color: var(--nd-muted); }\n.nai-desk .nd-disabled .nd-gender { color: var(--nd-muted); }\n.nai-desk .nd-add { width: 100%; margin-top: 8px; }\n.nai-desk .nd-footer { color: var(--nd-muted); font-size: 12px; padding: 12px 16px; margin-top: auto; }\n.nai-desk .nd-undo, .nai-desk .nd-error { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; justify-content: space-between; margin: 0 14px 12px; padding: 8px 12px; border-radius: 6px; background: var(--nd-bar); font-size: 13px; }\n.nai-desk .nd-error { border: 1px solid var(--nd-line); }\n.nai-desk .nd-conflict { margin: 0 14px 12px; padding: 12px; border: 1px solid var(--nd-line); border-radius: 6px; background: var(--nd-bar); }\n.nai-desk .nd-conflict strong { display: block; font-size: 13px; font-weight: 500; margin-bottom: 8px; }\n.nai-desk .nd-conflict label { display: block; font-size: 12px; color: var(--nd-muted); margin-block: 8px; }\n.nai-desk .nd-conflict textarea { border: 1px solid var(--nd-line); border-radius: 5px; margin-top: 4px; }\n.nai-desk .nd-conflict-actions { display: flex; gap: 8px; flex-wrap: wrap; }\n.nai-desk.nd-message { height: auto; padding: 20px 16px; gap: 12px; }\n.nai-desk.nd-expanded .nd-content { flex: 1; min-height: 300px; }\n.nai-desk.nd-expanded .nd-base { flex: 1; display: flex; flex-direction: column; }\n.nai-desk.nd-expanded .nd-base textarea { flex: 1; min-height: 260px; resize: none; }\n@container (max-width: 330px) {\n  .nai-desk .nd-character-head { flex-wrap: wrap; }\n  .nai-desk .nd-character-actions { margin-left: auto; }\n  .nai-desk .nd-name { width: 90px; }\n  .nai-desk .nd-content { padding-inline: 10px; }\n}\n@media (pointer: coarse) {\n  .nai-desk button { min-height: 44px; }\n  .nai-desk .nd-icon { width: 44px; min-height: 44px; }\n  .nai-desk .nd-character-head { flex-wrap: wrap; }\n  .nai-desk .nd-character-actions { width: 100%; justify-content: flex-end; }\n  .nai-desk textarea { font-size: 16px; }\n}\n';

// src/client.jsx
var import_jsx_runtime2 = require("react/jsx-runtime");
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
        guide: [{ id: "open", order: 45, title: () => "\u63D0\u793A\u8BCD\u7A3F\u7EB8", description: () => "\u7F16\u8F91\u5F53\u524D\u4F1A\u8BDD\u7684\u63D0\u793A\u8BCD\u8349\u7A3F", icon: () => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { kind: "notebook" }) }]
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
