"use client";
import { Chart, Text } from "@cloudflare/kumo";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  AriaComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useMemo, useSyncExternalStore } from "react";
import type { WorkspaceData } from "@/modules/workspace";
import type { Serialized } from "./types";
import { homeSummary } from "@/lib/home-summary";
import { statuses } from "@/lib/domain";
import { SectionPanel } from "./shared";
echarts.use([
  BarChart,
  GridComponent,
  TooltipComponent,
  AriaComponent,
  CanvasRenderer,
]);
const subscribe = () => () => {};
function themeSnapshot() {
  const element =
    document.querySelector('[data-theme="sgi"]') ?? document.documentElement;
  const style = getComputedStyle(element);
  return JSON.stringify([
    style.getPropertyValue("--color-kumo-brand").trim(),
    style.getPropertyValue("--text-color-kumo-default").trim(),
    style.getPropertyValue("--color-kumo-line").trim(),
  ]);
}
export function WorkspaceChart({ data }: { data: Serialized<WorkspaceData> }) {
  const snapshot = useSyncExternalStore(subscribe, themeSnapshot, () => "");
  const entries = useMemo(() => {
    if (data.role === "operations" || data.role === "field")
      return ["draft", "assigned", "in_progress", "completed", "cancelled"].map(
        (status) => ({
          label: statuses[status],
          value: data.jobs.filter((j) => j.status === status).length,
        }),
      );
    if (data.role === "finance")
      return [
        {
          label: "Draft",
          value: data.invoices.filter((i) => i.status === "draft").length,
        },
        {
          label: "Piutang",
          value: data.invoices.filter(
            (i) => i.status === "issued" && i.outstanding > 0,
          ).length,
        },
        {
          label: "Lunas",
          value: data.invoices.filter(
            (i) => i.status === "issued" && i.outstanding === 0,
          ).length,
        },
        {
          label: "Void",
          value: data.invoices.filter((i) => i.status === "void").length,
        },
      ];
    if (data.role === "sales")
      return ["draft", "approved", "rejected"].map((status) => ({
        label: statuses[status],
        value: data.quotations.filter((q) => q.status === status).length,
      }));
    if (data.role === "admin")
      return [
        {
          label: "Aktif ber-role",
          value: data.users.filter((u) => u.active && u.roles.length > 0)
            .length,
        },
        {
          label: "Tanpa role",
          value: data.users.filter((u) => u.active && !u.roles.length).length,
        },
        {
          label: "Nonaktif",
          value: data.users.filter((u) => !u.active).length,
        },
      ];
    return homeSummary(data).statuses.map((s) => ({
      label: s.label,
      value: Number(s.value),
    }));
  }, [data]);
  const options = useMemo(() => {
    const [brand, ink, line] = snapshot ? JSON.parse(snapshot) : ["", "", ""];
    return {
      animation: false,
      aria: { enabled: true },
      grid: { left: 120, right: 28, top: 12, bottom: 28 },
      tooltip: { trigger: "axis" as const, renderMode: "richText" as const },
      xAxis: {
        type: "value" as const,
        minInterval: 1,
        axisLabel: { color: ink, fontSize: 14 },
        splitLine: { lineStyle: { color: line } },
      },
      yAxis: {
        type: "category" as const,
        data: entries.map((e) => e.label),
        inverse: true,
        axisLabel: { color: ink, fontSize: 14 },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          name: "Jumlah",
          type: "bar" as const,
          data: entries.map((e) => e.value),
          barMaxWidth: 22,
          itemStyle: { color: brand },
          label: {
            show: true,
            position: "right" as const,
            color: ink,
            fontSize: 14,
          },
        },
      ],
    };
  }, [entries, snapshot]);
  return (
    <SectionPanel
      title={
        data.role === "director"
          ? "Antrean operasional dan penagihan"
          : "Distribusi status"
      }
      description={
        data.role === "director"
          ? "Kategori menunjukkan antrean berbeda dan dapat beririsan."
          : "Jumlah dari data workspace Anda; setiap record dihitung pada statusnya saat ini."
      }
    >
      {snapshot && <Chart echarts={echarts} options={options} height={240} />}
      <div className="chart-accessible-summary" aria-label="Nilai grafik">
        {entries.map((e) => (
          <Text key={e.label} as="span">
            {e.label}: <strong>{e.value}</strong>
          </Text>
        ))}
      </div>
    </SectionPanel>
  );
}
