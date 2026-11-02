// src/isolation.js
import z from "@deepseek-ai/schemastery";
var name = "nai5-prompting-isolation";
var inject = ["tools", "skills"];
var RUN_CODE = "run_code";
var SHADOW_PROVIDER = "nai5-prompting-hidden-global";
var SHADOW_RANK = 1e6;
var SHADOW_DESCRIPTION = "Global skill hidden in the NAI5 prompting preset.";
var HIDDEN = Object.freeze({ modelInvocable: false, userInvocable: false });
var Config = z.object({
  hideGlobalTools: z.boolean().default(true).description("\u5728\u672C\u9884\u8BBE\u91CC\u9690\u85CF\u5168\u5C40\u5DE5\u5177\uFF08MCP\u3001\u5BBF\u4E3B\u63D2\u4EF6\u3001\u684C\u9762\u7AEF\u9644\u52A0\u5DE5\u5177\uFF09\uFF1B\u672C\u9884\u8BBE\u81EA\u5DF1\u6302\u8F7D\u7684\u5DE5\u5177\u4E0D\u53D7\u5F71\u54CD"),
  keepGlobalTools: z.array(z.string()).default([]).description("\u9690\u85CF\u5168\u5C40\u5DE5\u5177\u65F6\u4ECD\u4FDD\u7559\u7684\u5168\u5C40\u5DE5\u5177\u540D\uFF0C\u4F8B\u5982\u67D0\u4E2A MCP \u5DE5\u5177\u7684\u5B8C\u6574\u540D\u5B57"),
  hideGlobalSkills: z.boolean().default(true).description("\u5728\u672C\u9884\u8BBE\u91CC\u9690\u85CF\u5168\u5C40\u6280\u80FD\uFF08\u4F8B\u5982\u684C\u9762\u7AEF\u81EA\u5E26\u7684 Office \u6280\u80FD\uFF09\uFF0C\u6280\u80FD\u76EE\u5F55\u53EA\u7559\u672C\u9884\u8BBE\u6302\u8F7D\u7684\u6280\u80FD"),
  keepGlobalSkills: z.array(z.string()).default([]).description("\u9690\u85CF\u5168\u5C40\u6280\u80FD\u65F6\u4ECD\u4FDD\u7559\u7684\u5168\u5C40\u6280\u80FD\u540D")
});
function apply(ctx, config) {
  if (config.hideGlobalTools) hideGlobalTools(ctx, new Set(config.keepGlobalTools));
  if (config.hideGlobalSkills) hideGlobalSkills(ctx, new Set(config.keepGlobalSkills));
}
function pendingDenials(ctx, keep, denied) {
  const names = [];
  for (const schema of ctx.tools.schemas()) {
    const toolName = schema.name;
    if (toolName === RUN_CODE || keep.has(toolName) || denied.has(toolName)) continue;
    names.push(toolName);
  }
  return names;
}
function hideGlobalTools(ctx, keep) {
  const denied = /* @__PURE__ */ new Set();
  let live = true;
  let queued = false;
  ctx.effect(() => () => {
    live = false;
  });
  const sync = () => {
    if (!live) return;
    const names = pendingDenials(ctx, keep, denied);
    if (names.length === 0) return;
    try {
      ctx.tools.restrict({ deny: names });
      for (const toolName of names) denied.add(toolName);
    } catch (error) {
      ctx.logger.warn(`dsh-nai5-prompting: could not hide global tools ${names.join(", ")}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  sync();
  ctx.on("tools/change", () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      sync();
    });
  });
  ctx.on("agent/pre-step", (_payload, next) => {
    sync();
    return next();
  });
}
function shadowCandidates(summaries, keep) {
  return summaries.filter((summary) => !keep.has(summary.name)).map((summary) => ({
    name: summary.name,
    description: SHADOW_DESCRIPTION,
    invocation: HIDDEN,
    source: "hidden-global",
    provider: SHADOW_PROVIDER,
    rank: SHADOW_RANK,
    locator: summary.name
  }));
}
function hideGlobalSkills(ctx, keep) {
  ctx.skills.registerProvider(() => ({
    name: SHADOW_PROVIDER,
    async list(options) {
      const summaries = await ctx.skills.list({ cwd: options.cwd, signal: options.signal });
      return shadowCandidates(summaries, keep);
    },
    async get(candidate) {
      return {
        name: candidate.name,
        description: SHADOW_DESCRIPTION,
        invocation: HIDDEN,
        source: "hidden-global",
        provider: SHADOW_PROVIDER,
        content: ""
      };
    }
  }));
}
export {
  Config,
  SHADOW_PROVIDER,
  SHADOW_RANK,
  apply,
  hideGlobalSkills,
  hideGlobalTools,
  inject,
  name,
  pendingDenials,
  shadowCandidates
};
