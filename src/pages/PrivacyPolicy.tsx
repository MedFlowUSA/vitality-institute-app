import PublicSiteLayout from "../components/public/PublicSiteLayout";

export default function PrivacyPolicy() {
  return (
    <PublicSiteLayout
      title="Privacy Policy"
      subtitle="How Vitality Institute collects, uses, stores, and protects personal information."
    >
      <div className="card card-pad">
        <div className="h2">Privacy Policy</div>
        <div className="muted" style={{ marginTop: 8, lineHeight: 1.75 }}>
          Effective date: March 25, 2026
        </div>

        <div className="space" />

        <div style={{ display: "grid", gap: 18, lineHeight: 1.8 }}>
          <section>
            <div className="h2">Information We Collect</div>
            <div className="muted" style={{ marginTop: 8 }}>
              Vitality Institute may collect contact details, account information, appointment requests, intake responses,
              uploaded files, communication history, and other information you choose to provide through the site or portal.
            </div>
          </section>

          <section>
            <div className="h2">How We Use Information</div>
            <div className="muted" style={{ marginTop: 8 }}>
              We use information to provide scheduling, intake, messaging, care coordination, account support, operational
              review, and platform security. We may also use submitted information to respond to inquiries and improve clinic
              workflows.
            </div>
          </section>

          <section>
            <div className="h2">Medical and Sensitive Information</div>
            <div className="muted" style={{ marginTop: 8 }}>
              If you submit health-related information, uploaded images, wound details, treatment history, or lab-related
              content, that information may be used by authorized staff for clinical intake, routing, documentation, and
              follow-up. Do not submit emergency medical information through this website.
            </div>
          </section>

          <section>
            <div className="h2">Sharing</div>
            <div className="muted" style={{ marginTop: 8 }}>
              We may share information with clinic staff, service providers, and technology vendors supporting scheduling,
              storage, messaging, analytics, and operations, only as reasonably necessary to run the platform and deliver
              services. We may also disclose information when required by law or to protect users, staff, or the platform.
            </div>
          </section>

          <section>
            <div className="h2">Data Retention and Security</div>
            <div className="muted" style={{ marginTop: 8 }}>
              We retain information for operational, legal, compliance, and care-related purposes as appropriate. We use
              reasonable administrative and technical safeguards, but no internet-based service can guarantee absolute
              security.
            </div>
          </section>

          <section>
            <div className="h2">Your Choices</div>
            <div className="muted" style={{ marginTop: 8 }}>
              You may contact the clinic to update contact information, request account help, or ask questions about how your
              information is handled. Some records may need to be retained for legal, compliance, or operational reasons.
            </div>
          </section>

          <section>
            <div className="h2">Contact</div>
            <div className="muted" style={{ marginTop: 8 }}>
              For privacy questions, contact Vitality Institute through the clinic contact channels listed on the site.
            </div>
          </section>
        </div>
      </div>
    </PublicSiteLayout>
  );
}
