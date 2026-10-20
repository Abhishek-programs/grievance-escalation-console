import { useState } from "react";
import { request } from "../api.ts";
import { Button } from "./ui/button.tsx";
import { Input } from "./ui/input.tsx";
import { Label } from "./ui/label.tsx";

export function VerifyEmail({
  onVerified,
}: {
  onVerified: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode() {
    setBusy(true);
    setError("");
    try {
      await request("/api/auth/code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The code could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError("");
    try {
      const session = await request<{ email: string }>("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      onVerified(session.email);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code does not match.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[17px] border border-border p-4">
      <p className="text-sm leading-relaxed">
        The shared desk is open to read. Enter your email to import a file or change a case you imported.
      </p>
      <div className="space-y-2">
        <Label htmlFor="sign-in-email">Email</Label>
        <Input
          id="sign-in-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      {sent && (
        <div className="space-y-2">
          <Label htmlFor="sign-in-code">Code</Label>
          <Input
            id="sign-in-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="button" disabled={busy || email.trim() === "" || (sent && code.trim() === "")} onClick={sent ? verify : sendCode}>
        {busy ? "Sending…" : sent ? "Verify and continue" : "Email me a code"}
      </Button>
    </div>
  );
}
