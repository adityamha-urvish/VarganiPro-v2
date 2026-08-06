import { z } from "zod";

export const loginSchema = z.object({
  mobile: z
    .string()
    .min(10, "Enter a valid mobile number")
    .max(10, "Enter a valid mobile number"),

  pin: z
    .string()
    .length(6, "PIN must be 6 digits"),
});

export type LoginForm = z.infer<typeof loginSchema>;