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

  if (loading) {
    return (
      <div className="p-6">
        <VitalityHero
          title="Wound Timeline"
          subtitle="Loading photos..."
          secondaryCta={{ label: "Back", to: patientId ? providerPatientCenterPath(patientId) : PROVIDER_ROUTES.patients }}
        />
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-6">
        <VitalityHero
          title="Wound Timeline Error"
          subtitle={err}
          secondaryCta={{ label: "Back", to: patientId ? providerPatientCenterPath(patientId) : PROVIDER_ROUTES.patients }}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <VitalityHero
        title="Wound Healing Timeline"
        subtitle="Visual progression of wound healing"
        secondaryCta={{ label: "Back", to: patientId ? providerPatientCenterPath(patientId) : PROVIDER_ROUTES.patients }}
      />

      <div className="max-w-5xl mx-auto mt-6 grid md:grid-cols-3 gap-6">
        {photos.length === 0 ? (
          <div>No wound photos found.</div>
        ) : (
          photos.map((p) => (
            <div key={p.id} className="bg-white/70 border rounded-xl overflow-hidden">
              <img src={p.url} alt={p.filename} className="w-full h-56 object-cover" />

              <div className="p-3 text-sm">
                <div className="font-semibold">{new Date(p.created_at).toLocaleDateString()}</div>

                <div className="opacity-70 text-xs">{new Date(p.created_at).toLocaleTimeString()}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
