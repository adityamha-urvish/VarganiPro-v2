import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center">
          <div className="mb-3 text-5xl">🛕</div>

          <CardTitle className="text-3xl">
            VarganiPro
          </CardTitle>

          <p className="text-sm text-muted-foreground">
            Ganesh Utsav 2026
          </p>
        </CardHeader>

        <CardContent className="space-y-5">

          <div className="space-y-2">
            <Label>Mobile Number</Label>

            <Input
              placeholder="9876543210"
              type="tel"
            />
          </div>

          <div className="space-y-2">
            <Label>4 Digit PIN</Label>

            <Input
              placeholder="••••"
              type="password"
              maxLength={4}
            />
          </div>

          <Button className="w-full">
            Login
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Contact administrator if you forgot your PIN
          </p>

        </CardContent>
      </Card>
    </div>
  );
}