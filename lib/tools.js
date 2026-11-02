// src/mask.js
var MASK_TOKEN = /⟪屏蔽\d{1,4}⟫/g;
var tokensIn = (value) => value.match(MASK_TOKEN) ?? [];

// src/desk.js
var LIMITS = Object.freeze({ characters: 22, fieldCharacters: 32768, nameCharacters: 128, recordBytes: 1024 * 1024, secrets: 200 });
var HISTORY = Object.freeze({ steps: 60, bytes: 4 * 1024 * 1024, mergeMs: Object.freeze({ model: 45e3, user: 9e4 }) });
var DeskError = class extends Error {
  constructor(code, message, current) {
    super(message);
    this.name = "DeskError";
    this.code = code;
    if (current) this.current = structuredClone(current);
  }
};
var invalid = (message) => {
  throw new DeskError("invalid_input", message);
};
function sessionKey(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) invalid("\u6807\u8BC6\u683C\u5F0F\u65E0\u6548\uFF1A\u4F7F\u7528 1\u2013128 \u4F4D ASCII \u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u6216\u8FDE\u5B57\u7B26\u3002");
  return value;
}

// src/tools.js
var string = { type: "string" };
var positionSchema = { type: "object", properties: { x: { type: "number", description: "\u5F52\u4E00\u5316\u6C34\u5E73\u4F4D\u7F6E\uFF0C\u8303\u56F4 0\u20131\uFF0C\u4ECE\u5DE6\u5230\u53F3\u3002" }, y: { type: "number", description: "\u5F52\u4E00\u5316\u5782\u76F4\u4F4D\u7F6E\uFF0C\u8303\u56F4 0\u20131\uFF0C\u4ECE\u4E0A\u5230\u4E0B\u3002" } }, required: ["x", "y"], additionalProperties: false };
var snapshotSchema = {
  type: "object",
  properties: {
    schemaVersion: { type: "integer" },
    sessionId: string,
    revision: { type: "integer" },
    main: string,
    uc: string,
    masked: { type: "object", properties: { main: { type: "boolean" }, uc: { type: "boolean" } }, additionalProperties: false, description: "\u88AB\u7528\u6237\u6574\u680F\u5C4F\u853D\u7684\u5B57\u6BB5\uFF0C\u5BF9\u5E94\u6587\u672C\u53EA\u662F\u5360\u4F4D\uFF0C\u4E0D\u80FD\u8BFB\u5199\u3002" },
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: { id: string, name: string, prompt: string, uc: string, enabled: { type: "boolean" }, position: positionSchema, masked: { type: "boolean", description: "\u4E3A true \u65F6\u7528\u6237\u5DF2\u5411\u4F60\u5C4F\u853D\u8FD9\u4E2A\u89D2\u8272\uFF1Aname\u3001prompt\u3001uc \u53EA\u662F\u5360\u4F4D\uFF0C\u4E0D\u80FD\u8BFB\u5199\u3002" } },
        required: ["id", "name", "prompt", "uc", "enabled"],
        additionalProperties: false
      }
    }
  },
  required: ["schemaVersion", "sessionId", "revision", "main", "uc", "characters"],
  additionalProperties: false
};
var WHOLE = (count) => `\u27EA\u6574\u680F\u5DF2\u5C4F\u853D\uFF0C\u7EA6 ${count} \u5B57\u27EB`;
var maskRule = "\u6587\u672C\u4E2D\u7684 \u27EA\u5C4F\u853DN\u27EB \u662F\u7528\u6237\u5411\u4F60\u9690\u85CF\u7684\u5185\u5BB9\uFF1A\u4F60\u770B\u4E0D\u5230\u539F\u6587\uFF0C\u6539\u5199\u6240\u5728\u5B57\u6BB5\u65F6\u5FC5\u987B\u539F\u6837\u4FDD\u7559\u6BCF\u4E2A\u5360\u4F4D\uFF08\u4F4D\u7F6E\u53EF\u4EE5\u6309\u8BED\u4E49\u8C03\u6574\uFF09\uFF0C\u4E5F\u4E0D\u8981\u81EA\u5DF1\u7F16\u9020\u5360\u4F4D\u3002";
function modelView(state) {
  const view = { schemaVersion: state.schemaVersion, sessionId: state.sessionId, revision: state.revision, main: state.main, uc: state.uc };
  if (state.mask) {
    view.masked = {};
    for (const key of ["main", "uc"]) if (state.mask[key]) {
      view[key] = WHOLE(state[key].length);
      view.masked[key] = true;
    }
  }
  view.characters = state.characters.map((c) => {
    const shown = { id: c.id, name: c.name, prompt: c.prompt, uc: c.uc, enabled: c.enabled, ...c.position ? { position: c.position } : {} };
    return c.masked ? { ...shown, name: "\u27EA\u5DF2\u5C4F\u853D\u27EB", prompt: WHOLE(c.prompt.length), uc: WHOLE(c.uc.length), masked: true } : shown;
  });
  return view;
}
function keepsPlaceholders(state, before, after, label) {
  const missing = [...new Set(tokensIn(before))].filter((token) => !after.includes(token));
  if (missing.length) throw new DeskError("masked", `${label}\u91CC\u6F0F\u6389\u4E86\u5C4F\u853D\u5360\u4F4D ${missing.join("\u3001")}\u3002\u8FD9\u4E9B\u5360\u4F4D\u4EE3\u8868\u7528\u6237\u4E0D\u8BA9\u4F60\u770B\u5230\u7684\u5185\u5BB9\uFF0C\u8BF7\u539F\u6837\u4FDD\u7559\u540E\u91CD\u65B0\u63D0\u4EA4\u3002`);
  const unknown = [...new Set(tokensIn(after))].filter((token) => state.secrets?.[token] === void 0);
  if (unknown.length) throw new DeskError("masked", `${unknown.join("\u3001")} \u4E0D\u662F\u8FD9\u4EFD\u7A3F\u7EB8\u91CC\u7684\u5C4F\u853D\u5360\u4F4D\uFF0C\u4E0D\u8981\u81EA\u5DF1\u7F16\u9020\u5360\u4F4D\u3002`);
}
var blocked = (label) => new DeskError("masked", `${label}\u5DF2\u88AB\u7528\u6237\u5411\u4F60\u5C4F\u853D\uFF0C\u4E0D\u80FD\u8BFB\u53D6\u6216\u4FEE\u6539\u3002\u4FDD\u7559\u539F\u6837\u5373\u53EF\uFF1B\u9700\u8981\u6539\u52A8\u65F6\u8BF7\u7528\u6237\u81EA\u5DF1\u5904\u7406\u3002`);
function checkModelWrite(state, operation) {
  switch (operation.type) {
    case "set_main":
    case "set_uc": {
      const key = operation.type === "set_main" ? "main" : "uc";
      const label = key === "main" ? "\u4E3B\u63D0\u793A\u8BCD" : "\u8D1F\u9762\u63D0\u793A\u8BCD";
      if (state.mask?.[key]) throw blocked(label);
      keepsPlaceholders(state, state[key], operation.text, label);
      break;
    }
    case "add_character":
      for (const key of ["prompt", "uc"]) keepsPlaceholders(state, "", operation.character[key] ?? "", "\u65B0\u89D2\u8272");
      break;
    case "set_character": {
      const target = state.characters.find((c) => c.id === operation.id);
      const index = state.characters.indexOf(target) + 1;
      if (target.masked) throw blocked(`\u89D2\u8272 ${index}`);
      for (const key of ["prompt", "uc"]) if (operation.patch[key] !== void 0) keepsPlaceholders(state, target[key], operation.patch[key], `\u89D2\u8272 ${index} \u7684${key === "uc" ? " UC " : "\u63D0\u793A\u8BCD"}`);
      break;
    }
    case "remove_character": {
      const target = state.characters.find((c) => c.id === operation.id);
      const index = state.characters.indexOf(target) + 1;
      if (target.masked) throw blocked(`\u89D2\u8272 ${index}`);
      if (tokensIn(target.prompt + target.uc).length) throw new DeskError("masked", `\u89D2\u8272 ${index} \u542B\u6709\u7528\u6237\u5C4F\u853D\u7684\u5185\u5BB9\uFF0C\u4E0D\u80FD\u7531\u4F60\u5220\u9664\u3002\u9700\u8981\u5220\u9664\u65F6\u8BF7\u7528\u6237\u81EA\u5DF1\u5904\u7406\u3002`);
      break;
    }
  }
  return operation;
}
var revision = { type: "integer", description: "\u4F7F\u7528\u6700\u8FD1\u4E00\u6B21\u8BFB\u53D6\u6216\u6210\u529F\u5199\u5165\u8FD4\u56DE\u7684 revision\u3002\u7248\u672C\u51B2\u7A81\u540E\u987B\u91CD\u65B0\u8BFB\u53D6\u8349\u7A3F\u3002" };
var number = { type: "integer", description: `\u89D2\u8272\u5E8F\u53F7\u4ECE 1 \u5F00\u59CB\uFF0C\u5B9E\u9645\u8303\u56F4\u53D6\u51B3\u4E8E\u5F53\u524D\u8349\u7A3F\uFF0C\u6700\u591A ${LIMITS.characters} \u6761\u3002` };
var writeHint = "expected_revision \u7528\u4E8E\u7248\u672C\u68C0\u67E5\u3002\u53D1\u751F\u51B2\u7A81\u65F6\u5148\u8BFB\u53D6\u5F53\u524D\u8349\u7A3F\uFF0C\u518D\u51B3\u5B9A\u9700\u8981\u63D0\u4EA4\u7684\u4FEE\u6539\u3002\u6539\u5199\u542B \u27EA\u5C4F\u853DN\u27EB \u7684\u5B57\u6BB5\u65F6\u539F\u6837\u4FDD\u7559\u5360\u4F4D\uFF1B\u7528\u6237\u6574\u680F\u5C4F\u853D\u7684\u5B57\u6BB5\u548C\u89D2\u8272\u4E0D\u80FD\u5199\u5165\u3002";
function callingSession(exec) {
  exec?.signal?.throwIfAborted();
  return sessionKey(exec?.agent?.session?.id);
}
function slot(n, maximum) {
  if (maximum === 0) throw new DeskError("invalid_input", "\u5F53\u524D\u8349\u7A3F\u6CA1\u6709\u53EF\u64CD\u4F5C\u7684\u89D2\u8272\u63D0\u793A\u8BCD\u6761\u76EE\u3002");
  if (!Number.isInteger(n) || n < 1 || n > maximum) throw new DeskError("invalid_input", `\u89D2\u8272\u5E8F\u53F7\u987B\u4E3A 1 \u5230 ${maximum} \u4E4B\u95F4\u7684\u6574\u6570\u3002\u8BF7\u91CD\u65B0\u8BFB\u53D6\u8349\u7A3F\u786E\u8BA4\u5E8F\u53F7\u3002`);
  return n - 1;
}
function createDeskTools(store) {
  const define = (name2, description, properties, required, execute) => ({
    name: name2,
    description,
    parameters: { type: "object", properties, required, additionalProperties: false },
    output: { schema: snapshotSchema, render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }] },
    isConcurrencySafe: () => name2 === "desk_read",
    execute
  });
  const write = (name2, description, properties, required, build) => define(
    name2,
    `${description} ${writeHint}`,
    { expected_revision: revision, ...properties },
    ["expected_revision", ...required],
    async (args, exec) => {
      const id = callingSession(exec);
      const state = await store.read(id);
      if (state.revision !== args.expected_revision) {
        if (!Number.isSafeInteger(args.expected_revision) || args.expected_revision < 0) throw new DeskError("invalid_input", "expected_revision \u987B\u4F7F\u7528\u8BFB\u53D6\u7ED3\u679C\u4E2D\u7684\u975E\u8D1F\u6574\u6570\u7248\u672C\u3002");
        throw new DeskError("conflict", "\u8349\u7A3F\u7248\u672C\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u8C03\u7528 desk_read \u540E\u63D0\u4EA4\u3002", modelView(state));
      }
      const operation = checkModelWrite(state, build(args, state));
      exec?.signal?.throwIfAborted();
      try {
        return modelView(await store.mutate(id, args.expected_revision, operation, { source: "model" }));
      } catch (error) {
        if (error instanceof DeskError && error.current) throw new DeskError(error.code, error.message, modelView(error.current));
        throw error;
      }
    }
  );
  return [
    define("desk_read", `\u8FD4\u56DE\u5F53\u524D\u4F1A\u8BDD\u63D0\u793A\u8BCD\u8349\u7A3F\u7684\u5DF2\u63D0\u4EA4\u5FEB\u7167\uFF0C\u5305\u62EC main\u3001uc\u3001characters \u548C revision\u3002\u5FEB\u7167\u5305\u542B\u7F16\u8F91\u5668\u5DF2\u6210\u529F\u4FDD\u5B58\u7684\u4FEE\u6539\u3002${maskRule}masked \u6807\u51FA\u7528\u6237\u6574\u680F\u5C4F\u853D\u7684\u5B57\u6BB5\u548C\u89D2\u8272\uFF0C\u5B83\u4EEC\u53EA\u662F\u5360\u4F4D\u3002`, {}, [], async (_args, exec) => modelView(await store.read(callingSession(exec)))),
    write("desk_set_main", "\u66FF\u6362\u5F53\u524D\u4F1A\u8BDD\u8349\u7A3F\u7684\u4E3B\u63D0\u793A\u8BCD\u5168\u6587\uFF0C\u4FDD\u7559\u8D1F\u9762\u63D0\u793A\u8BCD\u4E0E\u89D2\u8272\u6761\u76EE\u3002text \u4E0D\u505A\u683C\u5F0F\u5316\u6216\u53BB\u91CD\u3002", { text: string }, ["text"], (args) => ({ type: "set_main", text: args.text })),
    write("desk_set_uc", "\u66FF\u6362\u5F53\u524D\u4F1A\u8BDD\u8349\u7A3F\u7684\u8349\u7A3F\u7EA7\u8D1F\u9762\u63D0\u793A\u8BCD\u5168\u6587\uFF0C\u4FDD\u7559\u5176\u5B83\u5B57\u6BB5\u3002", { text: string }, ["text"], (args) => ({ type: "set_uc", text: args.text })),
    write("desk_set_character", "\u66F4\u65B0\u5F53\u524D\u5FEB\u7167\u4E2D\u7B2C n \u4E2A\u89D2\u8272\u63D0\u793A\u8BCD\u6761\u76EE\uFF1Bn \u7B49\u4E8E\u6761\u76EE\u6570\u52A0 1 \u65F6\u8FFD\u52A0\u65B0\u6761\u76EE\u3002prompt \u5FC5\u586B\uFF1B\u66F4\u65B0\u65F6\u7701\u7565\u7684 uc\u3001name\u3001enabled\u3001position \u4FDD\u7559\u539F\u503C\u3002position \u4E3A null \u65F6\u6E05\u9664\u81EA\u5B9A\u4E49\u4F4D\u7F6E\u3002", {
      n: number,
      prompt: string,
      uc: string,
      name: string,
      enabled: { type: "boolean" },
      position: { oneOf: [positionSchema, { type: "null" }] }
    }, ["n", "prompt"], (args, state) => {
      const index = slot(args.n, state.characters.length + 1);
      const patch = { prompt: args.prompt };
      for (const key of ["uc", "name", "enabled", "position"]) if (args[key] !== void 0) patch[key] = args[key];
      if (index === state.characters.length) {
        if (patch.position === null) delete patch.position;
        return { type: "add_character", character: patch };
      }
      return { type: "set_character", id: state.characters[index].id, patch };
    }),
    write("desk_remove_character", "\u5220\u9664\u5F53\u524D\u8349\u7A3F\u4E2D\u7B2C n \u4E2A\u89D2\u8272\u63D0\u793A\u8BCD\u6761\u76EE\uFF0C\u5305\u62EC\u5176\u6B63\u5411\u6587\u672C\u3001UC \u548C\u5143\u6570\u636E\u3002\u540E\u7EED\u6761\u76EE\u7684\u5E8F\u53F7\u76F8\u5E94\u53D8\u5316\u3002", { n: number }, ["n"], (args, state) => ({ type: "remove_character", id: state.characters[slot(args.n, state.characters.length)].id })),
    write("desk_move_character", "\u5C06\u7B2C n \u4E2A\u89D2\u8272\u63D0\u793A\u8BCD\u6761\u76EE\u79FB\u81F3\u7B2C to \u4F4D\uFF1B\u4E24\u4E2A\u5E8F\u53F7\u5747\u4ECE 1 \u5F00\u59CB\u3002\u6761\u76EE\u7684\u7A33\u5B9A id \u548C\u5168\u90E8\u5B57\u6BB5\u4FDD\u6301\u4E0D\u53D8\u3002", { n: number, to: number }, ["n", "to"], (args, state) => ({ type: "move_character", id: state.characters[slot(args.n, state.characters.length)].id, index: slot(args.to, state.characters.length) }))
  ];
}

// src/tools-plugin.js
var name = "nai-desk-preset-tools";
var inject = ["naiDesk", "tools"];
function apply(ctx) {
  ctx.effect(() => {
    const disposers = createDeskTools(ctx.naiDesk).map((tool) => ctx.tools.register(tool));
    return () => {
      for (const dispose of disposers.reverse()) dispose();
    };
  }, "nai-desk: preset tools");
}
export {
  apply,
  inject,
  name
};
