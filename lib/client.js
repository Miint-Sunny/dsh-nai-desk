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
var import_react6 = __toESM(require("react"), 1);

// src/client-state.js
function fieldParts(field) {
  if (field === "main" || field === "uc") return { key: field };
  const match = /^character:([a-zA-Z0-9_-]+):(prompt|uc|name)$/.exec(field);
  if (!match) throw new Error("\u7A3F\u7EB8\u5B57\u6BB5\u6807\u8BC6\u65E0\u6548\u3002");
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
  if (value?.schemaVersion !== 1 || value.sessionId !== sessionId || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.main !== "string" || typeof value.uc !== "string" || !Array.isArray(value.characters)) throw new Error("\u6536\u5230\u7684\u7A3F\u7EB8\u6570\u636E\u4E0E\u5F53\u524D\u4F1A\u8BDD\u4E0D\u5339\u914D\u3002\u8BF7\u4FDD\u7559\u672A\u4FDD\u5B58\u7684\u5185\u5BB9\u540E\u91CD\u8BD5\u3002");
  const ids = /* @__PURE__ */ new Set();
  for (const c of value.characters) {
    if (!c || typeof c.id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(c.id) || ids.has(c.id) || typeof c.prompt !== "string" || typeof c.uc !== "string" || typeof c.name !== "string" || typeof c.enabled !== "boolean") throw new Error("\u6536\u5230\u7684\u89D2\u8272\u6570\u636E\u683C\u5F0F\u65E0\u6548\u3002\u8BF7\u4FDD\u7559\u672A\u4FDD\u5B58\u7684\u5185\u5BB9\u540E\u91CD\u8BD5\u3002");
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
  #remoteListeners = /* @__PURE__ */ new Set();
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
  /** Called with each newer draft that arrives through the live watch, not with the first load. */
  onRemoteChange = (listener) => {
    this.#remoteListeners.add(listener);
    return () => this.#remoteListeners.delete(listener);
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
        notice: "\u5DF2\u4FDD\u5B58\u7684\u7248\u672C\u53C8\u6709\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u6BD4\u8F83\u540E\u518D\u9009\u62E9\u3002"
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
    if (this.#closed || !this.#server) throw new Error("\u7A3F\u7EB8\u5C1A\u672A\u8BFB\u53D6\u5B8C\u6210\uFF0C\u8BF7\u7A0D\u5019\u518D\u7F16\u8F91\u3002");
    if (typeof value !== "string") throw new Error("\u63D0\u793A\u8BCD\u5B57\u6BB5\u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u3002");
    const current = fieldValue(this.#server, field);
    if (current === void 0) throw new Error("\u8BE5\u89D2\u8272\u5DF2\u88AB\u5220\u9664\uFF0C\u8BF7\u68C0\u67E5\u5F53\u524D\u7A3F\u7EB8\u3002");
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
      this.#conflicts.set(field, { ...conflict, notice: "\u5DF2\u4FDD\u5B58\u7684\u7248\u672C\u53C8\u6709\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u6BD4\u8F83\u540E\u518D\u9009\u62E9\u3002" });
      this.#publish();
      return;
    }
    if (choice === "remote") this.#pending.delete(field);
    else if (choice === "local") {
      const remote = fieldValue(this.#server, field);
      if (remote === void 0) throw new Error("\u8BE5\u89D2\u8272\u5DF2\u88AB\u5220\u9664\u3002\u5148\u590D\u5236\u672A\u4FDD\u5B58\u7684\u5185\u5BB9\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u6DFB\u52A0\u65B0\u89D2\u8272\u3002");
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
      if (this.#closed) throw new Error("\u7F16\u8F91\u5668\u5DF2\u5173\u95ED\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u7A3F\u7EB8\u3002");
      if (this.#conflicts.size || this.#pending.size) throw new Error("\u8BF7\u7B49\u5F85\u4FDD\u5B58\u5B8C\u6210\u6216\u5148\u5904\u7406\u51B2\u7A81\uFF0C\u518D\u8C03\u6574\u89D2\u8272\u3002");
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
  /** History steps without bodies, oldest first; the last one matches the current draft. */
  history() {
    return this.#send({ action: "history" });
  }
  version(revision) {
    return this.#send({ action: "version", revision });
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
          const known = this.#server.revision;
          const value = await this.#send({ action: "watch", revision: known }, controller.signal);
          if (controller.signal.aborted || this.#closed) return;
          this.#adopt(value);
          if (this.#server.revision > known) for (const listener of [...this.#remoteListeners]) listener(this.#server);
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
    this.#remoteListeners.clear();
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
    throw new Error(`\u65E0\u6CD5\u89E3\u6790\u7A3F\u7EB8\u670D\u52A1\u7684\u54CD\u5E94\uFF08HTTP ${response.status}\uFF09\u3002\u4FDD\u7559\u672A\u4FDD\u5B58\u5185\u5BB9\u540E\u91CD\u8BD5\u3002`);
  }
  if (!response.ok) {
    const error = new Error(typeof body.error?.message === "string" ? body.error.message : "\u65E0\u6CD5\u5B8C\u6210\u7A3F\u7EB8\u8BF7\u6C42\uFF0C\u8BF7\u4FDD\u7559\u672A\u4FDD\u5B58\u7684\u5185\u5BB9\u540E\u91CD\u8BD5\u3002");
    error.code = body.error?.code;
    if (body.error?.current) error.current = body.error.current;
    throw error;
  }
  return body;
}

// src/panel.jsx
var import_react4 = __toESM(require("react"), 1);

// src/controls.jsx
var import_react = __toESM(require("react"), 1);
var import_jsx_runtime = require("react/jsx-runtime");
var Button = (0, import_react.forwardRef)(function Button2({ variant = "ghost", size = "sm", className = "", children, ...props }, ref) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { ref, type: "button", className: `nd-button nd-button-${variant} nd-button-${size} ${className}`, ...props, children });
});
function ToolButton({ label: label2, title, children, className = "", ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: `nd-tool ${className}`, "aria-label": label2, title: title ?? label2, ...props, children });
}
function Switch({ checked, onChange, label: label2, title, disabled = false, readOnly = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      role: "switch",
      className: "nd-switch",
      "aria-checked": checked,
      "aria-label": label2,
      title,
      disabled,
      "aria-disabled": readOnly || void 0,
      onClick: readOnly ? void 0 : () => onChange(!checked),
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "nd-switch-thumb" })
    }
  );
}
function ActionMenu({ label: label2, icon, items, disabled = false }) {
  const [open, setOpen] = (0, import_react.useState)(false);
  const [above, setAbove] = (0, import_react.useState)(false);
  const root = (0, import_react.useRef)(null), anchor = (0, import_react.useRef)(null), list = (0, import_react.useRef)(null), focusFirst = (0, import_react.useRef)(false);
  const id = (0, import_react.useId)();
  const rows = () => [...list.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') ?? []];
  const close = (returnFocus) => {
    setOpen(false);
    if (returnFocus) anchor.current?.focus();
  };
  const show = (byKeyboard) => {
    const scroller = root.current?.closest(".nd-body")?.getBoundingClientRect(), box = anchor.current.getBoundingClientRect();
    setAbove(Boolean(scroller) && scroller.bottom - box.bottom < 140 && box.top - scroller.top > scroller.bottom - box.bottom);
    focusFirst.current = byKeyboard;
    setOpen(true);
  };
  (0, import_react.useEffect)(() => {
    if (!open) return;
    if (focusFirst.current) rows()[0]?.focus();
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);
  (0, import_react.useEffect)(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const onAnchorKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (open) rows()[event.key === "ArrowDown" ? 0 : rows().length - 1]?.focus();
      else show(true);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  };
  const onListKeyDown = (event) => {
    const all = rows(), at = all.indexOf(document.activeElement);
    if (event.key === "Escape" || event.key === "Tab" && event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") setOpen(false);
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? all.length - 1 : (at + (event.key === "ArrowDown" ? 1 : -1) + all.length) % all.length;
      all[next]?.focus();
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { ref: root, className: "nd-menu", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        ref: anchor,
        type: "button",
        className: "nd-tool",
        "aria-label": label2,
        title: label2,
        disabled,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? id : void 0,
        onClick: (event) => {
          if (open) close(false);
          else show(event.detail === 0);
        },
        onKeyDown: onAnchorKeyDown,
        children: icon
      }
    ),
    open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { ref: list, id, role: "menu", "aria-label": label2, className: `nd-menu-list${above ? " nd-menu-above" : ""}`, onKeyDown: onListKeyDown, children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react.default.Fragment, { children: [
      item.separatorBefore && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { role: "separator", className: "nd-menu-separator" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          type: "button",
          role: "menuitem",
          tabIndex: -1,
          className: `nd-menu-item${item.danger ? " nd-menu-danger" : ""}`,
          disabled: item.disabled,
          onClick: () => {
            close(true);
            item.onSelect();
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "nd-menu-icon", children: item.icon }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "nd-menu-label", children: item.label })
          ]
        }
      )
    ] }, item.id)) })
  ] });
}
function PromptTabs({ id, value, options, onChange, label: label2 }) {
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
      "aria-label": label2,
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

// src/editor.jsx
var import_react3 = __toESM(require("react"), 1);

// src/mask.js
var MASK_TOKEN = /⟪屏蔽\d{1,4}⟫/g;
var maskToken = (n) => `\u27EA\u5C4F\u853D${n}\u27EB`;
var tokensIn = (value) => value.match(MASK_TOKEN) ?? [];
var tokenRanges = (value) => [...value.matchAll(MASK_TOKEN)].map((match) => ({ token: match[0], start: match.index, end: match.index + match[0].length }));
var revealText = (value, secrets) => value.replace(MASK_TOKEN, (token) => secrets?.[token] ?? token);
function nextToken(draft) {
  const texts = [draft.main, draft.uc, ...draft.characters.flatMap((c) => [c.prompt, c.uc])];
  const numbers = [...Object.keys(draft.secrets ?? {}), ...texts.flatMap(tokensIn)].map((token) => Number(/\d+/.exec(token)[0]));
  return maskToken(Math.max(0, ...numbers) + 1);
}

// src/editor.jsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var placeholders = {
  main: "\u4F8B\u5982\uFF1Aoutdoors, soft lighting",
  prompt: "\u4F8B\u5982\uFF1Agirl, blue jacket"
};
function painted(value, ranges) {
  const parts = [];
  let at = 0;
  for (const range of ranges) {
    parts.push(value.slice(at, range.start), /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("mark", { className: "nd-token", children: range.token }, range.start));
    at = range.end;
  }
  parts.push(value.slice(at), "\u200B");
  return parts;
}
function PromptEditor({ client, field, value, label: label2, secrets, readOnly = false, onCaret }) {
  const area = (0, import_react3.useRef)(null);
  const layer = (0, import_react3.useRef)(null);
  const composing = (0, import_react3.useRef)(false);
  const ranges = tokenRanges(value);
  const report = () => {
    const el = area.current;
    if (el && document.activeElement === el) onCaret?.({ field, start: el.selectionStart, end: el.selectionEnd });
  };
  const keepOutOfPlaceholders = () => {
    const el = area.current;
    if (el && el.selectionStart === el.selectionEnd) {
      const inside = ranges.find((range) => el.selectionStart > range.start && el.selectionStart < range.end);
      if (inside) el.setSelectionRange(inside.end, inside.end);
    }
    report();
  };
  const track = (0, import_react3.useRef)(keepOutOfPlaceholders);
  track.current = keepOutOfPlaceholders;
  (0, import_react3.useEffect)(() => {
    const listener = () => {
      if (document.activeElement === area.current) track.current();
    };
    document.addEventListener("selectionchange", listener);
    return () => document.removeEventListener("selectionchange", listener);
  }, []);
  const onKeyDown = (event) => {
    if (readOnly || composing.current || event.key !== "Backspace" && event.key !== "Delete") return;
    const el = event.currentTarget;
    let start = el.selectionStart, end = el.selectionEnd;
    if (start === end) {
      const hit = ranges.find((range) => event.key === "Backspace" ? start > range.start && start <= range.end : start >= range.start && start < range.end);
      if (hit) {
        start = hit.start;
        end = hit.end;
      }
    } else for (const range of ranges) if (range.start < end && range.end > start) {
      start = Math.min(start, range.start);
      end = Math.max(end, range.end);
    }
    if (start !== el.selectionStart || end !== el.selectionEnd) el.setSelectionRange(start, end);
  };
  const transfer = (event, cut) => {
    const el = event.currentTarget;
    const start = el.selectionStart, end = el.selectionEnd;
    const picked = el.value.slice(start, end);
    if (!tokenRanges(picked).length) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", revealText(picked, secrets));
    if (cut && !readOnly) {
      client.edit(field, el.value.slice(0, start) + el.value.slice(end));
      requestAnimationFrame(() => area.current?.setSelectionRange(start, start));
    }
  };
  const key = field === "main" ? "main" : field.endsWith(":prompt") ? "prompt" : "uc";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "nd-editor-wrap", children: [
    ranges.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { ref: layer, className: "nd-editor nd-editor-layer", "aria-hidden": "true", children: painted(value, ranges) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "textarea",
      {
        ref: area,
        className: "nd-editor",
        "aria-label": label2,
        value,
        spellCheck: false,
        readOnly,
        placeholder: readOnly ? "" : placeholders[key] ?? "",
        onCompositionStart: () => {
          composing.current = true;
        },
        onCompositionEnd: (event) => {
          composing.current = false;
          client.edit(field, event.currentTarget.value);
        },
        onChange: (event) => client.edit(field, event.currentTarget.value, { deferSave: composing.current }),
        onSelect: keepOutOfPlaceholders,
        onFocus: report,
        onKeyDown,
        onScroll: (event) => {
          if (layer.current) layer.current.scrollTop = event.currentTarget.scrollTop;
        },
        onCopy: (event) => transfer(event, false),
        onCut: (event) => transfer(event, true),
        onBlur: (event) => {
          if (!composing.current) client.flush().catch(() => {
          });
          if (!event.currentTarget.closest(".nd-card")?.contains(event.relatedTarget)) onCaret?.(null);
        }
      }
    )
  ] });
}
function caretTarget(caret, field, value) {
  if (!caret || caret.field !== field) return null;
  const ranges = tokenRanges(value);
  if (caret.end > caret.start) {
    const covers = ranges.some((range2) => range2.start < caret.end && range2.end > caret.start);
    return { kind: "selection", start: caret.start, end: caret.end, text: value.slice(caret.start, caret.end), blocked: covers };
  }
  const range = ranges.find((item) => caret.start >= item.start && caret.start <= item.end);
  return range ? { kind: "token", ...range } : null;
}

