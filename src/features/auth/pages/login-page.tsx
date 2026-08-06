import { useEffect } from "react";
import { supabase } from "@/supabase/client";

export function LoginPage() {
  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase.auth.getSession();

      console.log("Supabase Connected");
      console.log(data);

      if (error) {
        console.error(error);
      }
    }

    testConnection();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-bold">
        Welcome to VarganiPro
      </h1>
    </div>
  );
}