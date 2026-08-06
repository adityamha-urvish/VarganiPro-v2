import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");

  const handleLogin = () => {
    console.log({
      mobile,
      pin,
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="text-6xl">🛕</div>

          <CardTitle className="mt-2 text-3xl font-bold">
            VarganiPro
          </CardTitle>

          <p className="text-sm text-muted-foreground">
            Ganesh Utsav Collection System
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          <div>
            <Label>Mobile Number</Label>

            <Input
              placeholder="9876543210"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </div>

          <div>
            <Label>4 Digit PIN</Label>

            <Input
              type="password"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleLogin}
          >
            Login
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Forgot PIN? Contact Administrator
          </p>
        </CardContent>
      </Card>
    </div>
  );
}