// src/panel.jsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var EYE_CONTOUR = "M1.5 8C2.9 5.25 5.25 3.5 8 3.5C10.75 3.5 13.1 5.25 14.5 8C13.1 10.75 10.75 12.5 8 12.5C5.25 12.5 2.9 10.75 1.5 8Z";
var glyphs = {
  up: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M8 13.5V2.5M3.5 7 8 2.5 12.5 7", stroke: "currentColor" }),
  down: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M8 2.5v11M3.5 9 8 13.5 12.5 9", stroke: "currentColor" }),
  back: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M10 4 6.70711 7.29289c-.39053.39053-.39053 1.02369 0 1.41422L10 12", stroke: "currentColor" }),
  forward: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M6 4l3.29289 3.29289c.39053.39053.39053 1.02369 0 1.41422L6 12", stroke: "currentColor" }),
  eye: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: `${EYE_CONTOUR}M10 8C10 9.1 9.1 10 8 10C6.9 10 6 9.1 6 8C6 6.9 6.9 6 8 6C9.1 6 10 6.9 10 8Z`, stroke: "currentColor", strokeLinecap: "round" }),
  eyeOff: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: `${EYE_CONTOUR}M2.5 2.5L13.5 13.5`, stroke: "currentColor", strokeLinecap: "round" }),
  // The exit-fullscreen corners plus the diagonals of the expand artwork, pointing inward.
  shrink: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M9 2.5V6C9 6.26522 9.10536 6.51957 9.29289 6.70711C9.48043 6.89464 9.73478 7 10 7H13.5", stroke: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M7 13.5V10C7 9.73478 6.89464 9.48043 6.70711 9.29289C6.51957 9.10536 6.26522 9 6 9H2.5", stroke: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M9.5 6.5 13.914 2.08594M6.5 9.5 2.08594 13.914", stroke: "currentColor" })
  ] }),
  ellipsis: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M3 9C3.55228 9 4 8.55228 4 8C4 7.44772 3.55228 7 3 7C2.44772 7 2 7.44772 2 8C2 8.55228 2.44772 9 3 9Z", fill: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9Z", fill: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M13 9C13.5523 9 14 8.55228 14 8C14 7.44772 13.5523 7 13 7C12.4477 7 12 7.44772 12 8C12 8.55228 12.4477 9 13 9Z", fill: "currentColor" })
  ] }),
  notebook: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M4 1.5h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z", stroke: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M5.5 5h5M5.5 8h5M5.5 11h3", stroke: "currentColor" })
  ] }),
  female: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: "8", cy: "5.5", r: "3.5", stroke: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M8 9v6M5 12.5h6", stroke: "currentColor" })
  ] }),
  male: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: "6.5", cy: "9.5", r: "3.5", stroke: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M9 7l5-5M10 2h4v4", stroke: "currentColor" })
  ] }),
  person: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M8 8.25C9.51878 8.25 10.75 7.01878 10.75 5.5C10.75 3.98122 9.51878 2.75 8 2.75C6.48122 2.75 5.25 3.98122 5.25 5.5C5.25 7.01878 6.48122 8.25 8 8.25Z", stroke: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M2.5 14.5C2.5 11.5 5.25 10.25 8 10.25C10.75 10.25 13.5 11.5 13.5 14.5", stroke: "currentColor" })
  ] })
};
function Icon({ kind }) {
  if (!glyphs[kind]) return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(HostIcon, { kind });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { viewBox: "0 0 16 16", width: "16", height: "16", fill: "none", strokeWidth: "1", "aria-hidden": "true", children: glyphs[kind] });
}
function TabTitle() {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "nd-tab-title-icon", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { kind: "notebook" }) }),
    "\u7A3F\u7EB8"
  ] });
}
var tabLabel = (text, masked) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
  text,
  masked && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "nd-tab-mark", role: "img", "aria-label": "\uFF08\u6A21\u578B\u4E0D\u53EF\u89C1\uFF09", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { kind: "eyeOff" }) })
] });
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
var minutesAgo = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
var clock = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
var dayAndClock = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function when(at) {
  if (at === null) return "";
  const age = Date.now() - at;
  if (age < 6e4) return "\u521A\u521A";
  if (age < 36e5) return minutesAgo.format(-Math.floor(age / 6e4), "minute");
  return new Date(at).toDateString() === (/* @__PURE__ */ new Date()).toDateString() ? clock.format(at) : dayAndClock.format(at);
}
var who = (step) => step.restored ? "\u6062\u590D\u8F83\u65E9\u7248\u672C" : step.source === "model" ? "\u6A21\u578B\u4FEE\u6539" : step.source === "user" ? "\u624B\u52A8\u4FEE\u6539" : "\u8F83\u65E9\u7684\u5185\u5BB9";
var describe = (step) => [who(step), when(step.at), step.restored ? "" : step.parts.join("\u3001")].filter(Boolean).join(" \xB7 ");
function MaskHint({ target, field, client, busy, setCaret }) {
  if (!target) return null;
  const keepFocus = (event) => event.preventDefault();
  const run = (operation) => client.command(operation).then(() => setCaret(null)).catch(() => {
  });
  if (target.kind === "selection") {
    const mask = () => {
      const draft = client.getSnapshot().draft;
      const value = fieldValue(draft, field);
      const token = nextToken(draft);
      run({ type: "mask_span", field, text: value.slice(0, target.start) + token + value.slice(target.end), token, secret: target.text });
    };
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "nd-hint", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "nd-hint-text", children: target.blocked ? "\u6240\u9009\u5185\u5BB9\u5DF2\u5305\u542B\u5C4F\u853D\u90E8\u5206" : `\u5DF2\u9009 ${target.text.length} \u4E2A\u5B57\u7B26` }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Button, { variant: "outline", onMouseDown: keepFocus, disabled: busy || target.blocked || !target.text.trim(), onClick: mask, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { kind: "eyeOff" }),
        "\u5411\u6A21\u578B\u5C4F\u853D"
      ] })
    ] });
  }
  const secret = client.getSnapshot().draft?.secrets?.[target.token];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "nd-hint", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "nd-hint-text", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("mark", { className: "nd-token", children: target.token }),
      secret === void 0 ? "\u65E0\u6CD5\u8BFB\u53D6\u539F\u6587\u3002\u5220\u9664\u6B64\u5360\u4F4D\u540E\u91CD\u65B0\u8F93\u5165\u3002" : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "nd-hint-secret", children: secret })
    ] }),
    secret !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { variant: "outline", onMouseDown: keepFocus, disabled: busy, onClick: () => run({ type: "unmask", token: target.token }), children: "\u53D6\u6D88\u5C4F\u853D" })
  ] });
}
function MaskToggle({ name, masked, readOnly, busy, onToggle }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    ToolButton,
    {
      label: `\u5411\u6A21\u578B\u5C4F\u853D${name}`,
      "aria-pressed": masked,
      title: readOnly ? masked ? "\u6A21\u578B\u4E0D\u53EF\u89C1" : "\u6A21\u578B\u53EF\u89C1" : masked ? "\u53D6\u6D88\u5C4F\u853D" : "\u5411\u6A21\u578B\u5C4F\u853D",
      disabled: busy && !readOnly,
      "aria-disabled": readOnly || void 0,
      onClick: readOnly ? void 0 : onToggle,
      children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { kind: masked ? "eyeOff" : "eye" })
    }
  );
}
function BaseCard({ draft, client, ui, setUi, readOnly, caret, setCaret, busy }) {
  const tabsId = (0, import_react4.useId)();
  const tab = ui.baseTab;
  const options = [
    { value: "main", label: tabLabel("\u4E3B\u63D0\u793A\u8BCD", draft.mask?.main === true) },
    { value: "uc", label: tabLabel("UC", draft.mask?.uc === true), title: "\u8D1F\u9762\u63D0\u793A\u8BCD" }
  ];
  const masked = draft.mask?.[tab] === true;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "nd-card nd-base", "aria-label": "\u4E3B\u63D0\u793A\u8BCD\u4E0E UC", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "nd-card-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PromptTabs, { id: tabsId, value: tab, options, label: "\u4E3B\u63D0\u793A\u8BCD\u4E0E UC", onChange: (value) => setUi((previous) => ({ ...previous, baseTab: value })) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "nd-head-fill" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        MaskToggle,
        {
          name: tab === "main" ? "\u4E3B\u63D0\u793A\u8BCD" : " UC",
          masked,
          readOnly,
          busy,
          onToggle: () => client.command({ type: "set_mask", field: tab, masked: !masked }).catch(() => {
          })
        }
      )
    ] }),
    options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "nd-prompt-panel", role: "tabpanel", id: `${tabsId}-${option.value}-panel`, "aria-labelledby": `${tabsId}-${option.value}`, hidden: tab !== option.value, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PromptEditor, { client, field: option.value, value: draft[option.value], label: option.value === "main" ? "\u4E3B\u63D0\u793A\u8BCD" : "UC", secrets: draft.secrets, readOnly, onCaret: setCaret }) }, option.value)),
    !readOnly && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(MaskHint, { target: caretTarget(caret, tab, draft[tab]), field: tab, client, busy, setCaret })
  ] });
}
function Character({ draft, character, index, count, client, ui, setUi, busy, readOnly, caret, setCaret, onDelete }) {
  const tabsId = (0, import_react4.useId)();
  const id = character.id;
  const collapsed = ui.collapsed[id] === true;
  const tab = ui.tabs[id] === "uc" ? "uc" : "prompt";
  const field = `character:${id}:${tab}`;
  const run = (operation) => client.command(operation).catch(() => {
  });
  const n = index + 1;
  const options = [{ value: "prompt", label: "\u63D0\u793A\u8BCD" }, { value: "uc", label: "UC", title: "\u89D2\u8272\u7684\u8D1F\u9762\u63D0\u793A\u8BCD" }];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: `nd-card nd-character${character.enabled ? "" : " nd-disabled"}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "nd-card-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "nd-gender", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { kind: genderOf(character.prompt) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "input",
        {
          "aria-label": `\u89D2\u8272 ${n} \u540D\u79F0`,
          className: "nd-name",
          value: character.name,
          maxLength: 128,
          placeholder: `\u89D2\u8272 ${n}`,
          readOnly,
          onChange: (event) => client.edit(`character:${id}:name`, event.currentTarget.value),
          onBlur: () => {
            if (!readOnly) client.flush().catch(() => {
            });
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "nd-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          MaskToggle,
          {
            name: `\u89D2\u8272 ${n}`,
            masked: character.masked === true,
            readOnly,
            busy,
            onToggle: () => run({ type: "set_character", id, patch: { masked: !character.masked } })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          Switch,
          {
            checked: character.enabled,
            label: `\u542F\u7528\u89D2\u8272 ${n}`,
            disabled: busy && !readOnly,
            readOnly,
            title: readOnly ? character.enabled ? "\u5DF2\u542F\u7528" : "\u5DF2\u505C\u7528" : character.enabled ? `\u505C\u7528\u89D2\u8272 ${n}` : `\u542F\u7528\u89D2\u8272 ${n}`,
            onChange: (enabled) => run({ type: "set_character", id, patch: { enabled } })
          }
        ),
        !readOnly && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ActionMenu, { label: `\u89D2\u8272 ${n} \u7684\u66F4\u591A\u64CD\u4F5C`, icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { kind: "ellipsis" }), disabled: busy, items: [
          { id: "up", label: "\u4E0A\u79FB", icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { kind: "up" }), disabled: index === 0, onSelect: () => run({ type: "move_character", id, index: index - 1 }) },
          { id: "down", label: "\u4E0B\u79FB", icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { kind: "down" }), disabled: index === count - 1, onSelect: () => run({ type: "move_character", id, index: index + 1 }) },
          { id: "delete", label: "\u5220\u9664", icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { kind: "trash" }), danger: true, separatorBefore: true, onSelect: () => onDelete(character, index) }
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          ToolButton,
          {
            label: `${collapsed ? "\u5C55\u5F00" : "\u6536\u8D77"}\u89D2\u8272 ${n}`,
            "aria-expanded": !collapsed,
            "aria-controls": `nd-character-${id}`,
            onClick: () => setUi((previous) => ({ ...previous, collapsed: { ...previous.collapsed, [id]: !collapsed } })),
            children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { kind: collapsed ? "chevronDown" : "chevronUp" })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "nd-card-body", id: `nd-character-${id}`, hidden: collapsed, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        PromptTabs,
        {
          id: tabsId,
          value: tab,
          options,
          label: `\u89D2\u8272 ${n} \u7684\u63D0\u793A\u8BCD\u4E0E UC`,
          onChange: (value) => setUi((previous) => ({ ...previous, tabs: { ...previous.tabs, [id]: value } }))
        }
      ),
      options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "nd-prompt-panel", role: "tabpanel", id: `${tabsId}-${option.value}-panel`, "aria-labelledby": `${tabsId}-${option.value}`, hidden: tab !== option.value, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PromptEditor, { client, field: `character:${id}:${option.value}`, value: character[option.value], label: `\u89D2\u8272 ${n} ${option.value === "prompt" ? "\u63D0\u793A\u8BCD" : "UC"}`, secrets: draft.secrets, readOnly, onCaret: setCaret }) }, option.value)),
      !readOnly && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(MaskHint, { target: caretTarget(caret, field, character[tab]), field, client, busy, setCaret })
    ] })
  ] });
}
function Conflict({ conflict, client }) {
  const label2 = conflict.field === "main" ? "\u4E3B\u63D0\u793A\u8BCD" : conflict.field === "uc" ? "UC" : conflict.field.endsWith(":name") ? "\u89D2\u8272\u540D\u79F0" : conflict.field.endsWith(":uc") ? "\u89D2\u8272 UC" : "\u89D2\u8272\u63D0\u793A\u8BCD";
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "nd-conflict", role: "alert", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: conflict.deleted ? "\u8BE5\u89D2\u8272\u5DF2\u88AB\u5220\u9664\uFF0C\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\u65E0\u6CD5\u5199\u5165" : `${label2}\u7684\u4FEE\u6539\u4E0E\u5DF2\u4FDD\u5B58\u7684\u7248\u672C\u51B2\u7A81` }),
    conflict.notice && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: conflict.notice }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { children: [
      "\u4F60\u7684\u4FEE\u6539\uFF08\u672A\u4FDD\u5B58\uFF09",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("textarea", { readOnly: true, value: conflict.local, rows: 3 })
    ] }),
    !conflict.deleted && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { children: [
      "\u5DF2\u4FDD\u5B58\u7684\u7248\u672C",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("textarea", { readOnly: true, value: conflict.remote ?? "", rows: 3 })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "nd-conflict-actions", children: [
      !conflict.deleted && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { variant: "outline", onClick: () => client.resolveConflict(conflict.field, "local", conflict.revision).catch(() => {
      }), children: "\u4FDD\u7559\u4F60\u7684\u4FEE\u6539" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { variant: "outline", onClick: () => client.resolveConflict(conflict.field, "remote", conflict.revision).catch(() => {
      }), children: conflict.deleted ? "\u653E\u5F03\u672A\u4FDD\u5B58\u7684\u4FEE\u6539" : "\u4F7F\u7528\u5DF2\u4FDD\u5B58\u7684\u7248\u672C" })
    ] })
  ] });
}
function useHistory(client, revision, visible) {
  const [steps, setSteps] = (0, import_react4.useState)([]);
  const versions = (0, import_react4.useRef)(/* @__PURE__ */ new Map());
  const [, changed] = (0, import_react4.useReducer)((count) => count + 1, 0);
  (0, import_react4.useEffect)(() => {
    if (revision === void 0 || !visible) return;
    let cancelled = false;
    const timer = setTimeout(() => client.history().then((value) => {
      if (!cancelled) setSteps(value.steps);
    }, () => {
    }), 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, revision, visible]);
  const load = (0, import_react4.useCallback)((stepRevision) => {
    if (stepRevision === void 0 || versions.current.has(stepRevision)) return;
    versions.current.set(stepRevision, null);
    client.version(stepRevision).then((value) => {
      versions.current.set(stepRevision, value);
      changed();
    }, () => {
      versions.current.delete(stepRevision);
      changed();
    });
  }, [client]);
  return { steps, load, version: (stepRevision) => versions.current.get(stepRevision) };
}
function Panel(props) {
  if (typeof props.sessionId !== "string") return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "nai-desk nd-message", children: "\u8BF7\u5148\u9009\u62E9\u4F1A\u8BDD" });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SessionPanel, { ...props }, props.sessionId);
}
function SessionPanel({ sessionId, sessionList, getClient, acquireClient, useTabInfo }) {
  const presetSnapshot = (0, import_react4.useCallback)(() => sessionList.getSnapshot().byId[sessionId]?.projectionValues?.agentPreset, [sessionList, sessionId]);
  const preset = (0, import_react4.useSyncExternalStore)(sessionList.subscribe, presetSnapshot, presetSnapshot);
  const client = (0, import_react4.useMemo)(() => getClient(sessionId), [getClient, sessionId]);
  const state = (0, import_react4.useSyncExternalStore)(client.subscribe, client.getSnapshot, client.getSnapshot);
  const tabInfo = useTabInfo?.();
  const visible = tabInfo?.tab?.visible !== false;
  const [ui, setUi] = (0, import_react4.useState)(() => readUi(sessionId));
  const [expanded, setExpanded] = (0, import_react4.useState)(false);
  const [removed, setRemoved] = (0, import_react4.useState)(null);
  const [caret, setCaret] = (0, import_react4.useState)(null);
  const [viewing, setViewing] = (0, import_react4.useState)(null);
  const shownRef = (0, import_react4.useRef)(null);
  const undoRef = (0, import_react4.useRef)(null);
  const history = useHistory(client, state.draft?.revision, visible);
  (0, import_react4.useEffect)(() => {
    if (preset !== PRESET_ID || !visible) return;
    return acquireClient(sessionId);
  }, [preset, visible, acquireClient, sessionId]);
  (0, import_react4.useEffect)(() => {
    try {
      localStorage.setItem(`dsh.nai-desk.ui.v1.${sessionId}`, JSON.stringify(ui));
    } catch {
    }
  }, [sessionId, ui]);
  (0, import_react4.useEffect)(() => {
    if (removed) undoRef.current?.focus();
  }, [removed]);
  const { steps } = history;
  const revision = state.draft?.revision;
  const liveIndex = steps.length && steps.at(-1).revision === revision ? steps.length - 1 : steps.length;
  const viewIndex = viewing === null ? liveIndex : steps.findIndex((step2) => step2.revision === viewing);
  (0, import_react4.useEffect)(() => {
    if (viewing !== null && viewIndex < 0) setViewing(null);
  }, [viewing, viewIndex]);
  (0, import_react4.useEffect)(() => {
    if (viewing === null || viewIndex < 0) return;
    history.load(viewing);
    history.load(steps[viewIndex - 1]?.revision);
    if (viewIndex + 1 < liveIndex) history.load(steps[viewIndex + 1]?.revision);
  }, [viewing, viewIndex, liveIndex, steps, history.load]);
  if (preset !== PRESET_ID) return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "nai-desk nd-message", children: "\u7A3F\u7EB8\u53EA\u7528\u4E8E\u300CNAI5 \u63D0\u793A\u8BCD\u300D\u9884\u8BBE\u7684\u4F1A\u8BDD\u3002" });
  if (!state.draft) return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "nai-desk nd-message", role: "status", children: [
    state.error ?? "\u6B63\u5728\u8BFB\u53D6\u7A3F\u7EB8\u2026",
    state.error && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { variant: "outline", onClick: () => client.refresh(), children: "\u91CD\u8BD5" })
  ] });
  const busy = state.commandPending;
  const reading = viewing !== null;
  const loaded = reading ? history.version(viewing) : state.draft;
  if (loaded) shownRef.current = loaded;
  const shown = loaded ?? shownRef.current ?? state.draft;
  const loading = reading && !loaded;
  const go = (index) => {
    setCaret(null);
    if (index >= liveIndex) setViewing(null);
    else if (index >= 0) setViewing(steps[index].revision);
  };
  const step = steps[viewIndex];
  const [saveLabel, tone] = state.phase === "conflict" ? ["\u4FDD\u5B58\u51B2\u7A81", "warn"] : state.error ? ["\u65E0\u6CD5\u540C\u6B65", "error"] : state.phase === "saving" || state.pending ? ["\u4FDD\u5B58\u4E2D\u2026", ""] : ["\u5DF2\u4FDD\u5B58", ""];
  const atLimit = shown.characters.length >= 22;
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
  const shared = { draft: shown, client, ui, setUi, busy, readOnly: reading, caret, setCaret };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: `nai-desk${expanded ? " nd-expanded" : ""}`, onKeyDown: (event) => {
    if (event.key !== "Escape") return;
    if (reading) {
      go(liveIndex);
      event.stopPropagation();
    } else if (expanded) {
      setExpanded(false);
      event.stopPropagation();
    }
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("header", { className: "nd-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "nd-status", "data-tone": tone || void 0, role: "status", children: saveLabel }),
      liveIndex > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "nd-steps", role: "group", "aria-label": "\u7248\u672C\u5386\u53F2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ToolButton, { label: "\u4E0A\u4E00\u4E2A\u7248\u672C", disabled: viewIndex <= 0, onClick: () => go(viewIndex - 1), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { kind: "back" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "nd-step-count", title: step ? describe(step) : "\u5F53\u524D\u7248\u672C", children: [
          viewIndex + 1,
          " / ",
          liveIndex + 1
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ToolButton, { label: "\u4E0B\u4E00\u4E2A\u7248\u672C", disabled: !reading, onClick: () => go(viewIndex + 1), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { kind: "forward" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ToolButton, { label: expanded ? "\u9000\u51FA\u5168\u680F\u7F16\u8F91" : "\u5168\u680F\u7F16\u8F91", onClick: () => setExpanded((value) => !value), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { kind: expanded ? "shrink" : "expand" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "nd-visually-hidden", role: "status", children: reading ? `\u6B63\u5728\u67E5\u770B\u7B2C ${viewIndex + 1} \u4E2A\u7248\u672C\uFF0C\u5171 ${liveIndex + 1} \u4E2A` : "" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "nd-body", "data-reading": reading || void 0, "aria-busy": loading || void 0, children: [
      reading && step && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "nd-history-bar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "nd-history-meta", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: who(step) }),
          step.at !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: when(step.at) }),
          !step.restored && step.parts.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: step.parts.join("\u3001") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "nd-history-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { variant: "outline", onClick: () => go(liveIndex), children: "\u8FD4\u56DE\u5F53\u524D\u7248\u672C" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { variant: "primary", disabled: busy || loading, onClick: () => client.command({ type: "restore", revision: viewing }).then(() => setViewing(null), () => {
          }), children: "\u6062\u590D\u6B64\u7248\u672C" })
        ] })
      ] }),
      !reading && state.error && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "nd-error", role: "alert", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: state.error }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { onClick: () => state.pending ? client.flush().catch(() => {
        }) : client.refresh(), children: "\u91CD\u8BD5" })
      ] }),
      !reading && state.conflicts.map((conflict) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Conflict, { conflict, client }, conflict.field)),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BaseCard, { ...shared }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "nd-characters", "aria-label": "\u89D2\u8272", hidden: expanded, children: [
        shown.characters.map((character, index) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Character, { ...shared, character, index, count: shown.characters.length, onDelete: removeCharacter }, character.id)),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "nd-notice-region", role: "status", children: !reading && removed && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "nd-notice", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: removed.character.name ? `\u5DF2\u5220\u9664\u300C${removed.character.name}\u300D` : `\u5DF2\u5220\u9664\u89D2\u8272 ${removed.index + 1}` }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { ref: undoRef, disabled: busy, onClick: restoreCharacter, children: "\u64A4\u9500" })
        ] }) }),
        !reading && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "nd-creator", disabled: busy || atLimit, onClick: () => client.command({ type: "add_character", character: {} }).catch(() => {
        }), children: atLimit ? "\u5DF2\u8FBE\u5230 22 \u4E2A\u89D2\u8272\u7684\u4E0A\u9650" : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { kind: "plus" }),
          "\u6DFB\u52A0\u89D2\u8272"
        ] }) })
      ] })
    ] })
  ] });
}

// src/turn-card.jsx
var import_react5 = __toESM(require("react"), 1);

// src/turn-writes.js
var TURN_DATA_KEY = "nai-desk-writes";
var WRITE_TOOLS = /* @__PURE__ */ new Set(["desk_set_main", "desk_set_uc", "desk_set_character", "desk_remove_character", "desk_move_character"]);
function label(name, argsRaw) {
  let args = {};
  try {
    args = JSON.parse(argsRaw) ?? {};
  } catch {
  }
  const n = Number.isInteger(args.n) ? args.n : "?";
  switch (name) {
    case "desk_set_main":
      return "\u4E3B\u63D0\u793A\u8BCD";
    case "desk_set_uc":
      return "UC";
    case "desk_set_character":
      return `\u89D2\u8272 ${n}`;
    case "desk_remove_character":
      return `\u89D2\u8272 ${n}\uFF08\u5DF2\u5220\u9664\uFF09`;
    default:
      return "\u89D2\u8272\u987A\u5E8F";
  }
}
var deskTurnDefinition = {
  kind: TURN_DATA_KEY,
  match: (event) => {
    if (event.type === "turn/start") return { id: String(event.data.turn), role: "start" };
    if (event.type === "tool/call" && WRITE_TOOLS.has(event.data?.name)) return { id: String(event.data.turn), role: "update" };
    if (event.type === "tool/result" && event.surfaceOp === "append") return { id: String(event.data.turn), role: "update" };
    return null;
  },
  start: (_context, match) => ({ turn: match.event.data.turn, calls: /* @__PURE__ */ new Map(), writes: [] }),
  update: (context, match) => {
    const { event } = match;
    if (event.type === "tool/call") {
      const calls = new Map(context.state.calls);
      calls.set(String(event.data.callId), { name: event.data.name, argsRaw: event.data.arguments ?? "" });
      return { ...context.state, calls };
    }
    const message = event.data?.message;
    const call = context.state.calls.get(String(message?.source?.callId));
    if (!call || message.isError === true) return context.state;
    return { ...context.state, writes: [...context.state.writes, { seq: event.seq, label: label(call.name, call.argsRaw) }] };
  },
  buildLocationData: (context, scope, previous) => {
    if (scope !== "turn" || context.state === void 0 || !context.state.writes.length) return null;
    if (previous?.kind === "turn" && previous.turn === context.state.turn && previous.key === TURN_DATA_KEY && previous.value.writes === context.state.writes) return previous;
    return { kind: "turn", turn: context.state.turn, key: TURN_DATA_KEY, value: { writes: context.state.writes } };
  }
};

// src/turn-card.jsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var Glyph = () => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { viewBox: "0 0 16 16", width: "20", height: "20", fill: "none", strokeWidth: "1", "aria-hidden": "true", children: [
  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M4 1.5h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z", stroke: "currentColor" }),
  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M5.5 5h5M5.5 8h5M5.5 11h3", stroke: "currentColor" })
] });
function DeskTurnCard({ turn, seq, openDesk }) {
  const writes = turn?.data?.get?.(TURN_DATA_KEY)?.writes?.filter((write) => write.seq <= (turn.end?.seq ?? seq));
  if (!writes?.length) return null;
  const parts = [...new Set(writes.map((write) => write.label))];
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "nd-turn-cards", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", className: "nd-turn-card", "aria-label": "\u5728\u4FA7\u8FB9\u680F\u6253\u5F00\u7A3F\u7EB8", onClick: openDesk, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "nd-turn-card-icon", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Glyph, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "nd-turn-card-details", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "nd-turn-card-title", children: "\u7A3F\u7EB8" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "nd-turn-card-description", children: [
        "\u5DF2\u4FEE\u6539\uFF1A",
        parts.join("\u3001")
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "nd-turn-card-open", children: "\u6253\u5F00" })
  ] }) });
}

// src/style.css
var style_default = `/* Layout follows the host's own sidebar pages; controls are adapted from
 * dsh-v0.2.1-rc.5 ui-primitives (MIT, see NOTICE).
 * - Panel frame: the Workspace files tab (38px header, hairline seam, 28px tools).
 * - Cards: the composer and in-chat card material \u2014 input-major fill, border 0,
 *   and the elevation shadow whose first layer is the 0.5px translucent stroke.
 * - Add row: the Models page dashed "add" button. Chat card: the plan card.
 * - Character actions: the host Menu card behind an ellipsis tool.
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
  flex: none; display: flex; align-items: center; gap: 4px; height: 38px; padding-block: 0; padding-inline: 16px 6px;
  border-bottom: .5px solid var(--dsw-alias-border-l3);
}
.nai-desk .nd-steps { display: flex; align-items: center; gap: 0; margin-inline-end: 2px; }
.nai-desk .nd-step-count { min-width: 40px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; text-align: center; font-variant-numeric: tabular-nums; white-space: nowrap; }
.nai-desk .nd-status { margin-inline-end: auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.nai-desk .nd-status[data-tone="error"] { color: var(--dsw-alias-state-error-primary); }
.nai-desk .nd-status[data-tone="warn"] { color: var(--dsw-alias-state-warn-label); }
.nai-desk .nd-tool {
  display: inline-flex; align-items: center; justify-content: center; flex: none; width: 28px; height: 28px; padding: 6px;
  border: 0; border-radius: var(--dsw-radius-sm); background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; line-height: 1;
}
.nai-desk .nd-tool[aria-pressed="true"] { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
.nai-desk .nd-tool:disabled { opacity: .4; cursor: default; }
/* History versions: state controls stay readable and focusable but do nothing. */
.nai-desk .nd-tool[aria-disabled="true"], .nai-desk .nd-switch[aria-disabled="true"] { opacity: .5; cursor: default; }
.nai-desk .nd-visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }

