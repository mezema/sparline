import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const scripts = await ctx.db
      .query("scripts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Attach phase counts
    const withPhases = await Promise.all(
      scripts.map(async (script) => {
        const phases = await ctx.db
          .query("phases")
          .withIndex("by_script", (q) => q.eq("scriptId", script._id))
          .collect();
        return { ...script, phaseCount: phases.length };
      })
    );

    return withPhases;
  },
});

export const get = query({
  args: { id: v.id("scripts") },
  handler: async (ctx, args) => {
    const script = await ctx.db.get(args.id);
    if (!script) return null;

    const phases = await ctx.db
      .query("phases")
      .withIndex("by_script", (q) => q.eq("scriptId", script._id))
      .collect();

    // Sort by order
    phases.sort((a, b) => a.order - b.order);

    // Attach scenario counts to each phase
    const phasesWithScenarios = await Promise.all(
      phases.map(async (phase) => {
        const scenarios = await ctx.db
          .query("scenarios")
          .withIndex("by_phase", (q) => q.eq("phaseId", phase._id))
          .collect();
        scenarios.sort((a, b) => a.order - b.order);
        return { ...phase, scenarios, scenarioCount: scenarios.length };
      })
    );

    return { ...script, phases: phasesWithScenarios };
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    rawContent: v.optional(v.string()),
    phases: v.array(
      v.object({
        name: v.string(),
        description: v.optional(v.string()),
        aiContext: v.optional(v.string()),
        estimatedMinutes: v.optional(v.number()),
        order: v.number(),
        scenarios: v.array(
          v.object({
            name: v.string(),
            order: v.number(),
            context: v.string(),
            characterBehavior: v.optional(v.string()),
            openingLine: v.optional(v.string()),
            expectedResponses: v.array(v.string()),
            successCriteria: v.optional(v.string()),
            commonMistakes: v.array(v.string()),
            focusAreas: v.array(v.string()),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const scriptId = await ctx.db.insert("scripts", {
      userId: args.userId,
      name: args.name,
      description: args.description,
      rawContent: args.rawContent,
      isActive: true,
      totalPracticeTime: 0,
      sessionCount: 0,
    });

    for (const phase of args.phases) {
      const phaseId = await ctx.db.insert("phases", {
        scriptId,
        name: phase.name,
        description: phase.description,
        aiContext: phase.aiContext,
        estimatedMinutes: phase.estimatedMinutes,
        order: phase.order,
      });

      for (const scenario of phase.scenarios) {
        await ctx.db.insert("scenarios", {
          phaseId,
          name: scenario.name,
          order: scenario.order,
          context: scenario.context,
          characterBehavior: scenario.characterBehavior,
          openingLine: scenario.openingLine,
          expectedResponses: scenario.expectedResponses,
          successCriteria: scenario.successCriteria,
          commonMistakes: scenario.commonMistakes,
          focusAreas: scenario.focusAreas,
        });
      }
    }

    return scriptId;
  },
});

export const update = mutation({
  args: {
    id: v.id("scripts"),
    name: v.string(),
    description: v.optional(v.string()),
    rawContent: v.optional(v.string()),
    phases: v.array(
      v.object({
        name: v.string(),
        description: v.optional(v.string()),
        aiContext: v.optional(v.string()),
        estimatedMinutes: v.optional(v.number()),
        order: v.number(),
        scenarios: v.array(
          v.object({
            name: v.string(),
            order: v.number(),
            context: v.string(),
            characterBehavior: v.optional(v.string()),
            openingLine: v.optional(v.string()),
            expectedResponses: v.array(v.string()),
            successCriteria: v.optional(v.string()),
            commonMistakes: v.array(v.string()),
            focusAreas: v.array(v.string()),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const script = await ctx.db.get(args.id);
    if (!script) throw new Error("Script not found");

    // Update script metadata
    await ctx.db.patch(args.id, {
      name: args.name,
      description: args.description,
      rawContent: args.rawContent,
    });

    // Delete all existing phases + scenarios
    const existingPhases = await ctx.db
      .query("phases")
      .withIndex("by_script", (q) => q.eq("scriptId", args.id))
      .collect();

    for (const phase of existingPhases) {
      const scenarios = await ctx.db
        .query("scenarios")
        .withIndex("by_phase", (q) => q.eq("phaseId", phase._id))
        .collect();
      for (const scenario of scenarios) {
        await ctx.db.delete(scenario._id);
      }
      await ctx.db.delete(phase._id);
    }

    // Re-insert new phases + scenarios
    for (const phase of args.phases) {
      const phaseId = await ctx.db.insert("phases", {
        scriptId: args.id,
        name: phase.name,
        description: phase.description,
        aiContext: phase.aiContext,
        estimatedMinutes: phase.estimatedMinutes,
        order: phase.order,
      });

      for (const scenario of phase.scenarios) {
        await ctx.db.insert("scenarios", {
          phaseId,
          name: scenario.name,
          order: scenario.order,
          context: scenario.context,
          characterBehavior: scenario.characterBehavior,
          openingLine: scenario.openingLine,
          expectedResponses: scenario.expectedResponses,
          successCriteria: scenario.successCriteria,
          commonMistakes: scenario.commonMistakes,
          focusAreas: scenario.focusAreas,
        });
      }
    }

    return args.id;
  },
});

export const remove = mutation({
  args: { id: v.id("scripts") },
  handler: async (ctx, args) => {
    // Delete scenarios, phases, then script
    const phases = await ctx.db
      .query("phases")
      .withIndex("by_script", (q) => q.eq("scriptId", args.id))
      .collect();

    for (const phase of phases) {
      const scenarios = await ctx.db
        .query("scenarios")
        .withIndex("by_phase", (q) => q.eq("phaseId", phase._id))
        .collect();
      for (const scenario of scenarios) {
        await ctx.db.delete(scenario._id);
      }
      await ctx.db.delete(phase._id);
    }

    await ctx.db.delete(args.id);
  },
});
