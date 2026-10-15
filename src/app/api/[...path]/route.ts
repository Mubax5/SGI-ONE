import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getActor, sameOrigin } from "@/lib/security";
import { DomainError, requirePermission } from "@/lib/domain";
import { storageConfigured } from "@/lib/storage";
import { jobDetail, readModule } from "@/modules/queries";
import { downloadDocument, uploadDocument } from "@/modules/documents";
import * as service from "@/modules/services";
import { identifier } from "@/modules/validation";
import { limitedForm, limitedJson } from "@/lib/request-body";
import { createReport, reportPhoto } from "@/modules/reports";
import { globalSearch } from "@/modules/search";
import { jobRoadRoute, mapJobs, saveLocation } from "@/modules/maps";
import {
  activeWorkspace,
  scopedWorkspaceActor,
  WORKSPACE_COOKIE,
} from "@/lib/workspace-server";
import { workspaceRole } from "@/lib/workspace";
import { changeCursor } from "@/modules/changes";
import { systemHealth } from "@/modules/system";
import { searchPlaces, reversePlace } from "@/modules/places";
import {
  attendancePhoto,
  saveAttendanceSite,
  submitAttendance,
  issueAttendanceCameraToken,
  attendanceMonitoring,
  reviewAttendance,
} from "@/modules/attendance";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
function failure(error: unknown) {
  if (error instanceof DomainError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
        fields: error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  const cause = error as { code?: string; cause?: { code?: string } };
  if (cause.code === "23505" || cause.cause?.code === "23505")
    return Response.json(
      {
        error:
          "Data/referensi sudah dipakai. Periksa kembali sebelum menyimpan.",
      },
      { status: 409 },
    );
  console.error("SGI API error", error);
  return Response.json(
    { error: "Operasi gagal. Coba kembali atau hubungi administrator." },
    { status: 500 },
  );
}
export async function GET(request: NextRequest, context: Context) {
  try {
    const identity = await getActor(request.headers);
    const path = (await context.params).path;
    if (path.length === 1 && path[0] === "me") {
      const preferences = new Headers(request.headers);
      preferences.delete("x-sgi-workspace");
      return Response.json(
        {
          actor: identity,
          workspace: await activeWorkspace(identity, null, preferences),
          storageConfigured: storageConfigured(),
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const actor = await scopedWorkspaceActor(
      identity,
      request.nextUrl.searchParams.get("role"),
      request.headers,
    );
    let data;
    if (path.length === 1 && path[0] === "changes")
      data = await changeCursor(actor);
    else if (path.length === 2 && path[0] === "data" && path[1] === "system")
      data = await systemHealth(
        actor,
        request.nextUrl.searchParams.get("probe") === "1",
      );
    else if (path.length === 1 && path[0] === "places")
      data = await searchPlaces(actor, request.nextUrl.searchParams.get("q"), {
        mode: request.nextUrl.searchParams.get("mode"),
        lat: request.nextUrl.searchParams.get("lat"),
        lng: request.nextUrl.searchParams.get("lng"),
      });
    else if (
      path.length === 2 &&
      path[0] === "places" &&
      path[1] === "reverse"
    ) {
      if (
        !request.nextUrl.searchParams.get("lat")?.trim() ||
        !request.nextUrl.searchParams.get("lng")?.trim()
      )
        throw new DomainError("Pilih titik lokasi pada peta.");
      data = await reversePlace(actor, {
        lat: request.nextUrl.searchParams.get("lat"),
        lng: request.nextUrl.searchParams.get("lng"),
      });
    } else if (
      path.length === 3 &&
      path[0] === "attendance" &&
      path[2] === "photo"
    )
      return await attendancePhoto(actor, identifier.parse(path[1]));
    else if (path.length === 1 && path[0] === "maps")
      data = await mapJobs(actor);
    else if (path.length === 3 && path[0] === "jobs" && path[2] === "route") {
      const lat = request.nextUrl.searchParams.get("lat"),
        lng = request.nextUrl.searchParams.get("lng");
      if ((lat !== null || lng !== null) && (!lat?.trim() || !lng?.trim()))
        throw new DomainError(
          "Latitude dan longitude posisi awal harus diisi bersama.",
        );
      if (request.nextUrl.searchParams.has("preference"))
        throw new DomainError("Rute ditentukan otomatis oleh sistem.");
      data = await jobRoadRoute(
        actor,
        identifier.parse(path[1]),
        lat === null ? undefined : { lat, lng },
      );
    } else if (path.length === 2 && path[0] === "data")
      data = await readModule(actor, path[1], request.nextUrl.searchParams);
    else if (
      path.length === 2 &&
      path[0] === "attendance" &&
      path[1] === "camera-token"
    )
      data = await issueAttendanceCameraToken(actor);
    else if (
      path.length === 2 &&
      path[0] === "attendance" &&
      path[1] === "monitoring"
    )
      data = await attendanceMonitoring(actor);
    else if (path.length === 2 && path[0] === "jobs")
      data = await jobDetail(actor, identifier.parse(path[1]));
    else if (path.length === 1 && path[0] === "search")
      data = await globalSearch(
        actor,
        request.nextUrl.searchParams.get("q"),
        request.nextUrl.searchParams.get("role"),
      );
    else if (path.length === 3 && path[0] === "reports" && path[2] === "photo")
      return await reportPhoto(actor, identifier.parse(path[1]));
    else if (
      path.length === 3 &&
      path[0] === "documents" &&
      ["download", "preview"].includes(path[2])
    )
      return await downloadDocument(
        actor,
        identifier.parse(path[1]),
        path[2] === "preview",
      );
    else throw new DomainError("Endpoint tidak ditemukan.", 404);
    return Response.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    sameOrigin(request);
    const identity = await getActor(request.headers);
    const [resource, rawId, action, ...extra] = (await context.params).path;
    if (resource === "workspace" && !rawId) {
      requirePermission(identity, "users");
      const input = (await limitedJson(request)) as { role?: string };
      if (!input || typeof input.role !== "string" || !input.role)
        throw new DomainError("Pilih area kerja yang tersedia.");
      const role = workspaceRole(identity, input.role);
      return Response.json(
        { role },
        {
          headers: {
            "Set-Cookie": `${WORKSPACE_COOKIE}=${encodeURIComponent(JSON.stringify([identity.id, role]))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`,
            "Cache-Control": "no-store",
          },
        },
      );
    }
    const actor = await scopedWorkspaceActor(
      identity,
      request.nextUrl.searchParams.get("role"),
      request.headers,
    );
    if (extra.length) throw new DomainError("Endpoint tidak ditemukan.", 404);
    const id =
      rawId && !(resource === "attendance" && rawId === "sites")
        ? identifier.parse(rawId)
        : undefined;
    if (resource === "jobs" && id && action === "upload") {
      return Response.json(
        await uploadDocument(actor, id, await limitedForm(request)),
      );
    }
    if (resource === "jobs" && id && action === "report")
      return Response.json(
        await createReport(actor, id, await limitedForm(request)),
      );
    if (resource === "attendance" && !rawId)
      return Response.json(
        await submitAttendance(actor, await limitedForm(request)),
      );
    if (resource === "attendance" && rawId === "sites" && !action)
      return Response.json(
        await saveAttendanceSite(actor, await limitedJson(request)),
      );
    const input = await limitedJson(request);
    if (resource === "attendance" && id && action === "review")
      return Response.json(await reviewAttendance(actor, id, input));
    let result;
    if (resource === "customers" && !action)
      result = await service.saveCustomer(actor, input, id);
    else if (resource === "requests" && !id)
      result = await service.createRequest(actor, input);
    else if (resource === "jobs" && !action)
      result = await service.saveJob(actor, input, id);
    else if (resource === "jobs" && id && action === "location")
      result = await saveLocation(actor, id, input);
    else if (resource === "jobs" && id && action === "assign")
      result = await service.assignJob(actor, id, input);
    else if (resource === "jobs" && id && action === "status")
      result = await service.changeJobStatus(actor, id, input);
    else if (resource === "jobs" && id && action === "progress")
      result = await service.addProgress(actor, id, input);
    else if (resource === "jobs" && id && action === "delivery")
      result = await service.createDelivery(actor, id, input);
    else if (resource === "documents" && id && action === "review")
      result = await service.reviewDocument(actor, id, input);
    else if (resource === "billables" && !id)
      result = await service.createBillable(actor, input);
    else if (resource === "billables" && id && action === "approve")
      result = await service.approveBillable(actor, id, input);
    else if (resource === "invoices" && !action)
      result = await service.saveDraft(actor, input, id);
    else if (resource === "invoices" && id && action === "issue")
      result = await service.issueInvoice(actor, id);
    else if (resource === "invoices" && id && action === "delete")
      result = await service.deleteDraft(actor, id);
    else if (resource === "invoices" && id && action === "correct")
      result = await service.correctInvoice(actor, id, input);
    else if (resource === "payments" && !id)
      result = await service.createPayment(actor, input);
    else if (resource === "payments" && id && action === "allocate")
      result = await service.allocatePayment(actor, id, input);
    else if (resource === "quotations" && !id)
      result = await service.saveQuotation(actor, input);
    else if (resource === "quotations" && id && action === "approve")
      result = await service.approveQuotation(actor, id, input);
    else if (resource === "users" && !id)
      result = await service.createUser(actor, input);
    else if (resource === "users" && id && action === "roles")
      result = await service.changeRoles(actor, id, input);
    else throw new DomainError("Endpoint tidak ditemukan.", 404);
    return Response.json(result ?? { success: true });
  } catch (e) {
    return failure(e);
  }
}
