/**
 * Structured extraction utilities for Power Smart POC.
 *
 * Handles parsing of order intake data from structured text, webhook payloads,
 * and form submissions into typed, validated records ready for Convex storage
 * and Acumatica API write-back.
 */

// ─── Type Definitions ───────────────────────────────────────────────

export interface ExtractedOrder {
  customerName: string;
  phone: string;
  email: string;
  address: string;
  platform: string;
  orderNumber: string;
  orderedDate: string;
  productCategory: string;
  modelSku: string;
  serialNumber: string;
  purchaseProofRef?: string;
}

export interface ExtractedWarrantyCase {
  claimantName: string;
  phone: string;
  email: string;
  address: string;
  productCategory: string;
  modelSku: string;
  serialNumber: string;
  platform: string;
  orderNumber?: string;
  purchaseDate?: string;
  proofOfPurchaseImageRef?: string;
}

export interface ExtractionResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
  warnings: string[];
  rawInput: string;
  extractionTimestamp: number;
}

// ─── Field Normalization ─────────────────────────────────────────────

const FIELD_ALIASES: Record<string, string[]> = {
  customerName: ["Your Name", "Name", "Customer Name", "Full Name", "Claimant Name"],
  phone: ["Phone", "Phone Number", "Tel", "Telephone", "Contact Number"],
  email: ["Email", "E-mail", "Email Address", "Contact Email"],
  address: ["Address", "Shipping Address", "Mailing Address", "Location"],
  platform: ["Ordered Platform", "Platform", "Retailer", "Store", "Purchased From", "Order Platform"],
  orderNumber: ["Order Number", "Order #", "Order ID", "Order No"],
  orderedDate: ["Ordered Date", "Order Date", "Purchase Date", "Date of Purchase", "Date"],
  productCategory: ["Product Category", "Category", "Product Type", "Item Type"],
  modelSku: ["Model Number/SKU", "Model Number", "SKU", "Model", "Model/SKU", "Item Number"],
  serialNumber: ["Serial Number", "Serial #", "Serial No", "S/N", "Serial"],
  purchaseProofRef: ["Purchase Proof", "Proof of Purchase", "Receipt", "Proof Image", "Upload"],
};

/**
 * Normalize a raw field label to its canonical key.
 */
export function normalizeFieldLabel(raw: string): string | null {
  const cleaned = raw.trim().replace(/[:\s]+$/, "");
  const cleanedLower = cleaned.toLowerCase();
  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    // Check canonical name itself first
    if (cleanedLower === canonical.toLowerCase()) return canonical;
    for (const alias of aliases) {
      if (cleanedLower === alias.toLowerCase()) {
        return canonical;
      }
    }
  }
  return null;
}

// ─── Structured Text Parser ──────────────────────────────────────────

/**
 * Parse key: value structured text (one field per line) into an extracted order.
 * Handles the format: "Field Label: Value"
 */
export function parseStructuredOrder(rawText: string): ExtractionResult<ExtractedOrder> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const raw: Record<string, string> = {};
  const lines = rawText.split("\n").filter((l) => l.trim());

  // First pass: collect all raw key:value pairs
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      // Might be a continuation line or standalone value
      const trimmed = line.trim();
      if (trimmed.startsWith("17") && /^\d+/.test(trimmed.split(".")[0])) {
        // This looks like the purchase proof image reference
        raw["purchaseProofRef"] = trimmed.split(".")[0].trim();
      }
      continue;
    }
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    raw[key] = value;
  }

  // Second pass: normalize keys
  const normalized: Partial<ExtractedOrder> = {};
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    const canonical = normalizeFieldLabel(rawKey);
    if (canonical) {
      normalized[canonical as keyof ExtractedOrder] = rawValue;
    } else if (rawKey && rawValue) {
      warnings.push(`Unrecognized field: "${rawKey}" = "${rawValue}"`);
    }
  }

  // Validate required fields
  const required = [
    "customerName",
    "phone",
    "email",
    "address",
    "platform",
    "orderNumber",
    "orderedDate",
    "productCategory",
    "modelSku",
    "serialNumber",
  ] as const;

  for (const field of required) {
    if (!normalized[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
      warnings,
      rawInput: rawText,
      extractionTimestamp: Date.now(),
    };
  }

  const order: ExtractedOrder = {
    customerName: normalized.customerName!,
    phone: normalized.phone!,
    email: normalized.email!,
    address: normalized.address!,
    platform: normalized.platform!,
    orderNumber: normalized.orderNumber!,
    orderedDate: normalizeDate(normalized.orderedDate!),
    productCategory: normalized.productCategory!,
    modelSku: normalized.modelSku!,
    serialNumber: normalized.serialNumber!,
    purchaseProofRef: normalized.purchaseProofRef,
  };

  return {
    success: true,
    data: order,
    errors: [],
    warnings,
    rawInput: rawText,
    extractionTimestamp: Date.now(),
  };
}

