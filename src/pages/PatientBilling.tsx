import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import PayPalCheckoutCard from "../components/payments/PayPalCheckoutCard";
import VitalityHero from "../components/VitalityHero";
import { resolvePromoDiscount } from "../lib/payments/promo";
import { formatCatalogLocationName, fmtMoney } from "../lib/services/catalog";
import { supabase } from "../lib/supabase";

type PatientRow = { id: string };
type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  service_group: string | null;
  location_id: string | null;
  requires_consult: boolean | null;
  price_marketing_cents: number | null;
  price_regular_cents: number | null;
  is_active: boolean | null;
};
type AppointmentRow = {
  id: string;
  patient_id: string;
  service_id: string | null;
  provider_user_id: string | null;
  location_id: string | null;
  start_time: string;
  status: string | null;
};
type LocationRow = { id: string; name: string; city: string | null; state: string | null };
type ClinicLocationRow = { clinic_id: string; location_id: string };
type ClinicRow = { id: string; name: string; brand_name: string | null };
type ProviderRow = { id: string; first_name: string | null; last_name: string | null };

const cardStyle = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(245,241,255,0.92))",
  border: "1px solid rgba(184,164,255,0.22)",
  color: "#241B3D",
} as const;

const eyebrowStyle = {
  fontSize: 12,
  fontWeight: 800,
  color: "#6D5BA8",
  textTransform: "uppercase" as const,
  letterSpacing: ".08em",
} as const;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function providerLabel(provider: ProviderRow | null) {
  if (!provider) return "Assigned after checkout";
  return [provider.first_name, provider.last_name].filter(Boolean).join(" ").trim() || provider.id;
}

function isIvDripService(service: Pick<ServiceRow, "name" | "category" | "service_group"> | null) {
  if (!service) return false;
  const haystack = [service.name, service.category, service.service_group].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes("iv") || haystack.includes("drip") || haystack.includes("nad");
}

