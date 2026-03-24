// src/components/provider/WoundPhotosPanel.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import { getErrorMessage } from "../../lib/patientRecords";
import { uploadPatientFile, getSignedUrl } from "../../lib/patientFiles";

type FileRow = {
  id: string;
  created_at: string;
  patient_id: string;
  location_id: string;
  visit_id: string | null;
  uploaded_by: string | null;
  bucket: string;
  path: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  category: string | null;
  is_internal: boolean;
  notes: string | null;
};

type Props = {
  patientId: string;
  locationId: string;
  visitId: string;
};

export default function WoundPhotosPanel({ patientId, locationId, visitId }: Props) {
  const { user, role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<FileRow[]>([]);
  const [picked, setPicked] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  const isStaff = useMemo(() => role && role !== "patient", [role]);

  const load = async () => {
    if (!patientId || !visitId) return;
    setErr(null);
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("patient_files")
        .select(
          "id,created_at,patient_id,location_id,visit_id,uploaded_by,bucket,path,filename,content_type,size_bytes,category,is_internal,notes"
        )
        .eq("patient_id", patientId)
        .eq("visit_id", visitId)
        .eq("category", "wound_photo")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRows((data as FileRow[]) ?? []);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to load wound photos."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, visitId]);

  const open = async (r: FileRow) => {
    setErr(null);
    try {
      const url = await getSignedUrl(r.bucket, r.path, 120);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to open file."));
    }
  };

  const upload = async () => {
    if (!isStaff) return setErr("Not authorized.");
    if (!user?.id) return setErr("You must be signed in.");
    if (!picked) return;
    if (!patientId || !locationId || !visitId) return;

    setUploading(true);
    setErr(null);

    try {
      await uploadPatientFile({
        file: picked,
        locationId,
        patientId,
        visitId,
        category: "wound_photo",
      });

      setPicked(null);
      setNotes("");
      await load();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Upload failed."));
    } finally {
      setUploading(false);
    }
  };
  // Optional: delete (only if your RLS permits)
  const remove = async (r: FileRow) => {
    if (!isStaff) return setErr("Not authorized.");
    if (!user?.id) return setErr("You must be signed in.");

    const ok = window.confirm(`Delete this photo?\n\n${r.filename}`);
    if (!ok) return;

    setErr(null);
    try {
      // DB delete first (storage cleanup is optional and depends on your setup)
      const { error } = await supabase.from("patient_files").delete().eq("id", r.id);
      if (error) throw error;

      // If you ALSO want to delete from storage:
      // await supabase.storage.from(r.bucket).remove([r.path]);

      await load();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to delete photo."));
    }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString();

  return (
    <div className="card card-pad">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="h2">Wound Photos</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Upload visit-tied wound images (pre/post, weekly progress).
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" type="button" onClick={load} disabled={loading || uploading}>
            Refresh
          </button>
        </div>
      </div>

      {err ? <div style={{ color: "crimson", marginTop: 10 }}>{err}</div> : null}

      <div className="space" />

      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="file"
          accept="image/*"
          className="input"
          onChange={(e) => setPicked(e.target.files?.[0] ?? null)}
          disabled={!isStaff || uploading}
          style={{ flex: "1 1 320px" }}
        />

        <input
          className="input"
          placeholder="Optional notes (e.g., day 0, post-debridement, week 2)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={!isStaff || uploading}
          style={{ flex: "2 1 420px" }}
        />

        <button className="btn btn-primary" type="button" onClick={upload} disabled={!isStaff || uploading || !picked}>
          {uploading ? "Uploading..." : "Upload Photo"}
        </button>
      </div>

      <div className="space" />

      {loading ? (
        <div className="card card-pad" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="muted">Loading wound photos...</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="muted">No wound photos for this visit yet.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              className="card card-pad"
              style={{
                padding: 12,
                borderRadius: 16,
                background: "rgba(255,255,255,.04)",
                border: "1px solid rgba(255,255,255,.10)",
              }}
            >
              <div style={{ fontWeight: 750, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.filename}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {fmt(r.created_at)}
              </div>
              {r.notes ? (
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {r.notes}
                </div>
              ) : null}

              <div className="space" />

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-ghost" type="button" onClick={() => open(r)}>
                  Open
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => remove(r)} disabled={!isStaff}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