.nai-desk .nd-body { flex: 1 1 auto; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 12px; padding: 12px 16px 16px; }
.nai-desk .nd-body > .nd-base, .nai-desk .nd-body > .nd-characters { transition: opacity 120ms ease; }
.nai-desk .nd-body[aria-busy="true"] > .nd-base, .nai-desk .nd-body[aria-busy="true"] > .nd-characters { opacity: .55; }
.nai-desk .nd-history-bar {
  position: sticky; top: -12px; z-index: 2; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
  margin: -12px -16px 0; padding-block: 8px; padding-inline: 16px 12px; background: var(--dsw-alias-bg-base);
  border-bottom: .5px solid var(--dsw-alias-border-l3); font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary);
}
.nai-desk .nd-history-meta { display: flex; flex-wrap: wrap; gap: 0 8px; min-width: 0; }
.nai-desk .nd-history-meta strong { color: var(--dsw-alias-label-primary); font-weight: 500; }
.nai-desk .nd-history-actions { display: flex; gap: 6px; margin-inline-start: auto; }

/* Glass card: no border; the stroke is the first layer of the elevation shadow
 * and is rebound per element, as on the composer and in-chat cards. */
.nai-desk .nd-card {
  display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 12px;
  border: 0; border-radius: var(--dsw-radius-xl); background: var(--dsw-specific-input-major);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l2); box-shadow: var(--dsw-elevation-panel);
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2); --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
  transition: box-shadow 160ms var(--ds-ease-in-out);
}
.nai-desk .nd-card:has(.nd-editor:focus) { --dsw-elevation-stroke-color: var(--dsw-alias-state-business-primary); }
.nai-desk .nd-card-head { display: flex; align-items: center; gap: 6px; min-height: 28px; min-width: 0; }
.nai-desk .nd-head-fill { flex: 1 1 auto; }
.nai-desk .nd-card-body { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
/* The textarea and the layer behind it share every box and text metric so placeholder chips line up. */
.nai-desk .nd-editor-wrap { position: relative; min-width: 0; }
.nai-desk .nd-editor {
  display: block; width: 100%; min-width: 0; margin: 0; padding: 0 2px; border: 0; outline: none; resize: none;
  background: transparent; color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family); font-size: var(--dsh-content-font-size, 14px); line-height: 1.6; letter-spacing: normal;
  white-space: pre-wrap; overflow-wrap: break-word; scrollbar-gutter: stable;
  field-sizing: content; min-height: 3lh; max-height: 18lh; overflow-y: auto;
}
.nai-desk textarea.nd-editor { position: relative; z-index: 1; }
.nai-desk .nd-editor-layer { position: absolute; inset: 0; z-index: 0; overflow: hidden; color: transparent; pointer-events: none; field-sizing: fixed; min-height: 0; max-height: none; }
.nai-desk .nd-editor-layer .nd-token { color: transparent; }
.nai-desk .nd-token {
  border-radius: var(--dsw-radius-xs); background: var(--dsw-alias-interactive-bg-active);
  box-shadow: 0 0 0 .5px var(--dsw-alias-border-l3); color: inherit;
}
.nai-desk .nd-base .nd-editor { min-height: 5lh; }
.nai-desk .nd-editor[readonly] { cursor: default; }
.nai-desk .nd-hint {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0;
  font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary);
}
.nai-desk .nd-hint-text { display: flex; align-items: center; gap: 8px; min-width: 0; }
.nai-desk .nd-hint-text .nd-token { flex: none; padding: 0 4px; color: var(--dsw-alias-label-secondary); }
.nai-desk .nd-hint-secret { min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap; color: var(--dsw-alias-label-secondary); }
.nai-desk .nd-hint .nd-button { gap: 4px; }
.nai-desk .nd-editor::placeholder { color: var(--dsw-alias-label-caption); opacity: 1; }

