import { z } from "zod";

export const loginSchema = z.object({
  mobile: z
    .string()
    .length(10, "Mobile number must be 10 digits")
    .regex(/^[6-9]\d{9}$/, "Invalid mobile number"),

  pin: z
    .string()
    .length(4, "PIN must be 4 digits")
    .regex(/^\d{4}$/, "PIN must contain only numbers"),
});

export type LoginForm = z.infer<typeof loginSchema>;