import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import RouteHeader from "../components/RouteHeader";
import { supabase } from "../lib/supabase";

type InquiryRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  preferred_contact_method: "phone" | "email" | "either";
  reason_for_inquiry: string;
  message: string;
  status: "new" | "reviewed" | "contacted" | "scheduled" | "closed";
  source: string;
  internal_notes: string | null;
  assigned_to: string | null;
  contacted_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type StaffOption = {
  id: string;
  email: string | null;
  role: string | null;
};

const INQUIRY_SELECT =
  "id,name,phone,email,preferred_contact_method,reason_for_inquiry,message,status,source,internal_notes,assigned_to,contacted_at,resolved_at,created_at,updated_at";

export default function AdminInquiries() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [statusDraft, setStatusDraft] = useState<InquiryRow["status"]>("new");
  const [notesDraft, setNotesDraft] = useState("");
  const [assignedToDraft, setAssignedToDraft] = useState("");

  const selected = useMemo(() => inquiries.find((row) => row.id === selectedId) ?? null, [inquiries, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setStatusDraft(selected.status);
    setNotesDraft(selected.internal_notes ?? "");
    setAssignedToDraft(selected.assigned_to ?? "");
  }, [selected]);

  async function loadInquiries() {
    setLoading(true);
    setError(null);
    try {
      const [inquiryRes, staffRes] = await Promise.all([
        supabase.from("contact_inquiries").select(INQUIRY_SELECT).order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id,email,role")
          .in("role", ["super_admin", "location_admin", "provider", "clinical_staff", "billing", "front_desk"])
          .order("email"),
      ]);

      if (inquiryRes.error) throw inquiryRes.error;
      if (staffRes.error) throw staffRes.error;

      const inquiryRows = (inquiryRes.data as InquiryRow[]) ?? [];
      setInquiries(inquiryRows);
      setStaff((staffRes.data as StaffOption[]) ?? []);
      setSelectedId((current) => {
        if (current && inquiryRows.some((row) => row.id === current)) return current;
        return inquiryRows[0]?.id ?? "";
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inquiries.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInquiries();
  }, []);

  async function saveInquiry() {
    if (!selected || !user?.id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const patch: Record<string, string | null> = {
      status: statusDraft,
      internal_notes: notesDraft.trim() || null,
      assigned_to: assignedToDraft || null,
      updated_at: new Date().toISOString(),
    };

    if ((statusDraft === "contacted" || statusDraft === "scheduled") && !selected.contacted_at) {
      patch.contacted_at = new Date().toISOString();
    }

    if (statusDraft === "closed") {
      patch.resolved_at = selected.resolved_at ?? new Date().toISOString();
    } else if (selected.resolved_at) {
      patch.resolved_at = null;
    }

    try {
      const { data, error: updateError } = await supabase
        .from("contact_inquiries")
        .update(patch)
        .eq("id", selected.id)
        .select(INQUIRY_SELECT)
        .single();

      if (updateError) throw updateError;

      const updated = data as InquiryRow;
      setInquiries((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setSuccess("Inquiry updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update inquiry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-bg">
      <div className="shell">
        <RouteHeader
          title="Public Inquiries"
          subtitle="Review and work new inquiry traffic coming from the public site."
          backTo="/admin"
          homeTo="/admin"
          rightAction={
            <button className="btn btn-ghost" type="button" onClick={loadInquiries}>
              Refresh
            </button>
          }
        />

        <div className="space" />

        {loading ? (
          <div className="card card-pad"><div className="muted">Loading inquiries...</div></div>
        ) : error ? (
          <div className="card card-pad" style={{ color: "#fecaca" }}>{error}</div>
        ) : (
          <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div className="card card-pad card-light surface-light" style={{ flex: "1 1 360px", minWidth: 320 }}>
              <div className="h2">Inquiry Queue</div>
              <div className="surface-light-helper" style={{ marginTop: 4 }}>
                {inquiries.length} inquiries
              </div>
              <div className="space" />
              {inquiries.length === 0 ? (
                <div className="surface-light-helper">No public inquiries yet.</div>
              ) : (
                inquiries.map((inquiry) => (
                  <button
                    key={inquiry.id}
                    type="button"
                    className={selectedId === inquiry.id ? "btn btn-primary" : "btn btn-ghost"}
                    style={{ width: "100%", justifyContent: "space-between", marginBottom: 8, textAlign: "left" }}
                    onClick={() => setSelectedId(inquiry.id)}
                  >
                    <span>
                      <div style={{ fontWeight: 800 }}>{inquiry.name}</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        {inquiry.reason_for_inquiry.replaceAll("_", " ")} | {inquiry.status} | {new Date(inquiry.created_at).toLocaleString()}
                      </div>
                    </span>
                    <span style={{ fontSize: 12 }}>{inquiry.preferred_contact_method}</span>
                  </button>
                ))
              )}
            </div>

            <div className="card card-pad card-light surface-light" style={{ flex: "2 1 680px", minWidth: 340 }}>
              {!selected ? (
                <div className="surface-light-helper">Select an inquiry.</div>
              ) : (
                <>
                  <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div>
                      <div className="h2">{selected.name}</div>
                      <div className="surface-light-helper" style={{ marginTop: 6 }}>
                        Submitted {new Date(selected.created_at).toLocaleString()} via {selected.source}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <div className="v-chip">Status: <strong>{selected.status}</strong></div>
                      <div className="v-chip">Preferred contact: <strong>{selected.preferred_contact_method}</strong></div>
                    </div>
                  </div>

                  <div className="space" />

                  <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
                    <div className="card card-pad" style={{ flex: "1 1 280px" }}>
                      <div className="h2">Contact</div>
                      <div className="space" />
                      <div style={{ lineHeight: 1.8 }}>
                        <div><strong>Email:</strong> {selected.email || "-"}</div>
                        <div><strong>Phone:</strong> {selected.phone || "-"}</div>
                        <div><strong>Reason:</strong> {selected.reason_for_inquiry.replaceAll("_", " ")}</div>
                      </div>
                    </div>

                    <div className="card card-pad" style={{ flex: "2 1 420px" }}>
                      <div className="h2">Inquiry Message</div>
                      <div className="space" />
                      <div style={{ lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{selected.message}</div>
                    </div>
                  </div>

                  <div className="space" />

                  <div className="card card-pad">
                    <div className="h2">Workflow</div>
                    <div className="space" />

                    {success ? <div style={{ color: "#065f46", marginBottom: 12 }}>{success}</div> : null}
                    {error ? <div style={{ color: "#991b1b", marginBottom: 12 }}>{error}</div> : null}

                    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 220px" }}>
                        <div className="surface-light-helper" style={{ fontSize: 12, marginBottom: 6 }}>Status</div>
                        <select className="input" value={statusDraft} onChange={(e) => setStatusDraft(e.target.value as InquiryRow["status"])}>
                          <option value="new">New</option>
                          <option value="reviewed">Reviewed</option>
                          <option value="contacted">Contacted</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>

                      <div style={{ flex: "1 1 260px" }}>
                        <div className="surface-light-helper" style={{ fontSize: 12, marginBottom: 6 }}>Assigned To</div>
                        <select className="input" value={assignedToDraft} onChange={(e) => setAssignedToDraft(e.target.value)}>
                          <option value="">Unassigned</option>
                          {staff.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.email ?? person.id} {person.role ? `(${person.role})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space" />

                    <div className="surface-light-helper" style={{ fontSize: 12, marginBottom: 6 }}>Internal Notes</div>
                    <textarea
                      className="input"
                      style={{ width: "100%", minHeight: 120 }}
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="Internal notes for outreach, triage, or scheduling follow-up."
                    />

                    <div className="space" />

                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <button className="btn btn-primary" type="button" onClick={saveInquiry} disabled={saving}>
                        {saving ? "Saving..." : "Save Workflow Update"}
                      </button>
                    </div>

                    <div className="space" />

                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      {selected.contacted_at ? <div className="v-chip">Contacted: <strong>{new Date(selected.contacted_at).toLocaleString()}</strong></div> : null}
                      {selected.resolved_at ? <div className="v-chip">Resolved: <strong>{new Date(selected.resolved_at).toLocaleString()}</strong></div> : null}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
