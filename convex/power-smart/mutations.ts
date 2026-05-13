/**
 * Convex mutations for Power Smart POC: orders and warranty case storage.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

// ─── Orders ──────────────────────────────────────────────────────────

export const storeOrder = mutation({
  args: {
    customerName: v.string(),
    phone: v.string(),
    email: v.string(),
    address: v.string(),
    platform: v.string(),
    orderNumber: v.string(),
    orderedDate: v.string(),
    productCategory: v.string(),
    modelSku: v.string(),
    serialNumber: v.string(),
    purchaseProofRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("orders")
      .withIndex("by_order_number", (q) => q.eq("orderNumber", args.orderNumber))
      .first();

    if (existing) {
      // Update existing order with new data
      await ctx.db.patch(existing._id, {
        ...args,
        status: "extracted",
        extractionTimestamp: Date.now(),
      });
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("orders", {
      ...args,
      status: "extracted",
      extractionTimestamp: Date.now(),
    });
    return { id, created: true };
  },
});

export const getOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.orderId);
  },
});

export const getOrderByNumber = query({
  args: { orderNumber: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_order_number", (q) => q.eq("orderNumber", args.orderNumber))
      .first();
  },
});

export const listOrdersByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});

export const updateOrderStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("extracted"),
      v.literal("validated"),
      v.literal("pushed_to_acumatica"),
      v.literal("failed"),
    ),
    acumaticaRef: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.acumaticaRef) patch.acumaticaRef = args.acumaticaRef;
    if (args.errorMessage) patch.errorMessage = args.errorMessage;
    if (args.status === "pushed_to_acumatica") patch.pushTimestamp = Date.now();
    await ctx.db.patch(args.orderId, patch);
    return { success: true };
  },
});

// ─── Warranty Cases ──────────────────────────────────────────────────

export const storeWarrantyCase = mutation({
  args: {
    claimantName: v.string(),
    phone: v.string(),
    email: v.string(),
    address: v.string(),
    productCategory: v.string(),
    modelSku: v.string(),
    serialNumber: v.string(),
    platform: v.string(),
    orderNumber: v.optional(v.string()),
    purchaseDate: v.optional(v.string()),
    proofOfPurchaseImageRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("warrantyCases", {
      ...args,
      validationStatus: "pending",
      status: "received",
      receiptTimestamp: Date.now(),
    });
    return { id };
  },
});

export const getWarrantyCase = query({
  args: { caseId: v.id("warrantyCases") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.caseId);
  },
});

export const listWarrantyCasesByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("warrantyCases")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});

export const updateWarrantyStatus = mutation({
  args: {
    caseId: v.id("warrantyCases"),
    status: v.union(
      v.literal("received"),
      v.literal("analyzing"),
      v.literal("validated"),
      v.literal("pushed_to_acumatica"),
      v.literal("escalated"),
      v.literal("failed"),
    ),
    validationStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("validated"),
        v.literal("rejected"),
        v.literal("escalated"),
      )
    ),
    validationNotes: v.optional(v.string()),
    retailerRecognized: v.optional(v.boolean()),
    upcProductMatch: v.optional(v.boolean()),
    proofOfPurchaseValid: v.optional(v.boolean()),
    acumaticaCaseRef: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.validationStatus !== undefined) patch.validationStatus = args.validationStatus;
    if (args.validationNotes !== undefined) patch.validationNotes = args.validationNotes;
    if (args.retailerRecognized !== undefined) patch.retailerRecognized = args.retailerRecognized;
    if (args.upcProductMatch !== undefined) patch.upcProductMatch = args.upcProductMatch;
    if (args.proofOfPurchaseValid !== undefined) patch.proofOfPurchaseValid = args.proofOfPurchaseValid;
    if (args.acumaticaCaseRef) patch.acumaticaCaseRef = args.acumaticaCaseRef;
    if (args.errorMessage) patch.errorMessage = args.errorMessage;
    if (args.status === "pushed_to_acumatica") patch.pushTimestamp = Date.now();
    if (args.status === "analyzing" || args.status === "validated") patch.analysisTimestamp = Date.now();
    await ctx.db.patch(args.caseId, patch);
    return { success: true };
  },
});

// ─── Retailers ───────────────────────────────────────────────────────

export const seedRetailers = mutation({
  args: {},
  handler: async (ctx) => {
    const retailers = [
      { name: "Home Depot", aliases: ["homedepot", "home depot", "the home depot", "hd"], active: true },
      { name: "Lowe's", aliases: ["lowes", "lowe's", "lowes home improvement"], active: true },
      { name: "Walmart", aliases: ["walmart", "walmart.com"], active: true },
      { name: "Amazon", aliases: ["amazon", "amazon.com"], active: true },
      { name: "Costco", aliases: ["costco", "costco wholesale"], active: true },
      { name: "Direct", aliases: ["direct", "power smart direct", "powersmart"], active: true },
    ];
    for (const r of retailers) {
      const existing = await ctx.db
        .query("retailers")
        .withIndex("by_name", (q) => q.eq("name", r.name))
        .first();
      if (!existing) {
        await ctx.db.insert("retailers", r);
      }
    }
    return { seeded: retailers.length };
  },
});

export const listRetailers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("retailers").collect();
  },
});

// ─── Acumatica Log ───────────────────────────────────────────────────

export const logAcumaticaCall = mutation({
  args: {
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    endpoint: v.string(),
    requestPayload: v.optional(v.string()),
    responseStatus: v.number(),
    responseBody: v.optional(v.string()),
    relatedEntityType: v.union(v.literal("order"), v.literal("warranty_case")),
    relatedEntityId: v.optional(v.id("orders")),
    relatedWarrantyId: v.optional(v.id("warrantyCases")),
    durationMs: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("acumaticaLog", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const getAcumaticaLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("acumaticaLog")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});
