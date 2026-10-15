"use client";
import { Button, Input, LinkButton, Text } from "@cloudflare/kumo";
import { ArrowUpRightIcon } from "@phosphor-icons/react";
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
            : response.status >= 500
              ? "Layanan masuk belum tersedia. Coba lagi."
              : "Email atau kata sandi salah. Periksa lalu coba lagi.",
          { cause: "sign-in-response" },
        );
      window.location.assign("/");
    } catch (e) {
      setError(
        e instanceof Error && e.cause === "sign-in-response"
          ? e.message
          : "Tidak dapat masuk. Periksa koneksi dan coba lagi.",
      );
      setLoading(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-frame">
        <section className="login-photo" aria-label="SGI Logistics">
          <Image
            src="/sgi-login-logistics.webp"
            alt="Tim SGI di pelabuhan dengan kapal kontainer, truk, dan pesawat kargo"
            fill
            sizes="(max-width: 639px) 100vw, 50vw"
            priority
            className="login-photo-image"
          />
          <div className="login-photo-content">
            <div className="login-photo-header">
              <Text
                as="p"
                variant="heading"
                DANGEROUS_className="login-photo-brand"
              >
                SGI Logistics
              </Text>
              <LinkButton
                href="https://sandikaglobalindonesia.com"
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                aria-label="Website SGI"
                icon={<ArrowUpRightIcon size={16} />}
                className="login-website-button"
              >
                <span className="login-website-label">Website SGI</span>
              </LinkButton>
            </div>
            <div className="login-photo-caption">
              <Text
                variant="heading"
                size="lg"
                DANGEROUS_className="login-company-name"
              >
                Sandika Global Indonesia
              </Text>
              <Text DANGEROUS_className="login-company-service">
                Freight forwarding &amp; contract logistics
              </Text>
            </div>
          </div>
        </section>
        <section className="login-form-panel" aria-labelledby="login-title">
          <header className="login-panel-header">
            <div className="login-brand">
              <Image
                src="/favicon-sgi.png"
                width={1254}
                height={1254}
                sizes="44px"
                alt="Sandika Global Indonesia"
                className="login-logo"
                priority
              />
              <Text variant="heading" size="lg">
                SGI One
              </Text>
            </div>
            <Text variant="secondary" DANGEROUS_className="login-location">
              Indonesia
            </Text>
          </header>
          <div className="login-form-content">
            <div className="login-heading">
              <Text
                as="h1"
                variant="heading"
                id="login-title"
                DANGEROUS_className="login-title"
              >
                Selamat datang
              </Text>
              <Text variant="secondary">Masuk ke SGI One</Text>
            </div>
            <form
              onSubmit={submit}
              className="login-form"
              aria-label="Masuk ke SGI One"
            >
              <Feedback error={error} />
              <Input
                aria-label="Email"
                placeholder="Email"
                type="email"
                size="lg"
                className="login-input"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                aria-label="Kata sandi"
                placeholder="Kata sandi"
                type="password"
                size="lg"
                className="login-input"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button
                variant="primary"
                size="lg"
                type="submit"
                loading={loading}
                className="login-submit"
              >
                Masuk
              </Button>
            </form>
            <Text variant="secondary" DANGEROUS_className="login-help">
              Butuh akses? Hubungi administrator SGI.
            </Text>
          </div>
          <Text variant="secondary" DANGEROUS_className="login-footer">
            Sandika Global Indonesia
          </Text>
        </section>
      </div>
    </main>
  );
}
