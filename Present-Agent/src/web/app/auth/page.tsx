"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { signup, me, logout } from "../../lib/api";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string>("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    me().then((j) => setUser(j.user)).catch(() => {});
  }, []);

  const onSignup = async () => {
    setStatus("Signing in…");
    try {
      await signup(email, name || undefined);
      setStatus("Success");
      setTimeout(() => router.push("/"), 400);
    } catch (e: any) {
      setStatus(`Error: ${e?.message || e}`);
    }
  };

  const onLogout = async () => {
    await logout();
    setUser(null);
  };

  return (
    <div className="p-4">
      <div className="mx-auto max-w-md space-y-3">
        <h1 className="text-2xl font-bold">Sign in</h1>
        {user ? (
          <div className="text-sm text-gray-600">Signed in as {user.email}. <button className="text-blue-600 hover:underline" onClick={onLogout}>Sign out</button></div>
        ) : (
          <div className="space-y-2">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" />
            <Button onClick={onSignup}>Continue</Button>
            {status && <div className="text-xs text-gray-600">{status}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
