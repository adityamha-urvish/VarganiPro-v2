import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useLogin } from "../hooks/use-login";
import { login } from "../services/auth.service";

export function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useLogin();

  const onSubmit = async (data: {
    mobile: string;
    pin: string;
  }) => {
    try {
      const user = await login(data);

      localStorage.setItem(
        "vp_user",
        JSON.stringify(user)
      );

      window.location.href = "/dashboard";
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Login failed"
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="text-6xl">🛕</div>

          <CardTitle className="mt-2 text-3xl">
            VarganiPro
          </CardTitle>

          <p className="text-sm text-muted-foreground">
            Smart Collection Management
          </p>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
          >
            <div>
              <Label htmlFor="mobile">
                Mobile Number
              </Label>

              <Input
                id="mobile"
                inputMode="numeric"
                maxLength={10}
                placeholder="9876543210"
                {...register("mobile")}
              />

              {errors.mobile && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.mobile.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="pin">
                4 Digit PIN
              </Label>

              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                {...register("pin")}
              />

              {errors.pin && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.pin.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
            >
              Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}