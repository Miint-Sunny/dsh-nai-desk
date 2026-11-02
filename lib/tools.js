// src/desk.js
var LIMITS = Object.freeze({ characters: 22, fieldCharacters: 32768, nameCharacters: 128, recordBytes: 1024 * 1024 });
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
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) invalid("sessionId \u65E0\u6548");
  return value;
}

// src/tools.js
var string = { type: "string" };
var positionSchema = { type: "object", properties: { x: { type: "number", description: "0\u20131" }, y: { type: "number", description: "0\u20131" } }, required: ["x", "y"], additionalProperties: false };
var snapshotSchema = {
  type: "object",
  properties: {
    schemaVersion: { type: "integer" },
    sessionId: string,
    revision: { type: "integer" },
    main: string,
    uc: string,
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: { id: string, name: string, prompt: string, uc: string, enabled: { type: "boolean" }, position: positionSchema },
        required: ["id", "name", "prompt", "uc", "enabled"],
        additionalProperties: false
      }
    }
  },
  required: ["schemaVersion", "sessionId", "revision", "main", "uc", "characters"],
  additionalProperties: false
};
var revision = { type: "integer", description: "desk_read \u6216\u4E0A\u6B21\u6210\u529F\u5199\u5165\u8FD4\u56DE\u7684\u975E\u8D1F revision\u3002\u53D1\u751F\u51B2\u7A81\u65F6\u91CD\u65B0\u8BFB\uFF0C\u4E0D\u731C\u7248\u672C\u3002" };
var number = { type: "integer", description: `\u4ECE 1 \u5F00\u59CB\uFF0C\u6700\u5927 ${LIMITS.characters}` };
var writeHint = "\u53EA\u4FEE\u6539\u6307\u5B9A\u5B57\u6BB5\uFF0C\u5176\u4ED6\u5185\u5BB9\u4FDD\u7559\u3002\u5199\u524D\u8BFB desk_read\uFF1Bexpected_revision \u5FC5\u987B\u4F7F\u7528\u8BFB\u5230\u7684\u7248\u672C\uFF0C\u51B2\u7A81\u65F6\u91CD\u65B0\u8BFB\u53D6\u3002";
function callingSession(exec) {
  exec?.signal?.throwIfAborted();
  return sessionKey(exec?.agent?.session?.id);
}
function slot(n, maximum) {
  if (!Number.isInteger(n) || n < 1 || n > maximum) throw new DeskError("invalid_input", `\u89D2\u8272\u5E8F\u53F7\u5FC5\u987B\u5728 1 \u5230 ${maximum} \u4E4B\u95F4\uFF0C\u4E0D\u80FD\u8DF3\u53F7`);
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
        if (!Number.isSafeInteger(args.expected_revision) || args.expected_revision < 0) throw new DeskError("invalid_input", "expected_revision \u5FC5\u987B\u662F\u5F53\u524D\u7A3F\u7EB8\u7684 revision");
        throw new DeskError("conflict", "\u7A3F\u7EB8\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u5148\u91CD\u65B0\u8C03\u7528 desk_read", state);
      }
      const operation = build(args, state);
      exec?.signal?.throwIfAborted();
      return store.mutate(id, args.expected_revision, operation);
    }
  );
  return [
    define("desk_read", "\u8BFB\u53D6\u5F53\u524D\u4F1A\u8BDD\u7A3F\u7EB8\u7684\u4E3B\u4E32 main\u3001\u603B\u8D1F\u9762 uc\u3001\u89D2\u8272\u680F\u53CA revision\u3002\u7528\u6237\u5728\u53F3\u4FA7\u9762\u677F\u7684\u624B\u52A8\u7F16\u8F91\u4E5F\u5728\u8FD9\u91CC\u3002\u4FEE\u6539\u524D\u5148\u8BFB\uFF0C\u53EA\u6539\u7528\u6237\u8981\u6C42\u7684\u90E8\u5206\u3002", {}, [], async (_args, exec) => store.read(callingSession(exec))),
    write("desk_set_main", "\u5C06\u5B9A\u7A3F\u4E3B\u4E32\u5199\u5165\u5F53\u524D\u4F1A\u8BDD\u7684 Base Prompt\uFF08\u6574\u6BB5\u8986\u76D6\uFF09\u3002\u4E0D\u751F\u6210\u56FE\u7247\u3001\u4E0D\u5199\u5B98\u7F51\u3001\u4E0D\u6539\u89D2\u8272\u548C UC\u3002", { text: string }, ["text"], (args) => ({ type: "set_main", text: args.text })),
    write("desk_set_uc", "\u5C06\u603B\u8D1F\u9762\u63D0\u793A\u8BCD\u5199\u5165\u5F53\u524D\u4F1A\u8BDD\u7684 UC\u3002\u4EC5\u5728\u7528\u6237\u9700\u8981\u65F6\u586B\u5199\uFF0C\u4E0D\u64C5\u81EA\u8865\u4E2A\u4EBA\u9ED8\u8BA4 UC\u3002", { text: string }, ["text"], (args) => ({ type: "set_uc", text: args.text })),
    write("desk_set_character", "\u5199\u7B2C n \u4E2A\u89D2\u8272\u680F\uFF08\u4ECE 1 \u5F00\u59CB\uFF09\uFF0C\u6216\u5728\u672B\u5C3E\u6DFB\u52A0\u3002prompt \u662F\u6B63\u5411\u6B63\u6587\uFF1Buc\u3001name\u3001enabled\u3001position \u7701\u7565\u65F6\u4FDD\u7559\u3002position \u4E3A null \u65F6\u6062\u590D\u81EA\u52A8\u4F4D\u7F6E\u3002\u4E0D\u4F1A\u8BFB\u53D6\u89D2\u8272\u5E93\u3002", {
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
    write("desk_remove_character", "\u5220\u9664\u7B2C n \u4E2A\u89D2\u8272\u680F\u3002\u89D2\u8272\u6B63\u6587\u4F1A\u4ECE\u7A3F\u7EB8\u79FB\u9664\uFF1B\u4EC5\u5728\u7528\u6237\u8981\u6C42\u5220\u9664\u65F6\u4F7F\u7528\u3002", { n: number }, ["n"], (args, state) => ({ type: "remove_character", id: state.characters[slot(args.n, state.characters.length)].id })),
    write("desk_move_character", "\u628A\u7B2C n \u4E2A\u89D2\u8272\u680F\u79FB\u52A8\u5230\u7B2C to \u4F4D\uFF08\u5747\u4ECE 1 \u5F00\u59CB\uFF09\u3002\u6587\u5B57\u3001\u89D2\u8272\u8EAB\u4EFD\u4E0E\u542F\u7528\u72B6\u6001\u4E00\u540C\u79FB\u52A8\u3002", { n: number, to: number }, ["n", "to"], (args, state) => ({ type: "move_character", id: state.characters[slot(args.n, state.characters.length)].id, index: slot(args.to, state.characters.length) }))
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
