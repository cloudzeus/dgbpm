import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted/30 p-4">
      <Image
        src="/smartProcessWhiteNoBg.svg"
        alt="BPM"
        width={220}
        height={55}
        className="h-14 w-auto object-contain"
        priority
      />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Δημιουργία λογαριασμού</CardTitle>
          <CardDescription>Εγγραφείτε στην εφαρμογή BPM. Ένας διαχειριστής πρέπει να αναθέσει τον ρόλο και τις θέσεις εργασίας σας.</CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Έχετε ήδη λογαριασμό;{" "}
            <Link href="/auth/login" className="text-primary underline">
              Σύνδεση
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
