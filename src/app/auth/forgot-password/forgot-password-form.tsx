"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    // TODO: Implement actual password reset (email link or admin reset)
  }

  if (submitted) {
    return (
      <p className="text-sm text-muted-foreground">
        Αν υπάρχει λογαριασμός για αυτό το email, θα λάβετε έναν σύνδεσμο επαναφοράς. Για αυτήν την εσωτερική εφαρμογή, επικοινωνήστε με τον διαχειριστή σας για επαναφορά του κωδικού σας.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@company.com"
          required
          autoComplete="email"
        />
      </div>
      <Button type="submit" className="w-full">
        Αποστολή συνδέσμου επαναφοράς
      </Button>
    </form>
  );
}
