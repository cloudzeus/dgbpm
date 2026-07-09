import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { LoginVideoBackground } from "./login-video-background";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-8 overflow-hidden p-4">
      <div className="fixed inset-0 z-0 min-h-full min-w-full bg-muted">
        <LoginVideoBackground />
      </div>
      <div className="relative z-10 flex min-h-svh w-full flex-col items-center justify-center gap-8 p-4">
      <Image
        src="/HappyOnLineFullLogo.svg"
        alt="HappyOnLine"
        width={220}
        height={55}
        className="h-14 w-auto object-contain"
        priority
      />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Σύνδεση</CardTitle>
          <CardDescription>Εισάγετε το email και τον κωδικό σας για πρόσβαση στην εφαρμογή BPM.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Δεν έχετε λογαριασμό;{" "}
            <Link href="/auth/register" className="text-primary underline">
              Εγγραφή
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            <Link href="/auth/forgot-password" className="text-primary underline">
              Ξεχάσατε τον κωδικό;
            </Link>
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
