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
