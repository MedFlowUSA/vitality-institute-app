import PublicSiteLayout from "../components/public/PublicSiteLayout";

export default function TermsOfService() {
  return (
    <PublicSiteLayout
      title="Terms of Service"
      subtitle="Terms governing access to the Vitality Institute website, portal, and related services."
    >
      <div className="card card-pad">
        <div className="h2">Terms of Service</div>
        <div className="muted" style={{ marginTop: 8, lineHeight: 1.75 }}>
          Effective date: March 25, 2026
        </div>

        <div className="space" />

        <div style={{ display: "grid", gap: 18, lineHeight: 1.8 }}>
          <section>
            <div className="h2">Use of the Platform</div>
            <div className="muted" style={{ marginTop: 8 }}>
              By using the Vitality Institute website or portal, you agree to use the platform only for lawful purposes,
              accurate submissions, appointment-related actions, communication with the clinic, and authorized account access.
            </div>
          </section>

          <section>
            <div className="h2">No Emergency Services</div>
            <div className="muted" style={{ marginTop: 8 }}>
              This platform is not intended for medical emergencies. If you are experiencing an emergency, call 911 or seek
              immediate emergency care.
            </div>
          </section>

          <section>
            <div className="h2">Account Responsibility</div>
            <div className="muted" style={{ marginTop: 8 }}>
              You are responsible for maintaining the confidentiality of your login credentials and for activity performed
              under your account. Notify the clinic promptly if you believe your account has been accessed without
              authorization.
            </div>
          </section>

          <section>
            <div className="h2">Submitted Content</div>
            <div className="muted" style={{ marginTop: 8 }}>
              You are responsible for the accuracy of information, files, and messages you submit. By uploading or sending
              content, you authorize Vitality Institute to use that content as needed for scheduling, intake, care delivery,
              documentation, support, and platform administration.
            </div>
          </section>

          <section>
            <div className="h2">Availability and Changes</div>
            <div className="muted" style={{ marginTop: 8 }}>
              We may update, suspend, or change features, workflows, or content at any time. We do not guarantee uninterrupted
              platform availability.
            </div>
          </section>

          <section>
            <div className="h2">Acceptable Use</div>
            <div className="muted" style={{ marginTop: 8 }}>
              You may not misuse the platform, interfere with security, submit harmful code, attempt unauthorized access, or
              use the service in a way that disrupts staff, patients, or operations.
            </div>
          </section>

          <section>
            <div className="h2">Disclaimers</div>
            <div className="muted" style={{ marginTop: 8 }}>
              Website and portal content is provided for general informational and operational purposes and does not replace
              direct professional medical advice, diagnosis, or treatment.
            </div>
          </section>

          <section>
            <div className="h2">Contact</div>
            <div className="muted" style={{ marginTop: 8 }}>
              Questions about these terms can be directed to Vitality Institute using the contact information listed on the
              site.
            </div>
          </section>
        </div>
      </div>
    </PublicSiteLayout>
  );
}
