"use client";

import { useState } from "react";
import { AuthPanel } from "@/components/AppShell";

export default function LoginPage() {
  const [error, setError] = useState("");
  return <AuthPanel initialMode="login" error={error} setError={setError} onSuccess={async () => { window.location.assign("/workspace"); }} />;
}