/**
 * Parse a JSON payload (webhook) into an extracted order.
 */
export function parseJsonOrder(payload: Record<string, unknown>): ExtractionResult<ExtractedOrder> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalized: Partial<ExtractedOrder> = {};

  for (const [key, value] of Object.entries(payload)) {
    const canonical = normalizeFieldLabel(key);
    if (canonical && typeof value === "string") {
      normalized[canonical as keyof ExtractedOrder] = value;
    }
  }

  const required = [
    "customerName",
    "phone",
    "email",
    "address",
    "platform",
    "orderNumber",
    "orderedDate",
    "productCategory",
    "modelSku",
    "serialNumber",
  ] as const;

  for (const field of required) {
    if (!normalized[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
      warnings,
      rawInput: JSON.stringify(payload),
      extractionTimestamp: Date.now(),
    };
  }

  return {
    success: true,
    data: {
      customerName: normalized.customerName!,
      phone: normalized.phone!,
      email: normalized.email!,
      address: normalized.address!,
      platform: normalized.platform!,
      orderNumber: normalized.orderNumber!,
      orderedDate: normalizeDate(normalized.orderedDate!),
      productCategory: normalized.productCategory!,
      modelSku: normalized.modelSku!,
      serialNumber: normalized.serialNumber!,
      purchaseProofRef: normalized.purchaseProofRef,
    },
    errors: [],
    warnings,
    rawInput: JSON.stringify(payload),
    extractionTimestamp: Date.now(),
  };
}

// ─── Date Normalization ──────────────────────────────────────────────

/**
 * Normalize various date formats to ISO 8601 (YYYY-MM-DD).
 */
export function normalizeDate(raw: string): string {
  const trimmed = raw.trim();

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // MM-DD-YYYY or MM/DD/YYYY
  const usMatch = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const euMatch = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (euMatch) {
    return trimmed; // Already handled above, but keep for clarity
  }

  // Try parsing as Date
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return trimmed;
}

// ─── Phone Normalization ─────────────────────────────────────────────

export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}

// ─── Retailer Recognition ────────────────────────────────────────────

const KNOWN_RETAILERS: Record<string, string[]> = {
  "Home Depot": ["homedepot", "home depot", "the home depot", "hd"],
  "Lowe's": ["lowes", "lowe's", "lowes home improvement"],
  "Walmart": ["walmart", "walmart.com"],
  "Amazon": ["amazon", "amazon.com"],
  "Costco": ["costco", "costco wholesale"],
  "Direct": ["direct", "power smart direct", "powersmart", "power smart"],
};

/**
 * Match a retailer name against known retailers.
 */
export function recognizeRetailer(raw: string): { name: string; matched: boolean } {
  const cleaned = raw.trim().toLowerCase();
  for (const [name, aliases] of Object.entries(KNOWN_RETAILERS)) {
    for (const alias of aliases) {
      if (cleaned.includes(alias)) {
        return { name, matched: true };
      }
    }
  }
  return { name: raw, matched: false };
}

// ─── Validation ──────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  checks: {
    retailerRecognized: boolean;
    retailerName: string;
    serialNumberValid: boolean;
    orderDateValid: boolean;
    emailValid: boolean;
  };
  notes: string[];
}

export function validateOrder(order: ExtractedOrder): ValidationResult {
  const notes: string[] = [];
  const retailer = recognizeRetailer(order.platform);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email);
  const serialValid = order.serialNumber.length >= 8;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(order.orderedDate);

  if (!retailer.matched) notes.push(`Retailer "${order.platform}" not in recognized list`);
  if (!emailValid) notes.push("Email format appears invalid");
  if (!serialValid) notes.push("Serial number may be invalid (too short)");

  return {
    valid: retailer.matched && emailValid && serialValid && dateValid,
    checks: {
      retailerRecognized: retailer.matched,
      retailerName: retailer.name,
      serialNumberValid: serialValid,
      orderDateValid: dateValid,
      emailValid,
    },
    notes,
  };
}
