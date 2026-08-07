import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { loginSchema, type LoginForm } from "../schema/login.schema";

export function useLogin() {
  return useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      mobile: "",
      pin: "",
    },
    mode: "onBlur",
  });
}