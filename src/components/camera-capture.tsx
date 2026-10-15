"use client";
import { Button } from "@cloudflare/kumo";
import { CameraIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { api, Feedback } from "./shared";
export type CameraPhoto = {
  file: File;
  cameraToken: string;
  capturedAt: number;
};
export function CameraCapture({
  onCapture,
  disabled,
}: {
  onCapture: (photo: CameraPhoto) => void;
  disabled?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream>(null);
  const [active, setActive] = useState(false),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  async function start() {
    setError("");
    setBusy(true);
    try {
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });
      setActive(true);
      setReady(false);
      video.current!.srcObject = stream.current;
      await video.current!.play();
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      setActive(false);
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Izinkan kamera di pengaturan browser, lalu buka kamera kembali."
          : "Kamera tidak tersedia. Periksa kamera dan gunakan browser dengan izin kamera.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function capture() {
    if (!video.current || !ready || !stream.current?.active) return;
    setBusy(true);
    setError("");
    try {
      const token = await api<{ id: string }>("attendance/camera-token");
      const frame = document.createElement("canvas");
      const scale = Math.min(
        1,
        1600 / video.current.videoWidth,
        1600 / video.current.videoHeight,
      );
      frame.width = Math.round(video.current.videoWidth * scale);
      frame.height = Math.round(video.current.videoHeight * scale);
      frame
        .getContext("2d")!
        .drawImage(video.current, 0, 0, frame.width, frame.height);
      const capturedAt = Date.now();
      const blob = await new Promise<Blob>((resolve, reject) =>
        frame.toBlob(
          (b) =>
            b
              ? resolve(b)
              : reject(new Error("Foto gagal diambil. Coba lagi.")),
          "image/jpeg",
          0.9,
        ),
      );
      onCapture({
        file: new File([blob], `absensi-${capturedAt}.jpg`, {
          type: "image/jpeg",
        }),
        cameraToken: token.id,
        capturedAt,
      });
      stream.current.getTracks().forEach((t) => t.stop());
      stream.current = null;
      video.current.srcObject = null;
      setActive(false);
      setReady(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Foto gagal diambil. Coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="camera-capture">
      <Feedback error={error} />
      <video
        ref={video}
        playsInline
        muted
        autoPlay
        onCanPlay={() => setReady(true)}
        aria-label="Kamera absensi"
        hidden={!active}
      />
      <Button
        type="button"
        variant="outline"
        icon={<CameraIcon size={18} />}
        onClick={() => void start()}
        loading={busy}
        disabled={disabled || active}
      >
        Buka kamera
      </Button>
      {active && (
        <Button
          type="button"
          variant="primary"
          onClick={() => void capture()}
          disabled={!ready || disabled || busy}
        >
          Ambil foto
        </Button>
      )}
    </div>
  );
}
