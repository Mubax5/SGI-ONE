"use client";
import { AdaptiveDialog } from "./adaptive-dialog";
import { usePhoneLayout } from "@/lib/phone-layout";
import { useState } from "react";
import {
  Banner,
  Button,
  DatePicker,
  Input,
  Popover,
  Text,
} from "@cloudflare/kumo";
import {
  CalendarBlankIcon,
  CaretDownIcon,
  FunnelIcon,
} from "@phosphor-icons/react";
import {
  defaultReportPeriod,
  parseReportDay,
  recentReportPeriod,
  reportDay,
  REPORT_TIME_ZONE,
} from "@/lib/report-period";
function label(value: string, withYear = true) {
  return (
    parseReportDay(value)?.toLocaleDateString("id-ID", {
      timeZone: REPORT_TIME_ZONE,
      day: "2-digit",
      month: "short",
      ...(withYear ? { year: "numeric" as const } : {}),
    }) ?? "Pilih tanggal"
  );
}
export function ReportPeriod({
  from,
  to,
  loading,
  onApply,
}: {
  from: string;
  to: string;
  loading: boolean;
  onApply: (from: string, to: string) => void;
}) {
  const mobile = usePhoneLayout();
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [month, setMonth] = useState(() => parseReportDay(from) ?? new Date());
  const [error, setError] = useState("");
  function openChanged(next: boolean) {
    if (next) {
      setDraftFrom(from);
      setDraftTo(to);
      setMonth(parseReportDay(from) ?? new Date());
      setError("");
    }
    setOpen(next);
  }
  function selectPeriod(period: { from: string; to: string }) {
    setDraftFrom(period.from);
    setDraftTo(period.to);
    setMonth(parseReportDay(period.from)!);
    setError("");
  }
  function apply() {
    if (!parseReportDay(draftFrom) || !parseReportDay(draftTo)) {
      setError("Isi tanggal awal dan akhir yang valid.");
      return;
    }
    if (draftFrom > draftTo) {
      setError("Tanggal akhir harus sama dengan atau sesudah tanggal awal.");
      return;
    }
    onApply(draftFrom, draftTo);
    setOpen(false);
  }
  const selectedFrom = parseReportDay(draftFrom);
  const selectedTo = parseReportDay(draftTo);
  const form = (
    <form
      className="report-period-form"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      {error && <Banner variant="error" description={error} />}
      <div className="report-period-body">
        <div className="report-period-presets">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => selectPeriod(recentReportPeriod(7))}
          >
            7 hari terakhir
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => selectPeriod(recentReportPeriod(30))}
          >
            30 hari terakhir
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => selectPeriod(defaultReportPeriod())}
          >
            Bulan ini
          </Button>
        </div>
        <DatePicker
          className="report-calendar"
          mode="range"
          timeZone={REPORT_TIME_ZONE}
          month={month}
          onMonthChange={setMonth}
          selected={
            selectedFrom
              ? {
                  from: selectedFrom,
                  to:
                    selectedTo && draftFrom <= draftTo ? selectedTo : undefined,
                }
              : undefined
          }
          onChange={(range) => {
            setDraftFrom(range?.from ? reportDay(range.from) : "");
            setDraftTo(range?.to ? reportDay(range.to) : "");
            setError("");
          }}
          formatters={{
            formatCaption: (date) =>
              date.toLocaleDateString("id-ID", {
                timeZone: REPORT_TIME_ZONE,
                month: "long",
                year: "numeric",
              }),
            formatWeekdayName: (date) =>
              date.toLocaleDateString("id-ID", {
                timeZone: REPORT_TIME_ZONE,
                weekday: "short",
              }),
          }}
          labels={{
            labelPrevious: () => "Bulan sebelumnya",
            labelNext: () => "Bulan berikutnya",
            labelDayButton: (date, modifiers) =>
              `${date.toLocaleDateString("id-ID", { timeZone: REPORT_TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" })}${modifiers.selected ? ", dipilih" : ""}`,
          }}
        />

        <div className="report-period-inputs">
          <Input
            label="Dari"
            type="date"
            value={draftFrom}
            required
            onChange={(event) => {
              setDraftFrom(event.target.value);
              const date = parseReportDay(event.target.value);
              if (date) setMonth(date);
              setError("");
            }}
          />
          <Input
            label="Sampai"
            type="date"
            value={draftTo}
            required
            onChange={(event) => {
              setDraftTo(event.target.value);
              setError("");
            }}
          />
        </div>
        <Text variant="secondary">WIB · UTC+7</Text>
      </div>
      <div className="report-period-actions">
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Batal
        </Button>
        <Button type="submit" variant="primary">
          Terapkan periode
        </Button>
      </div>
    </form>
  );
  const trigger = (
    <Button
      variant="outline"
      disabled={loading}
      aria-label={`Pilih periode laporan, ${label(from)} – ${label(to)}`}
      shape="square"
      icon={<FunnelIcon size={18} />}
      className="desktop-filter-trigger"
    />
  );
  if (mobile)
    return (
      <>
        <Button
          variant="outline"
          disabled={loading}
          className="report-period-trigger"
          aria-label="Pilih periode laporan"
          icon={<CalendarBlankIcon size={16} />}
          onClick={() => openChanged(true)}
        >
          {label(from, from.slice(0, 4) !== to.slice(0, 4))} – {label(to)}
          <CaretDownIcon size={14} />
        </Button>
        <AdaptiveDialog
          open={open}
          onOpenChange={openChanged}
          title="Periode laporan"
          className="period-sheet"
        >
          <div className="detail-body">{form}</div>
        </AdaptiveDialog>
      </>
    );
  return (
    <Popover open={open} onOpenChange={openChanged}>
      <Popover.Trigger render={trigger} />
      <Popover.Content align="start" className="report-period-popover">
        <Popover.Title>Periode laporan</Popover.Title>
        <Popover.Description>
          Aktivitas mengikuti periode ini; saldo/status menunjukkan posisi saat
          ini.
        </Popover.Description>
        {form}
      </Popover.Content>
    </Popover>
  );
}
