import { z } from "zod";
import { roleSchema } from "./common.js";

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
  role: roleSchema.default("user"),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;
