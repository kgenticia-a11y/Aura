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

export const dermConsultResponseSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
  dermatologist_notes: z.string().trim().min(1).max(4000),
  status: z.enum(["in_review", "responded", "closed"]).default("responded"),
});