/* SegmentedControl: one indicator, equal tracks and roving keyboard focus. */
.nai-desk .nd-tabs {
  position: relative; align-self: flex-start; display: inline-grid; grid-auto-flow: column; grid-auto-columns: 1fr;
  gap: 2px; padding: 4px; border-radius: var(--dsw-radius-md); background: var(--dsw-alias-interactive-bg-hover); min-width: 0;
}
.nai-desk .nd-tab-indicator {
  position: absolute; top: 4px; inset-inline-start: 4px;
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
.nai-desk:dir(rtl) .nd-tab-indicator { transform: translateX(calc(var(--nd-segment-index) * (-100% - 2px))); }
.nai-desk .nd-tab { display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
.nai-desk .nd-tab[aria-selected="true"] { color: var(--dsw-alias-label-primary); }
.nai-desk .nd-tab-mark { display: inline-flex; color: var(--dsw-alias-label-tertiary); }
.nai-desk .nd-tab-mark svg { width: 14px; height: 14px; }

/* Characters: settings rows with an inline-editable name. Space, not a heading,
 * separates them from the base card: 24px between the groups, 12px within. */
.nai-desk .nd-characters { display: flex; flex-direction: column; gap: 12px; margin-block-start: 12px; }
.nai-desk .nd-notice-region:empty { margin-block-start: -12px; }
.nai-desk .nd-gender { display: inline-flex; flex: none; padding-inline-start: 2px; color: var(--dsw-alias-label-tertiary); }
.nai-desk .nd-name {
  flex: 1 1 auto; min-width: 0; height: 28px; padding: 0 6px; border: .5px solid transparent; border-radius: var(--dsw-radius-sm);
  outline: none; background: transparent; color: var(--dsw-alias-label-primary); font-size: 14px; line-height: 22px; font-weight: 500;
  text-overflow: ellipsis;
}
.nai-desk .nd-name::placeholder { color: var(--dsw-alias-label-caption); opacity: 1; }
.nai-desk .nd-name:not([readonly]):focus { border-color: var(--dsw-alias-state-business-primary); }
.nai-desk .nd-actions { display: flex; align-items: center; gap: 2px; flex: none; }
.nai-desk .nd-actions .nd-switch { margin-inline: 4px; }
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

/* Action menu: the host's translucent menu card, 34px rows, destructive row in the error color. */
.nai-desk .nd-menu { position: relative; display: inline-flex; flex: none; }
.nai-desk .nd-menu-list {
  position: absolute; top: calc(100% + 4px); inset-inline-end: 0; z-index: 100; box-sizing: border-box;
  display: flex; flex-direction: column; min-width: 144px; max-width: 360px; padding: 4px;
  border: 0; border-radius: var(--dsw-radius-lg); background: var(--dsw-menu-surface-fill); backdrop-filter: var(--dsw-menu-backdrop-filter);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1); box-shadow: var(--dsw-elevation-prominent);
}
.nai-desk .nd-menu-above { top: auto; bottom: calc(100% + 4px); }
.nai-desk .nd-menu-item {
  display: flex; align-items: center; gap: 6px; width: 100%; min-height: 34px; padding: 6px 8px;
  border: none; border-radius: var(--dsw-radius-md); background: transparent; cursor: pointer;
  color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; text-align: start;
}
.nai-desk .nd-menu-item:focus-visible:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); outline: none; }
.nai-desk .nd-menu-item:disabled { opacity: .4; cursor: not-allowed; }
.nai-desk .nd-menu-icon { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 14px; height: 14px; color: var(--dsw-alias-menu-icon); }
.nai-desk .nd-menu-icon svg { width: 14px; height: 14px; }
.nai-desk .nd-menu-label { flex: 1; min-width: 0; white-space: nowrap; }
.nai-desk .nd-menu-danger, .nai-desk .nd-menu-danger .nd-menu-icon { color: var(--dsw-alias-state-error-primary); }
.nai-desk .nd-menu-danger:focus-visible:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger); }
.nai-desk .nd-menu-separator { height: .5px; margin: 3px 2px; background: var(--dsw-alias-border-l2); }

