import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted/30 p-4">
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
          <CardTitle>Ξεχάσατε τον κωδικό</CardTitle>
          <CardDescription>
            Εισάγετε το email σας και θα σας στείλουμε έναν σύνδεσμο για την επαναφορά του κωδικού σας. (Η διαδικασία επαναφοράς μπορεί να υλοποιηθεί αργότερα.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link href="/auth/login" className="text-primary underline">
              Επιστροφή στη σύνδεση
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
