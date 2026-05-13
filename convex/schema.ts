import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const powerSmartTables = {
  // Orders extracted from structured intake (phone/email/webhook)
  orders: defineTable({
    // Customer identification
    customerName: v.string(),
    phone: v.string(),
    email: v.string(),
    address: v.string(),

    // Order details
    platform: v.string(),           // e.g., "Homedepot", "Lowes", "Direct"
    orderNumber: v.string(),
    orderedDate: v.string(),        // ISO date string
    productCategory: v.string(),
    modelSku: v.string(),
    serialNumber: v.string(),

    // Purchase proof
    purchaseProofRef: v.optional(v.string()),  // reference to uploaded image

    // Processing metadata
    status: v.union(
      v.literal("extracted"),
      v.literal("validated"),
      v.literal("pushed_to_acumatica"),
      v.literal("failed"),
    ),
    acumaticaRef: v.optional(v.string()),  // Acumatica order ID after push
    extractionTimestamp: v.number(),
    pushTimestamp: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_order_number", ["orderNumber"])
    .index("by_status", ["status"])
    .index("by_customer_email", ["email"]),

  // Warranty cases — inbound webhook submissions
  warrantyCases: defineTable({
    // Claimant information
    claimantName: v.string(),
    phone: v.string(),
    email: v.string(),
    address: v.string(),

    // Product information
    productCategory: v.string(),
    modelSku: v.string(),
    serialNumber: v.string(),

    // Purchase information
    platform: v.string(),           // retailer where purchased
    orderNumber: v.optional(v.string()),
    purchaseDate: v.optional(v.string()),

    // Proof of purchase
    proofOfPurchaseImageRef: v.optional(v.string()),

    // Validation results
    validationStatus: v.union(
      v.literal("pending"),
      v.literal("validated"),
      v.literal("rejected"),
      v.literal("escalated"),
    ),
    validationNotes: v.optional(v.string()),
    retailerRecognized: v.optional(v.boolean()),
    upcProductMatch: v.optional(v.boolean()),
    proofOfPurchaseValid: v.optional(v.boolean()),

    // Acumatica integration
    acumaticaCaseRef: v.optional(v.string()),
    status: v.union(
      v.literal("received"),
      v.literal("analyzing"),
      v.literal("validated"),
      v.literal("pushed_to_acumatica"),
      v.literal("escalated"),
      v.literal("failed"),
    ),
    receiptTimestamp: v.number(),
    analysisTimestamp: v.optional(v.number()),
    pushTimestamp: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_serial", ["serialNumber"])
    .index("by_email", ["email"]),

  // Recognized retailers for proof-of-purchase validation
  retailers: defineTable({
    name: v.string(),
    aliases: v.array(v.string()),  // e.g., ["Home Depot", "Homedepot", "The Home Depot"]
    website: v.optional(v.string()),
    active: v.boolean(),
  })
    .index("by_name", ["name"]),

  // Acumatica integration log — audit trail
  acumaticaLog: defineTable({
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    endpoint: v.string(),
    requestPayload: v.optional(v.string()),
    responseStatus: v.number(),
    responseBody: v.optional(v.string()),
    relatedEntityType: v.union(
      v.literal("order"),
      v.literal("warranty_case"),
    ),
    relatedEntityId: v.optional(v.id("orders")),
    relatedWarrantyId: v.optional(v.id("warrantyCases")),
    timestamp: v.number(),
    durationMs: v.number(),
    error: v.optional(v.string()),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_entity", ["relatedEntityType"]),
};

export default defineSchema({
  ...authTables,
  ...powerSmartTables,
});
