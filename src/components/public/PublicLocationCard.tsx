import type { CSSProperties } from "react";
import type { PublicClinicLocation } from "../../lib/publicClinicLocations";

type PublicLocationCardProps = {
  location: PublicClinicLocation;
  eyebrow?: string;
  compact?: boolean;
};

export default function PublicLocationCard({ location, eyebrow, compact = false }: PublicLocationCardProps) {
  return (
    <div
      className="card card-pad card-light surface-light"
      style={{
        border: "1px solid rgba(184,164,255,0.18)",
        boxShadow: "0 14px 28px rgba(16,24,40,0.06)",
      }}
    >
      {eyebrow ? (
        <div style={eyebrowStyle}>
          {eyebrow}
        </div>
      ) : null}

      <div className="h2" style={{ marginTop: eyebrow ? 10 : 0 }}>
        {location.name}
      </div>

      <div className="surface-light-body" style={{ marginTop: 10, lineHeight: 1.8 }}>
        {location.addressLine1}
        {location.addressLine2 ? (
          <>
            <br />
            {location.addressLine2}
          </>
        ) : null}
        <br />
        {location.cityStateZip}
      </div>

      <div className="row" style={{ gap: 20, flexWrap: "wrap", alignItems: "flex-start", marginTop: 14 }}>
        {location.phone ? (
          <div style={{ flex: "1 1 220px" }}>
            <div style={labelStyle}>Phone</div>
            <a href={`tel:+1${location.phone.replace(/\D/g, "")}`} className="surface-light-body" style={valueLinkStyle}>
              {location.phone}
            </a>
          </div>
        ) : null}

        <div style={{ flex: "1 1 220px" }}>
          <div style={labelStyle}>Hours</div>
          <div className="surface-light-body" style={{ marginTop: 8, lineHeight: 1.8 }}>
            {location.hoursLabel}
          </div>
        </div>
      </div>

      {location.email ? (
        <div style={{ marginTop: 14 }}>
          <div style={labelStyle}>Email</div>
          <a href={`mailto:${location.email}`} className="surface-light-body" style={valueLinkStyle}>
            {location.email}
          </a>
        </div>
      ) : null}

      {location.note ? (
        <div className="surface-light-helper" style={{ marginTop: 14, lineHeight: 1.7 }}>
          {location.note}
        </div>
      ) : null}

      {location.website ? (
        <>
          <div style={{ marginTop: 14 }}>
            <div style={labelStyle}>Website</div>
            <a
              href={location.website}
              target="_blank"
              rel="noreferrer"
              className="surface-light-body"
              style={{ ...valueLinkStyle, wordBreak: "break-word" }}
            >
              {location.website}
            </a>
          </div>
          {!compact ? (
            <a
              href={location.website}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              style={{ marginTop: 14, textDecoration: "none" }}
            >
              Visit Website
            </a>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "var(--v-helper-dark)",
  letterSpacing: ".12em",
  textTransform: "uppercase",
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "var(--v-helper-dark)",
};

const valueLinkStyle: CSSProperties = {
  display: "inline-block",
  marginTop: 8,
  color: "#140f24",
  textDecoration: "none",
};
