export type ProviderTimelineRow = {
  visit_id: string;
  patient_id: string;
  location_id: string;
  visit_date: string;
  visit_status: string | null;
  summary: string | null;
  soap_id: string | null;
  soap_status: string | null;
  is_signed: boolean | null;
  is_locked: boolean | null;
  signed_at: string | null;
  soap_created_at: string | null;
};

export type ProviderTimelineFallbackVisit = {
  id: string;
  patient_id: string;
  location_id: string;
  visit_date: string | null;
  created_at: string;
  status: string | null;
  summary: string | null;
};

export type ProviderTimelineFallbackSoap = {
  id: string;
  visit_id: string;
  created_at: string;
  is_signed: boolean | null;
  is_locked: boolean | null;
  signed_at: string | null;
};

function toTimestamp(value: string | null | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

export function buildProviderTimelineRowsFromFallback(
  visits: ProviderTimelineFallbackVisit[],
  soapRows: ProviderTimelineFallbackSoap[]
): ProviderTimelineRow[] {
  const latestSoapByVisit = new Map<string, ProviderTimelineFallbackSoap>();

  [...soapRows]
    .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at))
    .forEach((row) => {
      if (!latestSoapByVisit.has(row.visit_id)) latestSoapByVisit.set(row.visit_id, row);
    });

  return visits.map((visit) => {
    const latestSoap = latestSoapByVisit.get(visit.id);

    return {
      visit_id: visit.id,
      patient_id: visit.patient_id,
      location_id: visit.location_id,
      visit_date: visit.visit_date ?? visit.created_at,
      visit_status: visit.status,
      summary: visit.summary,
      soap_id: latestSoap?.id ?? null,
      soap_status: latestSoap ? (latestSoap.is_locked ? "locked" : latestSoap.is_signed ? "signed" : "draft") : null,
      is_signed: latestSoap?.is_signed ?? null,
      is_locked: latestSoap?.is_locked ?? null,
      signed_at: latestSoap?.signed_at ?? null,
      soap_created_at: latestSoap?.created_at ?? null,
    };
  });
}
