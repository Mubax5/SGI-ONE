"use client";
import { Button, Tabs, Text } from "@cloudflare/kumo";
import { ArrowRightIcon, CheckCircleIcon } from "@phosphor-icons/react";
import type { FormEvent } from "react";
import type { MapData } from "@/modules/maps";
import type { MapPoint } from "@/lib/map-links";
import type { Serialized } from "./types";
import { Feedback, Modal } from "./shared";
import { PlacePicker } from "./place-picker";
type Row = Serialized<MapData>["rows"][number];

export function JobLocationDialog({
  job,
  points,
  endpoint,
  onEndpointChange,
  onPointChange,
  error,
  busy,
  onClose,
  onSubmit,
}: {
  job: Row | null;
  points: { origin?: MapPoint; destination?: MapPoint };
  endpoint: string;
  onEndpointChange: (step: string) => void;
  onPointChange: (point: MapPoint) => void;
  error: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Modal
      open={!!job}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Lokasi asal dan tujuan"
      description={job?.number}
      className="job-location-dialog"
    >
      <form onSubmit={onSubmit}>
        <div className="location-editor-body">
          <Feedback error={error} />
          <Tabs
            className="location-step-tabs"
            listClassName="location-step-list"
            value={endpoint}
            onValueChange={onEndpointChange}
            tabs={[
              {
                value: "origin",
                label: (
                  <span className="location-step-label">
                    1. Asal{points.origin && <CheckCircleIcon size={16} />}
                  </span>
                ),
              },
              {
                value: "destination",
                label: (
                  <span className="location-step-label">
                    2. Tujuan
                    {points.destination && <CheckCircleIcon size={16} />}
                  </span>
                ),
              },
            ]}
          />
          {job && (
            <div className="location-job-route">
              <Text variant="secondary">{job.customerName}</Text>
              <Text>
                {job.origin} → {job.destination}
              </Text>
            </div>
          )}
          {job && (
            <PlacePicker
              key={`${job.id}:${endpoint}`}
              label={endpoint === "origin" ? "Lokasi asal" : "Lokasi tujuan"}
              value={endpoint === "origin" ? points.origin : points.destination}
              onChange={onPointChange}
            />
          )}
          {endpoint === "destination" && points.origin && (
            <div className="location-origin-summary">
              <Text as="strong">Asal dipilih</Text>
              <Text variant="secondary">{points.origin.label}</Text>
            </div>
          )}
        </div>
        <div className="form-actions">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Batal
          </Button>
          {endpoint === "destination" && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => onEndpointChange("origin")}
            >
              Kembali ke asal
            </Button>
          )}
          {endpoint === "origin" ? (
            <Button
              key="next-step"
              type="button"
              variant="primary"
              icon={<ArrowRightIcon size={18} />}
              disabled={!points.origin || busy}
              onClick={(event) => {
                event.preventDefault();
                onEndpointChange("destination");
              }}
            >
              Lanjut ke tujuan
            </Button>
          ) : (
            <Button
              key="save-location"
              type="submit"
              variant="primary"
              loading={busy}
              disabled={!points.origin || !points.destination || busy}
            >
              Simpan dan lihat rute
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
