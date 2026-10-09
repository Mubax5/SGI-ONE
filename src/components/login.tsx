"use client";
import { Button, Input, LayerCard, Text } from "@cloudflare/kumo";
import { ArrowRightIcon } from "@phosphor-icons/react";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { Feedback } from "./shared";
export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe: false }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Terlalu banyak percobaan. Tunggu satu menit lalu coba kembali."
            : "Email atau kata sandi tidak sesuai. Periksa kembali akun internal Anda.",
        );
      window.location.assign("/");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Tidak dapat masuk. Coba kembali.",
      );
      setLoading(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-brand">
        <Image
          src="/sgi-logo.png"
          width={943}
          height={784}
          sizes="56px"
          alt="Sandika Global Indonesia"
          className="login-logo"
          priority
        />
        <Text variant="heading" size="lg">
          SGI One
        </Text>
      </div>
      <LayerCard className="login-card">
        <Text as="h1" variant="heading" size="lg">
          Masuk
        </Text>
        <Text variant="secondary">Gunakan akun internal SGI Anda.</Text>
        <form onSubmit={submit}>
          <Feedback error={error} />
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Kata sandi"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button
            variant="primary"
            type="submit"
            loading={loading}
            icon={<ArrowRightIcon size={18} />}
          >
            Masuk
          </Button>
        </form>
        <Text variant="secondary" DANGEROUS_className="login-help">
          Butuh akses? Hubungi administrator SGI.
        </Text>
      </LayerCard>
    </main>
  );
}
