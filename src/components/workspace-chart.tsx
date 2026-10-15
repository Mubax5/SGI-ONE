"use client";
import {
  Chart,
  ChartPalette,
  Empty,
  LinkButton,
  LayerCard,
  Text,
  TimeseriesChart,
} from "@cloudflare/kumo";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { WorkspaceData } from "@/modules/workspace";
import type { Serialized } from "./types";
import { formatMoney, statuses } from "@/lib/domain";
import { parseReportDay, reportDay } from "@/lib/report-period";
import { DataTable, SectionPanel } from "./shared";
import { JobMap } from "./job-map";
import { FilterButtons } from "./filter-buttons";
import { FilterPopover } from "./filter-popover";
echarts.use([
  BarChart,
  LineChart,
  AriaComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);
type Data = Serialized<WorkspaceData>;
type Period = { from: string; to: string };
const subscribe = () => () => {};
function brandSnapshot() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue("--color-kumo-brand")
    .trim();
}
function within(value: string | null, period: Period) {
  if (!value) return false;
  const day = reportDay(new Date(value));
  return day >= period.from && day <= period.to;
}
function timeline<T>(
  rows: T[],
  period: Period,
  date: (row: T) => string | null,
  amount: (row: T) => number,
): [number, number][] {
  const start = parseReportDay(period.from),
    end = parseReportDay(period.to);
  if (!start || !end) return [];
  const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  const step = days > 120 ? 7 : 1;
  const buckets = new Map<number, number>();
  for (
    let time = start.getTime();
    time <= end.getTime();
    time += step * 86400000
  )
    buckets.set(time, 0);
  for (const row of rows) {
    const value = date(row);
    if (!within(value, period)) continue;
    const day = parseReportDay(reportDay(new Date(value!)))!.getTime();
    const key =
      start.getTime() +
      Math.floor((day - start.getTime()) / (step * 86400000)) * step * 86400000;
    buckets.set(key, (buckets.get(key) ?? 0) + amount(row));
  }
  return [...buckets];
}
function distribution(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts].map(([label, value]) => ({ label, value }));
}
function SnapshotChart({
  title,
  entries,
  brand,
  money,
  currency,
}: {
  title: string;
  entries: { label: string; value: number }[];
  brand: string;
  money?: boolean;
  currency: string;
}) {
  const options = useMemo(
    () => ({
      animation: false,
      aria: { enabled: true, description: title },
      tooltip: {
        trigger: "axis" as const,
        valueFormatter: (value: unknown) =>
          money ? formatMoney(Number(value), currency) : String(value),
        confine: true,
      },
      grid: { left: 140, right: 32, top: 16, bottom: 24 },
      xAxis: {
        type: "value" as const,
        name: money ? currency : "Jumlah",
        minInterval: money ? undefined : 1,
        axisLabel: {
          formatter: (v: number) =>
            money
              ? new Intl.NumberFormat("id-ID", { notation: "compact" }).format(
                  v / 100,
                )
              : String(v),
        },
      },
      yAxis: {
        type: "category" as const,
        data: entries.map((e) => e.label),
        axisLabel: { fontSize: 14 },
      },
      series: [
        {
          type: "bar" as const,
          barMaxWidth: 24,
          label: { show: false },
          data: entries.map((entry) => ({
            name: entry.label,
            value: entry.value,
            itemStyle: {
              color: brand,
            },
          })),
        },
      ],
    }),
    [entries, brand, title, money, currency],
  );
  if (entries.every((entry) => entry.value === 0))
    return (
      <Empty
        title="Tidak ada nilai untuk didistribusikan"
        description="Ubah periode laporan."
      />
    );
  return (
    <>
      <Chart echarts={echarts} options={options} height={220} />
      <div className="chart-accessible-summary" aria-label="Nilai grafik">
        {entries.map((entry) => (
          <Text key={entry.label}>
            {entry.label}:{" "}
            <strong>
              {money ? formatMoney(entry.value, currency) : entry.value}
            </strong>
          </Text>
        ))}
      </div>
    </>
  );
}
function RouteCoverage({ ids }: { ids: string[] }) {
  return (
    <section
      className="analytics-map-section"
      aria-label="Sebaran lokasi pekerjaan"
    >
      <Text as="h2" variant="heading">
        Sebaran lokasi pekerjaan
      </Text>
      <div className="analytics-map">
        <JobMap embedded jobIds={ids} />
      </div>
    </section>
  );
}
export function WorkspaceChart({
  data,
  period,
  controls,
}: {
  data: Data;
  period: Period;
  controls?: ReactNode;
}) {
  const brand = useSyncExternalStore(subscribe, brandSnapshot, () => "");
  const [currency, setCurrency] = useState("IDR");
  const monetary = data.role === "finance" || data.role === "director";
  const jobs =
    data.role === "operations"
      ? data.jobs
      : data.role === "director"
        ? data.analytics.jobs
        : [];
  const invoices =
    data.role === "finance"
      ? data.invoices
      : data.role === "director"
        ? data.analytics.invoices
        : [];
  const payments =
    data.role === "finance"
      ? data.payments
      : data.role === "director"
        ? data.analytics.payments
        : [];
  const quotes = data.role === "sales" ? data.quotations : [];
  const requests = data.role === "sales" ? data.requests : [];
  const filteredJobs = jobs.filter((row) => within(row.createdAt, period));
  const filteredInvoices = invoices.filter(
    (row) => row.currency === currency && within(row.createdAt, period),
  );
  const filteredQuotes = quotes.filter((row) => within(row.createdAt, period));
  const outstanding = invoices.filter(
    (row) =>
      row.currency === currency &&
      row.status === "issued" &&
      row.outstanding > 0,
  );
  const entries =
    data.role === "sales"
      ? distribution(
          filteredQuotes.map((row) => statuses[row.status] ?? row.status),
        )
      : monetary
        ? distribution(
            filteredInvoices.map((row) =>
              row.status === "issued"
                ? row.outstanding > 0
                  ? "Bersaldo"
                  : "Lunas"
                : (statuses[row.status] ?? row.status),
            ),
          )
        : distribution(
            filteredJobs.map((row) => statuses[row.status] ?? row.status),
          );
  const lines = monetary
    ? [
        {
          name: "Invoice terbit",
          color: brand,
          data: timeline(
            invoices.filter(
              (row) => row.currency === currency && row.status === "issued",
            ),
            period,
            (row) => row.issuedAt,
            (row) => row.total,
          ).map(([date, value]) => [date, value / 100] as [number, number]),
        },
        {
          name: "Penerimaan",
          color: ChartPalette.semantic("Neutral", false),
          data: timeline(
            payments.filter((row) => row.currency === currency),
            period,
            (row) => row.receivedAt,
            (row) => row.amount,
          ).map(([date, value]) => [date, value / 100] as [number, number]),
        },
      ]
    : data.role === "sales"
      ? [
          {
            name: "Permintaan",
            color: brand,
            data: timeline(
              requests,
              period,
              (row) => row.createdAt,
              () => 1,
            ),
          },
          {
            name: "Penawaran",
            color: ChartPalette.semantic("Neutral", false),
            data: timeline(
              quotes,
              period,
              (row) => row.createdAt,
              () => 1,
            ),
          },
        ]
      : [
          {
            name: "Job dibuat",
            color: brand,
            data: timeline(
              jobs,
              period,
              (row) => row.createdAt,
              () => 1,
            ),
          },
        ];
  const aging = [
    { label: "Belum jatuh tempo", value: 0 },
    { label: "1–30 hari", value: 0 },
    { label: "31–60 hari", value: 0 },
    { label: ">60 hari", value: 0 },
  ];
  for (const invoice of outstanding) {
    const days = invoice.dueAt
      ? Math.ceil(
          (new Date(data.asOf).getTime() - new Date(invoice.dueAt).getTime()) /
            86400000,
        )
      : 0;
    aging[days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3].value +=
      invoice.outstanding;
  }
  const summaries = monetary
    ? [
        {
          label: `Piutang ${currency} saat ini`,
          value: formatMoney(
            outstanding.reduce((sum, row) => sum + row.outstanding, 0),
            currency,
          ),
        },
        {
          label: "Penagihan dalam periode",
          value: formatMoney(
            invoices
              .filter(
                (r) =>
                  r.currency === currency &&
                  r.status === "issued" &&
                  within(r.issuedAt, period),
              )
              .reduce((sum, r) => sum + r.total, 0),
            currency,
          ),
        },
        {
          label: "Penerimaan dalam periode",
          value: formatMoney(
            payments
              .filter(
                (row) =>
                  row.currency === currency && within(row.receivedAt, period),
              )
              .reduce((sum, row) => sum + row.amount, 0),
            currency,
          ),
        },
      ]
    : data.role === "sales"
      ? [
          {
            label: "Permintaan dalam periode",
            value: String(
              requests.filter((row) => within(row.createdAt, period)).length,
            ),
          },
          {
            label: "Penawaran dalam periode",
            value: String(filteredQuotes.length),
          },
          {
            label: "Penawaran disetujui saat ini",
            value: String(
              filteredQuotes.filter((row) => row.status === "approved").length,
            ),
          },
        ]
      : [
          {
            label: "Job dibuat dalam periode",
            value: String(filteredJobs.length),
          },
          {
            label: "Job aktif dalam periode",
            value: String(
              filteredJobs.filter(
                (row) => !["completed", "cancelled"].includes(row.status),
              ).length,
            ),
          },
          {
            label: "Bukti perlu review saat ini",
            value: String(data.role === "operations" ? data.reviews.length : 0),
          },
        ];
  if (!brand) return <Text variant="secondary">Memuat analitik…</Text>;
  return (
    <>
      <section className="analytics-overview" aria-label="Ringkasan analitik">
        <div className="analytics-overview-heading">
          <Text as="h2" variant="heading">
            Ringkasan analitik
          </Text>
          <div className="analytics-controls">
            {controls}
            {monetary && (
              <FilterPopover
                active={currency !== "IDR"}
                label="Filter analitik"
              >
                <FilterButtons
                  label="Mata uang"
                  value={currency}
                  items={{ IDR: "IDR", USD: "USD", SGD: "SGD" }}
                  onChange={setCurrency}
                />
              </FilterPopover>
            )}
          </div>
        </div>
        <div className="analytics-stat-cards">
          {summaries.map((item) => (
            <LayerCard key={item.label} className="analytics-stat-card">
              <LayerCard.Primary>
                <Text variant="secondary">{item.label}</Text>
                <Text as="p" variant="heading" size="lg">
                  {item.value}
                </Text>
              </LayerCard.Primary>
            </LayerCard>
          ))}
        </div>
      </section>
      <div className="analytics-grid">
        <SectionPanel
          className="analytics-wide"
          id="penagihan"
          title={
            monetary
              ? "Penagihan dan penerimaan"
              : data.role === "sales"
                ? "Permintaan dan penawaran"
                : "Aktivitas pekerjaan"
          }
          description={
            monetary
              ? `${currency} · Invoice: tanggal terbit; penerimaan: tanggal diterima.`
              : "Berdasarkan tanggal dibuat."
          }
        >
          <div className="analytics-chart">
            <TimeseriesChart
              echarts={echarts}
              data={lines}
              gradient
              type="line"
              tooltipFooter={
                monetary
                  ? "Tanggal terbit invoice dan tanggal penerimaan · WIB"
                  : "Jumlah berdasarkan tanggal dibuat · WIB"
              }
              height={260}
              xAxisName="Tanggal (WIB)"
              yAxisName={monetary ? currency : "Jumlah"}
              yAxisMinInterval={monetary ? undefined : 1}
              xAxisTickFormat={(time) =>
                new Date(time).toLocaleDateString("id-ID", {
                  timeZone: "Asia/Jakarta",
                  day: "numeric",
                  month: "short",
                })
              }
              tooltipValueFormat={(value) =>
                monetary
                  ? formatMoney(Math.round(value * 100), currency)
                  : String(value)
              }
              ariaDescription="Tren transaksi dalam periode laporan."
            />
            <div className="chart-accessible-summary">
              {lines.map((line) => (
                <Text key={line.name}>
                  {line.name}:{" "}
                  <strong>
                    {monetary
                      ? formatMoney(
                          Math.round(
                            line.data.reduce(
                              (sum, [, value]) => sum + value,
                              0,
                            ) * 100,
                          ),
                          currency,
                        )
                      : line.data.reduce((sum, [, value]) => sum + value, 0)}
                  </strong>
                </Text>
              ))}
            </div>
          </div>
        </SectionPanel>
        <SectionPanel
          title={
            data.role === "sales"
              ? "Status penawaran"
              : monetary
                ? "Status invoice"
                : "Status pekerjaan"
          }
        >
          <div className="analytics-chart">
            {entries.length ? (
              <SnapshotChart
                title="Komposisi status"
                entries={entries}
                brand={brand}
                currency={currency}
              />
            ) : (
              <Empty
                title="Belum ada data dalam periode"
                description="Ubah periode laporan."
              />
            )}
          </div>
        </SectionPanel>
        {monetary && (
          <SectionPanel
            title="Usia piutang saat ini"
            description={`${currency} · Saldo saat ini, semua periode.`}
          >
            <div className="analytics-chart">
              <SnapshotChart
                title="Usia piutang"
                entries={aging}
                brand={brand}
                currency={currency}
                money
              />
            </div>
            <div className="analytics-data">
              <LinkButton href="/invoices?status=outstanding">
                Tindak lanjuti invoice bersaldo
              </LinkButton>
            </div>
          </SectionPanel>
        )}
        {monetary && (
          <SectionPanel title="Customer dengan saldo piutang">
            <DataTable
              rows={Object.values(
                outstanding.reduce<
                  Record<string, { id: string; name: string; value: number }>
                >((all, row) => {
                  const entry = all[row.customerId] ?? {
                    id: row.customerId,
                    name: row.customerName,
                    value: 0,
                  };
                  entry.value += row.outstanding;
                  all[row.customerId] = entry;
                  return all;
                }, {}),
              ).sort((a, b) => b.value - a.value)}
              perPage={5}
              columns={[
                {
                  title: "Customer",
                  render: (row) => (
                    <LinkButton
                      href={`/invoices?q=${encodeURIComponent(row.name)}`}
                      variant="ghost"
                    >
                      {row.name}
                    </LinkButton>
                  ),
                },
                {
                  title: "Saldo",
                  render: (row) => formatMoney(row.value, currency),
                },
              ]}
            />
          </SectionPanel>
        )}
        {data.role === "operations" && (
          <SectionPanel title="Pekerjaan melewati tenggat">
            <DataTable
              rows={jobs.filter(
                (row) =>
                  !["completed", "cancelled"].includes(row.status) &&
                  new Date(row.dueAt).getTime() < new Date(data.asOf).getTime(),
              )}
              perPage={5}
              columns={[
                {
                  title: "Job",
                  render: (row) => (
                    <LinkButton href={`/jobs/${row.id}`} variant="ghost">
                      {row.number}
                      <p>{row.customerName}</p>
                    </LinkButton>
                  ),
                },
                {
                  title: "Tenggat",
                  render: (row) =>
                    new Date(row.dueAt).toLocaleDateString("id-ID"),
                },
                {
                  title: "Petugas",
                  render: (row) =>
                    row.assignees.map((person) => person.name).join(", ") ||
                    "Belum ditugaskan",
                },
              ]}
            />
          </SectionPanel>
        )}
        {(data.role === "operations" || data.role === "director") && (
          <RouteCoverage ids={filteredJobs.map((row) => row.id)} />
        )}
        {data.role === "sales" && (
          <SectionPanel title="Penawaran perlu tindak lanjut">
            <DataTable
              rows={filteredQuotes.filter((row) => row.status === "draft")}
              perPage={5}
              columns={[
                {
                  title: "Penawaran",
                  render: (row) => (
                    <LinkButton
                      href={`/quotations?q=${encodeURIComponent(row.title)}`}
                      variant="ghost"
                    >
                      {row.title}
                    </LinkButton>
                  ),
                },
                { title: "Customer", render: (row) => row.customerName },
                {
                  title: "Nilai",
                  render: (row) => formatMoney(row.amount, row.currency),
                },
              ]}
            />
          </SectionPanel>
        )}
      </div>
    </>
  );
}
