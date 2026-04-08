import { useEffect, useState } from "react";
import InlineNotice from "../components/InlineNotice";
import { supabase } from "../lib/supabase";

type ServiceRow = {
  id: string;
  category: string | null;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  visit_type: string | null;
  is_active: boolean | null;
};

function isBotoxService(service: Pick<ServiceRow, "name" | "category">) {
  const haystack = [service.name, service.category].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes("botox") || haystack.includes("neuromodulator");
}

export default function ServicesPanel({
  locationId,
  locationName,
}: {
  locationId: string | null;
  locationName: string | null;
}) {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadServices = async () => {
    if (!locationId) return;
    setErr(null);
    setLoading(true);

    const { data, error } = await supabase
      .from("services")
      .select("id,category,name,description,duration_minutes,visit_type,is_active")
      .eq("location_id", locationId)
      .order("name");

    if (error) setErr(error.message);
    setServices(((data ?? []) as ServiceRow[]).filter((service) => !isBotoxService(service)));
    setLoading(false);
  };

  useEffect(() => {
    void loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) {
    return (
      <div className="card card-pad">
        <div className="h2">Services</div>
        <div className="space" />
        <div className="muted">Select a location to manage its services.</div>
      </div>
    );
  }

  return (
    <div className="card card-pad">
      <div className="h2">Services - {locationName ?? "Location"}</div>
      <div className="space" />

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="h2">Add Service</div>
        <div className="space" />

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            setSaveMessage(null);

            const form = e.currentTarget as HTMLFormElement;
            const category = (form.elements.namedItem("category") as HTMLSelectElement).value;
            const name = (form.elements.namedItem("name") as HTMLInputElement).value;
            const duration = (form.elements.namedItem("duration") as HTMLInputElement).value;
            const visitType = (form.elements.namedItem("visitType") as HTMLSelectElement).value;

            const { error } = await supabase.from("services").insert([
              {
                location_id: locationId,
                category,
                name,
                duration_minutes: duration ? Number(duration) : null,
                visit_type: visitType,
                is_active: true,
              },
            ]);

            if (error) {
              setErr(error.message);
              return;
            }

            form.reset();
            await loadServices();
            setSaveMessage("Service added successfully.");
          }}
        >
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <select className="input" style={{ flex: "1 1 170px" }} name="category" defaultValue="wound_care">
              <option value="wound_care">Wound Care</option>
              <option value="glp1">GLP-1</option>
              <option value="peptides">Peptides</option>
              <option value="trt">TRT</option>
              <option value="hrt">HRT</option>
            </select>

            <input
              className="input"
              style={{ flex: "2 1 260px" }}
              name="name"
              placeholder="Service name (ex: Peptide Intake Consult)"
              required
            />

            <input
              className="input"
              style={{ flex: "1 1 140px" }}
              name="duration"
              placeholder="Minutes (ex: 45)"
              inputMode="numeric"
            />

            <select className="input" style={{ flex: "1 1 150px" }} name="visitType" defaultValue="either">
              <option value="either">In-person or Video</option>
              <option value="in_person">In-person only</option>
              <option value="video">Video only</option>
            </select>

            <button className="btn btn-primary" type="submit">
              Add
            </button>
          </div>
        </form>
      </div>

      {saveMessage ? <InlineNotice message={saveMessage} tone="success" style={{ marginBottom: 12 }} /> : null}
      {loading ? <div className="muted">Loading services...</div> : null}
      {err ? <InlineNotice message={err} tone="error" style={{ marginBottom: 12 }} /> : null}

      {!loading && !err ? (
        <div>
          {services.map((service) => (
            <div key={service.id} className="card card-pad" style={{ marginBottom: 12 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="h2">{service.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Category: {service.category ?? "-"} | Duration: {service.duration_minutes ?? "-"} | Visit: {service.visit_type ?? "-"}
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {service.is_active ? "Active" : "Inactive"}
                </div>
              </div>
            </div>
          ))}
          {services.length === 0 ? <div className="muted">No services for this location yet.</div> : null}
        </div>
      ) : null}
    </div>
  );
}