export default function PatientBilling() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    paymentTransactionId: string;
    amountCents: number;
    currency: string;
    serviceName: string;
    discountAmountCents?: number;
    promoCode?: string | null;
  } | null>(null);

  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [clinicLocations, setClinicLocations] = useState<ClinicLocationRow[]>([]);
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [providers, setProviders] = useState<ProviderRow[]>([]);

  const [serviceId, setServiceId] = useState(searchParams.get("serviceId") ?? "");
  const [appointmentId, setAppointmentId] = useState(searchParams.get("appointmentId") ?? "");
  const [promoCode, setPromoCode] = useState("");

  const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID as string | undefined;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!user?.id) return;

        const { data: patientRow, error: patientError } = await supabase
          .from("patients")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (patientError) throw patientError;
        if (!patientRow?.id) throw new Error("No patient record is linked to your login yet.");
        setPatient(patientRow);

        const [
          { data: serviceRows, error: serviceError },
          { data: appointmentRows, error: appointmentError },
          { data: locationRows, error: locationError },
          { data: clinicLocationRows, error: clinicLocationError },
        ] = await Promise.all([
          supabase
            .from("services")
            .select("id,name,description,category,service_group,location_id,requires_consult,price_marketing_cents,price_regular_cents,is_active")
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("appointments")
            .select("id,patient_id,service_id,provider_user_id,location_id,start_time,status")
            .eq("patient_id", patientRow.id)
            .order("start_time", { ascending: false })
            .limit(25),
          supabase.from("locations").select("id,name,city,state").order("name"),
          supabase.from("clinic_locations").select("clinic_id,location_id"),
        ]);

        if (serviceError) throw serviceError;
        if (appointmentError) throw appointmentError;
        if (locationError) throw locationError;
        if (clinicLocationError) throw clinicLocationError;

        const nextServices = ((serviceRows as ServiceRow[]) ?? []).filter((row) => row.is_active ?? true);
        const nextAppointments = (appointmentRows as AppointmentRow[]) ?? [];
        const nextClinicLocations = (clinicLocationRows as ClinicLocationRow[]) ?? [];

        setServices(nextServices);
        setAppointments(nextAppointments);
        setLocations((locationRows as LocationRow[]) ?? []);
        setClinicLocations(nextClinicLocations);

        const clinicIds = Array.from(new Set(nextClinicLocations.map((row) => row.clinic_id).filter(Boolean)));
        const providerIds = Array.from(new Set(nextAppointments.map((row) => row.provider_user_id).filter(Boolean))) as string[];

        const [{ data: clinicRows, error: clinicError }, { data: providerRows, error: providerError }] = await Promise.all([
          clinicIds.length
            ? supabase.from("clinics").select("id,name,brand_name").in("id", clinicIds).order("name")
            : Promise.resolve({ data: [], error: null }),
          providerIds.length
            ? supabase.from("profiles").select("id,first_name,last_name").in("id", providerIds).order("first_name")
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (clinicError) throw clinicError;
        if (providerError) throw providerError;

        setClinics((clinicRows as ClinicRow[]) ?? []);
        setProviders((providerRows as ProviderRow[]) ?? []);

        const defaultAppointment = appointmentId && nextAppointments.some((row) => row.id === appointmentId) ? appointmentId : "";
        const defaultService =
          serviceId && nextServices.some((row) => row.id === serviceId)
            ? serviceId
            : defaultAppointment
              ? nextAppointments.find((row) => row.id === defaultAppointment)?.service_id ?? ""
              : nextServices[0]?.id ?? "";

        setAppointmentId(defaultAppointment);
        setServiceId(defaultService);
      } catch (loadError: unknown) {
        setError(getErrorMessage(loadError, "Failed to load checkout."));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user?.id]);

  const selectedAppointment = useMemo(() => appointments.find((row) => row.id === appointmentId) ?? null, [appointmentId, appointments]);

  const selectedService = useMemo(() => {
    const fromAppointment = selectedAppointment?.service_id ? services.find((row) => row.id === selectedAppointment.service_id) ?? null : null;
    if (fromAppointment) return fromAppointment;
    return services.find((row) => row.id === serviceId) ?? null;
  }, [selectedAppointment?.service_id, serviceId, services]);

  const serviceAppointments = useMemo(() => {
    if (!selectedService?.id) return appointments;
    return appointments.filter((row) => row.service_id === selectedService.id);
  }, [appointments, selectedService?.id]);

  const selectedLocation = useMemo(() => {
    const resolvedLocationId = selectedAppointment?.location_id ?? selectedService?.location_id ?? null;
    return locations.find((row) => row.id === resolvedLocationId) ?? null;
  }, [locations, selectedAppointment?.location_id, selectedService?.location_id]);

  const selectedClinic = useMemo(() => {
    const resolvedLocationId = selectedLocation?.id ?? null;
    if (!resolvedLocationId) return null;
    const clinicLocation = clinicLocations.find((row) => row.location_id === resolvedLocationId);
    return clinics.find((row) => row.id === clinicLocation?.clinic_id) ?? null;
  }, [clinicLocations, clinics, selectedLocation?.id]);

  const selectedProvider = useMemo(() => {
    if (!selectedAppointment?.provider_user_id) return null;
    return providers.find((row) => row.id === selectedAppointment.provider_user_id) ?? null;
  }, [providers, selectedAppointment?.provider_user_id]);

  const amountCents = selectedService?.price_marketing_cents ?? selectedService?.price_regular_cents ?? 0;
  const promoSummary = useMemo(() => resolvePromoDiscount(amountCents, promoCode), [amountCents, promoCode]);
  const amountLabel = fmtMoney(promoSummary.finalAmountCents) ?? "Pricing pending";
  const baseAmountLabel = fmtMoney(amountCents) ?? "Pricing pending";
  const requiresConsult = Boolean(selectedService?.requires_consult);
  const isIvCheckout = isIvDripService(selectedService);
  const hasPromoCodeEntry = promoCode.trim().length > 0;
  const invalidPromoEntered = hasPromoCodeEntry && !promoSummary.valid;
  const blockedReason = !selectedService
    ? "Select a service to begin checkout."
    : requiresConsult && !selectedAppointment
      ? "This service requires provider review or physician approval before payment. Attach it to an appointment after the clinic has prepared your next step."
      : null;

  useEffect(() => {
    const nextSearch = new URLSearchParams();
    if (selectedService?.id) nextSearch.set("serviceId", selectedService.id);
    else nextSearch.delete("serviceId");
    if (selectedAppointment?.id) nextSearch.set("appointmentId", selectedAppointment.id);
    else nextSearch.delete("appointmentId");
    setSearchParams(nextSearch, { replace: true });
  }, [selectedAppointment?.id, selectedService?.id, setSearchParams]);

  return (
    <div className="app-bg">
      <div className="shell">
        <VitalityHero
          title="Checkout & Payments"
          subtitle="Pay Vitality directly through PayPal. Physician revenue share is tracked internally after payment capture."
          secondaryCta={{ label: "Back to Dashboard", to: "/patient/home" }}
          rightActions={
            <button className="btn btn-secondary" type="button" onClick={signOut}>
              Sign out
            </button>
          }
          showKpis={false}
        />

        <div className="space" />

        {loading ? (
          <div className="card card-pad card-light surface-light" style={cardStyle}>
            <div className="muted">Loading checkout...</div>
          </div>
        ) : null}

        {error ? (
          <div className="card card-pad card-light surface-light" style={cardStyle}>
            <div style={{ color: "crimson" }}>{error}</div>
          </div>
        ) : null}

        {success ? (
          <div className="card card-pad card-light surface-light" style={cardStyle}>
            <div style={eyebrowStyle}>Payment Complete</div>
            <div className="h2" style={{ marginTop: 8 }}>Your payment has been recorded.</div>
            <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.7 }}>
              {success.serviceName} was paid successfully for {fmtMoney(success.amountCents) ?? success.amountCents} {success.currency}.
            </div>
            {success.discountAmountCents ? (
              <div className="surface-light-helper" style={{ marginTop: 8, lineHeight: 1.7 }}>
                A promo discount of {fmtMoney(success.discountAmountCents) ?? success.discountAmountCents} was applied before capture.
              </div>
            ) : null}
            <div className="muted" style={{ marginTop: 10 }}>Transaction ID: {success.paymentTransactionId}</div>
            <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <button className="btn btn-primary" type="button" onClick={() => navigate("/patient/home")}>
                Return To Dashboard
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => navigate("/patient/treatments")}>
                View Treatments
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !success ? (
          <>
            <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
              <div className="card card-pad card-light surface-light" style={{ ...cardStyle, flex: "1 1 340px", minWidth: 300 }}>
                <div style={eyebrowStyle}>Step 1</div>
                <div className="h2" style={{ marginTop: 8 }}>Choose the service you are paying for</div>
                <div className="surface-light-helper" style={{ marginTop: 8, lineHeight: 1.6 }}>
                  V1 checkout is best for fixed-price services or services the clinic has already prepared for payment.
                </div>

                <div className="space" />

                <select className="input" value={selectedService?.id ?? ""} onChange={(event) => setServiceId(event.target.value)}>
                  <option value="">Select service</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} {fmtMoney(service.price_marketing_cents ?? service.price_regular_cents) ? `- ${fmtMoney(service.price_marketing_cents ?? service.price_regular_cents)}` : ""}
                    </option>
                  ))}
                </select>

                <div className="space" />

                <select className="input" value={selectedAppointment?.id ?? ""} onChange={(event) => setAppointmentId(event.target.value)}>
                  <option value="">Attach to an appointment later or leave blank</option>
                  {serviceAppointments.map((appointment) => (
                    <option key={appointment.id} value={appointment.id}>
                      {new Date(appointment.start_time).toLocaleString()} - {(appointment.status ?? "scheduled").replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="card card-pad card-light surface-light" style={{ ...cardStyle, flex: "1 1 340px", minWidth: 300 }}>
                <div style={eyebrowStyle}>Step 2</div>
                <div className="h2" style={{ marginTop: 8 }}>Review the checkout context</div>

                <div className="space" />

                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <div className="v-chip">{selectedService ? "Service selected" : "Choose a service"}</div>
                  <div className="v-chip">{requiresConsult ? "Clinical review required" : "Self-pay ready"}</div>
                  <div className="v-chip">{amountLabel}</div>
                </div>

                <div className="space" />

                <label style={{ display: "grid", gap: 8 }}>
                  <div className="public-mini-title">Promo code</div>
                  <input
                    className="input"
                    type="text"
                    value={promoCode}
                    onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                    placeholder="Enter promo code if provided"
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                </label>

                <div className="surface-light-helper" style={{ marginTop: 8, lineHeight: 1.7 }}>
                  If the clinic gave you a private promo code, enter it before checkout. This field is intended for approved discounts such as first responder pricing.
                </div>

                {hasPromoCodeEntry ? (
                  <div
                    className="card card-pad card-light surface-light"
                    style={{ marginTop: 12, border: `1px solid ${promoSummary.valid ? "rgba(22,163,74,0.28)" : "rgba(220,38,38,0.22)"}` }}
                  >
                    <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <strong>{promoSummary.valid ? "Promo applied" : "Promo needs review"}</strong>
                      <span>{promoSummary.valid ? `-${fmtMoney(promoSummary.discountAmountCents) ?? promoSummary.discountAmountCents}` : "No discount applied"}</span>
                    </div>
                    <div className="surface-light-helper" style={{ marginTop: 8, lineHeight: 1.7 }}>
                      {promoSummary.valid
                        ? `Your updated checkout total is ${amountLabel}.`
                        : "This promo code is not recognized yet. Please confirm it with the clinic or clear the field before checkout."}
                    </div>
                  </div>
                ) : null}

                <div className="surface-light-body" style={{ marginTop: 12, lineHeight: 1.8 }}>
                  <strong>Base price:</strong> {baseAmountLabel}
                  <br />
                  <strong>Discount:</strong> {promoSummary.valid ? `-${fmtMoney(promoSummary.discountAmountCents) ?? promoSummary.discountAmountCents}` : "$0"}
                  <br />
                  <strong>Checkout total:</strong> {amountLabel}
                </div>

                <div className="surface-light-body" style={{ lineHeight: 1.8 }}>
                  <strong>Service:</strong> {selectedService?.name ?? "Not selected"}
                  <br />
                  <strong>Location:</strong> {selectedLocation ? `${formatCatalogLocationName(selectedLocation)}${selectedLocation.city || selectedLocation.state ? ` - ${[selectedLocation.city, selectedLocation.state].filter(Boolean).join(", ")}` : ""}` : "Resolved after service selection"}
                  <br />
                  <strong>Clinic:</strong> {selectedClinic ? selectedClinic.brand_name ?? selectedClinic.name : "Vitality clinic context pending"}
                  <br />
                  <strong>Provider:</strong> {providerLabel(selectedProvider)}
                  <br />
                  <strong>Appointment:</strong> {selectedAppointment ? new Date(selectedAppointment.start_time).toLocaleString() : "Not attached yet"}
                </div>

                {selectedService?.description ? (
                  <>
                    <div className="space" />
                    <div className="surface-light-helper" style={{ lineHeight: 1.7 }}>
                      {selectedService.description}
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div className="space" />

            {isIvCheckout ? (
              <>
                <div className="card card-pad card-light surface-light" style={cardStyle}>
                  <div style={eyebrowStyle}>In-Clinic IV Drips</div>
                  <div className="h2" style={{ marginTop: 8 }}>Current IV drip pricing and timing</div>
                  <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
                    In-clinic IV drips start at $199 base. NAD+ 1000 is an additional $199 and requires a minimum 2-hour session. B12 add-on pricing is $49.
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                    <div className="v-chip">Base drip from $199</div>
                    <div className="v-chip">NAD+ 1000 add-on +$199</div>
                    <div className="v-chip">B12 add-on +$49</div>
                    <div className="v-chip">NAD+ minimum 2 hours</div>
                  </div>
                </div>

                <div className="space" />
              </>
            ) : null}

            {blockedReason ? (
              <div className="card card-pad card-light surface-light" style={cardStyle}>
                <div style={eyebrowStyle}>Clinical Guardrail</div>
                <div className="h2" style={{ marginTop: 8 }}>Checkout is paused for this service.</div>
                <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.7 }}>
                  {blockedReason}
                </div>
                <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                  <button className="btn btn-primary" type="button" onClick={() => navigate("/patient/book")}>
                    Book Or Review Appointment
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => navigate("/patient/chat")}>
                    Message The Clinic
                  </button>
                </div>
              </div>
            ) : (
              <PayPalCheckoutCard
                clientId={clientId}
                disabled={!patient?.id || !selectedService?.id || !amountCents || invalidPromoEntered}
                serviceId={selectedService?.id ?? ""}
                appointmentId={selectedAppointment?.id ?? null}
                providerId={selectedAppointment?.provider_user_id ?? null}
                clinicId={selectedClinic?.id ?? null}
                locationId={selectedLocation?.id ?? null}
                promoCode={promoSummary.valid ? promoSummary.normalizedCode : null}
                amountLabel={amountLabel}
                serviceName={selectedService?.name ?? "Vitality service"}
                onSuccess={(result) => {
                  setError(null);
                  setSuccess(result);
                }}
              />
            )}

            <div className="space" />

            <div className="card card-pad card-light surface-light" style={cardStyle}>
              <div style={eyebrowStyle}>V1 Payment Model</div>
              <div className="h2" style={{ marginTop: 8 }}>How payments and physician payouts work right now</div>
              <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.75 }}>
                PayPal is only the patient payment mechanism in V1. Vitality receives the full checkout amount. Physician revenue share is calculated internally after capture and tracked in the payout ledger for admin-controlled payout review.
              </div>
              <div className="surface-light-helper" style={{ marginTop: 10, lineHeight: 1.7 }}>
                The selected service starts at {baseAmountLabel}. Eligible promo discounts adjust the final amount before PayPal capture.
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
