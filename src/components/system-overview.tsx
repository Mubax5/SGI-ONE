"use client";
import { Badge, Button, LinkButton, Text } from "@cloudflare/kumo";
import { useEffect, useState } from "react";
import type { SystemHealth } from "@/modules/system";
import { roleLabels } from "@/lib/domain";
import { useLiveRevision } from "@/lib/live-data";
import { api, DataTable, dateText, Feedback, SectionPanel } from "./shared";
import { LoadingState, PageHeader, RecordFacts } from "./workspace-ui";
export function SystemOverview({
  data,
  compact = false,
}: {
  data: SystemHealth;
  compact?: boolean;
}) {
  const [checkedStorage, setCheckedStorage] =
    useState<SystemHealth["storage"]>();
  const [checking, setChecking] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const storage = checkedStorage ?? data.storage;
  async function checkDocuments() {
    setChecking(true);
    setConnectionError("");
    try {
      setCheckedStorage(
        (await api<SystemHealth>("data/system?probe=1")).storage,
      );
    } catch (error) {
      setConnectionError(
        error instanceof Error
          ? error.message
          : "Pemeriksaan layanan dokumen gagal. Coba lagi.",
      );
    } finally {
      setChecking(false);
    }
  }
  return (
    <>
      <SectionPanel
        title="Status layanan"
        description={`Diperiksa ${dateText(data.checkedAt, true)}`}
      >
        <div className="system-services">
          <article>
            <div>
              <Text as="h3">Data aplikasi</Text>
              <Badge variant="success">Terhubung</Badge>
            </div>
          </article>
          <article>
            <div>
              <Text as="h3">Sesi masuk</Text>
              <Badge variant="secondary">{data.sessions} sesi</Badge>
            </div>
          </article>
          <article>
            <div>
              <Text as="h3">Layanan dokumen</Text>
              <Badge
                variant={
                  storage.status === "healthy"
                    ? "success"
                    : storage.status === "error"
                      ? "error"
                      : "secondary"
                }
              >
                {storage.status === "healthy"
                  ? "Terhubung"
                  : storage.status === "error"
                    ? "Perlu ditangani"
                    : storage.status === "unconfigured"
                      ? "Belum siap"
                      : "Belum diperiksa"}
              </Badge>
            </div>
            {(storage.status === "unconfigured" || storage.checkedAt) && (
              <Text variant="secondary">
                {storage.status === "unconfigured"
                  ? "Hubungi administrator untuk mengaktifkan layanan dokumen."
                  : `Pemeriksaan ${dateText(storage.checkedAt, true)}.`}
              </Text>
            )}
            <Button
              variant="outline"
              loading={checking}
              onClick={checkDocuments}
            >
              Periksa layanan dokumen
            </Button>
          </article>
        </div>
        <Feedback error={connectionError} />
      </SectionPanel>
      <SectionPanel
        title="Administrasi pengguna"
        action={
          compact ? undefined : (
            <LinkButton href="/users?create=1" variant="primary">
              Tambah pengguna
            </LinkButton>
          )
        }
      >
        <RecordFacts
          items={[
            { label: "Akun aktif", value: data.accounts.active },
            { label: "Akun nonaktif", value: data.accounts.inactive },
            {
              label: "Perlu diberi peran",
              value: data.accounts.needsAccess.length,
            },
            {
              label: "Pengguna dengan sesi masuk",
              value: data.accounts.withSession,
            },
          ]}
        />
        <div className="dashboard-inline-actions">
          <LinkButton href="/users">Kelola pengguna dan akses</LinkButton>
          <LinkButton href="/audit">Riwayat aktivitas</LinkButton>
        </div>
      </SectionPanel>
      {!compact && (
        <>
          <SectionPanel title="Pembagian peran">
            <div className="admin-role-coverage">
              {data.accounts.roleCoverage.map(({ role, count }) => (
                <div key={role}>
                  <Text>{roleLabels[role]}</Text>
                  <Badge variant={count ? "secondary" : "warning"}>
                    {count} pengguna
                  </Badge>
                </div>
              ))}
            </div>
          </SectionPanel>
          <SectionPanel title="Pengguna yang perlu diberi akses">
            {data.accounts.needsAccess.length === 0 ? (
              <div className="admin-account-note">
                <Text>Semua pengguna aktif sudah memiliki peran.</Text>
              </div>
            ) : (
              <DataTable
                rows={data.accounts.needsAccess}
                perPage={6}
                empty="Semua pengguna aktif sudah memiliki peran."
                columns={[
                  {
                    title: "Pengguna",
                    render: (person) => (
                      <>
                        {person.name}
                        <p>{person.email}</p>
                      </>
                    ),
                  },
                  {
                    title: "Status",
                    render: () => (
                      <Badge variant="warning">Belum memiliki peran</Badge>
                    ),
                  },
                  {
                    title: "",
                    render: (person) => (
                      <LinkButton
                        href={`/users?q=${encodeURIComponent(person.email)}`}
                      >
                        Tetapkan peran
                      </LinkButton>
                    ),
                  },
                ]}
              />
            )}
          </SectionPanel>
          <SectionPanel title="Aktivitas staf">
            <RecordFacts
              items={[
                {
                  label: "Aktivitas tercatat dalam 24 jam",
                  value: data.auditEvents24h,
                },
              ]}
            />
            <div className="dashboard-inline-actions">
              <LinkButton href="/audit">Buka riwayat aktivitas</LinkButton>
            </div>
          </SectionPanel>
        </>
      )}
    </>
  );
}
export function SystemPage() {
  const revision = useLiveRevision();
  const [data, setData] = useState<SystemHealth>(),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<SystemHealth>("data/system")
      .then((result) => {
        if (active) {
          setData(result);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  return (
    <div className="role-dashboard">
      <PageHeader title="Administrasi sistem" />
      <Feedback error={error} />
      {data ? (
        <div className="role-dashboard-content">
          <SystemOverview data={data} />
        </div>
      ) : (
        !error && <LoadingState text="Memuat administrasi pengguna…" />
      )}
    </div>
  );
}