/* Button: compact 28/R8, standard 36/R12. */
.nai-desk .nd-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px; flex-shrink: 0; padding: 0 14px;
  border: none; border-radius: var(--dsw-radius-md); background: transparent; color: var(--dsw-alias-label-primary); cursor: pointer;
}
.nai-desk .nd-button-md { height: 36px; font-size: 14px; line-height: 20px; }
.nai-desk .nd-button-sm { height: 28px; padding: 0 10px; border-radius: var(--dsw-radius-sm); font-size: 12px; line-height: 18px; }
.nai-desk .nd-button-outline { border: .5px solid var(--dsw-alias-border-l3); }
.nai-desk .nd-button-primary { background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); }
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
.nai-desk .nd-conflict textarea:focus-visible { border-color: var(--dsw-alias-state-business-primary); }
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
  .nai-desk .nd-tool:hover:not(:disabled):not([aria-disabled="true"]) { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
  .nai-desk .nd-menu-item:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
  .nai-desk .nd-menu-danger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger); }
  .nd-turn-card:hover { background: var(--nd-turn-card-hover); }
  .nai-desk .nd-button:hover:not(:disabled), .nai-desk .nd-creator:hover:not(:disabled), .nai-desk .nd-name:not([readonly]):hover:not(:focus) { background: var(--dsw-alias-interactive-bg-hover); }
  .nai-desk .nd-button-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
  .nai-desk .nd-tab:hover { color: var(--dsw-alias-label-primary); }
}
/* The character head keeps one line down to 320px; only the gutters and tabs tighten. */
@container (max-width: 370px) {
  .nai-desk .nd-body { padding-inline: 12px; }
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

/* In-chat card under a Turn that wrote the draft: the plan card treatment. */
.nd-turn-cards { display: flex; flex-direction: column; gap: 10px; }
.nd-turn-card {
  --nd-turn-card-fill: var(--dsw-static-neutral-50); --nd-turn-card-hover: var(--dsw-static-neutral-100);
  box-sizing: border-box; display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; height: 60px; margin: 0; padding: 8px 10px;
  border: .5px solid var(--dsw-alias-border-l1); border-radius: var(--dsw-radius-lg); background: var(--nd-turn-card-fill);
  color: var(--dsw-alias-label-primary); font: inherit; text-align: start; cursor: pointer; transition: background-color 120ms ease;
}
body[data-ds-dark-theme] .nd-turn-card { --nd-turn-card-fill: var(--dsw-static-neutral-850); --nd-turn-card-hover: var(--dsw-static-neutral-800); }
.nd-turn-card:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 3px; }
.nd-turn-card-icon {
  box-sizing: border-box; flex: none; display: grid; place-items: center; width: 40px; height: 40px; border: .5px solid var(--dsw-alias-border-l1);
  border-radius: 10px; background: color-mix(in srgb, var(--dsw-static-neutral-00) 50%, transparent); color: var(--dsw-alias-label-secondary);
}
body[data-ds-dark-theme] .nd-turn-card-icon { background: color-mix(in srgb, var(--dsw-static-neutral-00) 5%, transparent); }
.nd-turn-card-details { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
.nd-turn-card-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 500; line-height: 20px; }
.nd-turn-card-description { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-tertiary); font-size: 10px; line-height: 16px; }
.nd-turn-card-open {
  box-sizing: border-box; display: inline-flex; flex: none; align-items: center; height: 28px; padding: 4px 8px;
  border: .5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-sm); background: var(--dsw-alias-button-floating-fill); font-size: 12px; line-height: 18px;
}
@media (prefers-reduced-motion: reduce) { .nd-turn-card, .nai-desk .nd-card, .nai-desk .nd-body > * { transition: none; } }
`;

// src/client.jsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var inject = ["slots", "sidebarRightTabs", "sidebarRight", "sessions", "uiSession", "uiConversation"];
var AUTO_OPENED = "dsh.nai-desk.auto-opened.v1";
function autoOpened() {
  try {
    const list = JSON.parse(localStorage.getItem(AUTO_OPENED) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function markAutoOpened(id) {
  try {
    localStorage.setItem(AUTO_OPENED, JSON.stringify([...autoOpened().filter((item) => item !== id), id].slice(-200)));
  } catch {
  }
}
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
        guide: [{ id: "open", order: 45, title: () => "\u63D0\u793A\u8BCD\u7A3F\u7EB8", description: () => "\u7F16\u8F91\u5F53\u524D\u4F1A\u8BDD\u7684\u4E3B\u63D0\u793A\u8BCD\u3001\u89D2\u8272\u548C UC", icon: () => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { kind: "notebook" }) }]
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
  const openDesk = () => {
    try {
      ctx.sidebarRight.openTab(PANEL_KIND);
    } catch {
    }
  };
  ctx.effect(() => {
    const current = ctx.uiSession.adapter.current;
    const list = ctx.sessions.list;
    let watched, release, stop;
    const sync = () => {
      const id = current.getSnapshot().key;
      const next = list.getSnapshot().byId[id]?.projectionValues?.agentPreset === PRESET_ID ? id : void 0;
      if (next === watched) return;
      stop?.();
      release?.();
      stop = release = void 0;
      watched = next;
      if (!next) return;
      stop = getClient(next).onRemoteChange((draft) => {
        if (draft.updatedBy !== "model" || autoOpened().includes(next) || current.getSnapshot().key !== next) return;
        markAutoOpened(next);
        openDesk();
      });
      release = acquireClient(next);
    };
    const offCurrent = current.subscribe(sync), offList = list.subscribe(sync);
    sync();
    return () => {
      offCurrent();
      offList();
      stop?.();
      release?.();
    };
  }, "nai-desk: open on the first model write");
  ctx.uiConversation.events.register(deskTurnDefinition);
  ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
    name: "conversation.chat.turnTail",
    id: "nai-desk",
    order: 30,
    inject: () => ({ openDesk })
  }, DeskTurnCard));
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
