import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getSignedUrl } from "../lib/patientFiles";
import { useParams } from "react-router-dom";
import VitalityHero from "../components/VitalityHero";
import { PROVIDER_ROUTES, providerPatientCenterPath } from "../lib/providerRoutes";

type FileRow = {
  id: string;
  patient_id: string;
  visit_id: string | null;
  bucket: string;
  path: string;
  filename: string;
  category: string;
  created_at: string;
};

type Photo = FileRow & {
  url?: string;
};

export default function WoundTimeline() {
  const { patientId } = useParams();

  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("patient_files")
          .select("*")
          .eq("patient_id", patientId)
          .eq("category", "wound_photo")
          .order("created_at", { ascending: true });

        if (error) throw error;

        const list: Photo[] = [];

        for (const f of data ?? []) {
          const url = await getSignedUrl(f.bucket, f.path);

          list.push({
            ...(f as FileRow),
            url,
          });
        }

        setPhotos(list);
      } catch (e: any) {
        console.error(e);
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    }

    if (patientId) load();
  }, [patientId]);

  const backTo = patientId ? providerPatientCenterPath(patientId) : PROVIDER_ROUTES.patients;

  if (loading) {
    return (
      <div className="app-bg">
        <div className="shell">
          <VitalityHero
            title="Wound Timeline"
            subtitle="Loading photos..."
            secondaryCta={{ label: "Back", to: backTo }}
          />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="app-bg">
        <div className="shell">
          <VitalityHero
            title="Wound Timeline Error"
            subtitle={err}
            secondaryCta={{ label: "Back", to: backTo }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Wound Healing Timeline"
          subtitle="Visual progression of wound healing"
          secondaryCta={{ label: "Back", to: backTo }}
        />

        <div style={{ marginTop: 20 }}>
          {photos.length === 0 ? (
            <div className="card card-pad" style={{ color: "var(--v-muted)" }}>
              No wound photos found.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="card"
                  style={{ overflow: "hidden", padding: 0 }}
                >
                  <img
                    src={p.url}
                    alt={p.filename}
                    style={{
                      width: "100%",
                      height: 224,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 12, color: "var(--v-muted)" }}>
                      {new Date(p.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
