import { PublicShell } from "@/components/Chrome";

export const metadata = {
  title: "Terms of use",
  description: "The terms governing use of Semantic Authoring, including ownership of scholarly work and standards of academic integrity.",
};

export default function Terms() {
  return (
    <PublicShell>
      <section className="wrap narrow" style={{ padding: "72px 24px 0" }}>
        <p className="eyebrow">Version 1.0</p>
        <h1>Terms of use</h1>

        <h2>Your work is yours</h2>
        <p style={{ color: "var(--muted)" }}>
          You retain full ownership of and copyright in everything you create here — notes,
          annotations, drafts, manuscripts, journals, and published work. We claim no
          ownership of your scholarship. We store and process it to provide the service, and
          you may export or delete it at any time.
        </p>

        <h2>Academic integrity</h2>
        <p style={{ color: "var(--muted)" }}>
          This platform is built to support honest scholarship. You agree not to use it to
          misrepresent authorship, fabricate sources or data, or present AI-generated text as
          your own original thinking. Our tools preserve the distinction between what you
          read, what was suggested, and what you authored, and you agree not to circumvent
          that record.
        </p>

        <h2>Copyright and materials you upload</h2>
        <p style={{ color: "var(--muted)" }}>
          You are responsible for having the right to store what you upload. Publisher PDFs
          and licensed materials belong in your private library and are never published
          publicly through this service.
        </p>

        <h2>Publishing</h2>
        <p style={{ color: "var(--muted)" }}>
          You decide what becomes public. We do not publish, syndicate, or submit your work
          anywhere without your explicit action. Testimonials about you are never displayed
          until you approve them individually.
        </p>

        <h2>Acceptable use</h2>
        <p style={{ color: "var(--muted)" }}>
          Do not harass other scholars, misuse testimonial requests as unsolicited mail, or
          attempt to access another member&rsquo;s private workspace.
        </p>

        <h2>Availability</h2>
        <p style={{ color: "var(--muted)" }}>
          The platform is in active development and provided as-is during this period.
          We will give notice before any change that affects your access or your data.
        </p>

        <h2>Contact</h2>
        <p style={{ color: "var(--muted)" }}>
          <a href="mailto:hello@semanticauthoring.org">hello@semanticauthoring.org</a>
        </p>
      </section>
    </PublicShell>
  );
}
