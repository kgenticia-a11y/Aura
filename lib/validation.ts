import { z } from "zod";
import { NextResponse } from "next/server";

export function validateBody<T>(
  body: unknown,
  schema: z.ZodSchema<T>
): { data: T; error?: never } | { data?: never; error: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      error: NextResponse.json(
        { error: `Invalid request: ${message}` },
        { status: 400 }
      ),
    };
  }
  return { data: result.data };
}

export const analyzeSchema = z.object({
  photo_id: z
    .string()
    .uuid("photo_id must be a valid UUID"),
});

export const dermConsultSchema = z.object({
  analysis_id: z.string().uuid("analysis_id must be a valid UUID").optional().nullable(),
  reason: z.string().trim().min(10, "Please describe your concern in a bit more detail").max(2000),
  urgency: z.enum(["routine", "priority", "urgent"]).default("routine"),
});

// Ingredient scanner: accept either a base64 label photo or pasted ingredient
// text (at least one must be present). Image is capped to keep request bodies
// and Gemini token usage bounded.
export const scanIngredientsSchema = z
  .object({
    image: z
      .string()
      .max(8_000_000, "Image is too large")
      .optional(),
    mime_type: z
      .string()
      .regex(/^image\/(jpeg|png|webp|heic|heif)$/i, "Unsupported image type")
      .optional(),
    ingredients_text: z
      .string()
      .trim()
      .max(4000, "Ingredient text is too long")
      .optional(),
  })
  .refine(
    (v) => (v.image && v.image.length > 0) || (v.ingredients_text && v.ingredients_text.length > 0),
    { message: "Provide a label photo or paste an ingredient list" }
  );

export const dermConsultResponseSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
  dermatologist_notes: z.string().trim().min(1).max(4000),
  status: z.enum(["in_review", "responded", "closed"]).default("responded"),
});
