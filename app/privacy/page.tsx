import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen py-16 px-6">
      <div className="max-w-3xl mx-auto page-transition">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-10">
          Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>

        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold mb-3">1. Introduction</h2>
            <p>
              Aura (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your
              privacy. This Privacy Policy explains how we collect, use, store,
              and protect your personal information when you use our AI-powered
              skincare analysis service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">
              2. Information We Collect
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Account Information:</strong> Email address, name, and
                password (encrypted) when you create an account.
              </li>
              <li>
                <strong>Selfie Photos:</strong> High-resolution facial
                photographs you voluntarily submit for skin analysis. These are
                processed by our AI system for cosmetic evaluation only.
              </li>
              <li>
                <strong>Skin Profile Data:</strong> Responses to our skin
                questionnaire including age range, skin type, allergies, goals,
                lifestyle factors, and budget preferences.
              </li>
              <li>
                <strong>Usage Data:</strong> How you interact with the app,
                including routine adherence, feedback ratings, and product
                reviews.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                To analyze your skin using AI and provide personalized cosmetic
                skincare recommendations.
              </li>
              <li>
                To generate and adapt skincare routines based on your analysis
                results and feedback.
              </li>
              <li>
                To improve our AI models and recommendation algorithms over
                time.
              </li>
              <li>To communicate important updates about your account or our service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Photo Handling</h2>
            <p>Your photos are treated with the highest level of care:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                Photos are encrypted in transit (TLS 1.3) and at rest
                (AES-256).
              </li>
              <li>
                Photos are stored in private, access-controlled storage buckets
                accessible only to you.
              </li>
              <li>
                EXIF metadata (including GPS location) is stripped before
                storage.
              </li>
              <li>
                Photos are automatically deleted 30 days after analysis, unless
                you choose a different retention period.
              </li>
              <li>
                Photos are never shared with third parties, used for
                advertising, or sold.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">
              5. AI Processing Disclosure
            </h2>
            <p>
              Your selfie photos are processed by Google&apos;s Gemini Vision AI
              model to generate skin analysis results. This processing occurs
              server-side via secure API calls. The AI evaluates cosmetic
              attributes such as skin type, texture, tone, and hydration
              levels. No data is retained by the AI provider beyond the
              processing request.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">
              6. Data Retention
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Account data:</strong> Retained for as long as your
                account is active.
              </li>
              <li>
                <strong>Photos:</strong> Automatically deleted 30 days after
                analysis (configurable in settings).
              </li>
              <li>
                <strong>Analysis results:</strong> Retained to provide your skin
                journey history. Deleted when you delete your account.
              </li>
              <li>
                <strong>Feedback data:</strong> Retained to improve your
                recommendations. Deleted when you delete your account.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">
              7. Your Rights
            </h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <strong>Access:</strong> Download all data we hold about you.
              </li>
              <li>
                <strong>Rectification:</strong> Update or correct your personal
                information.
              </li>
              <li>
                <strong>Deletion:</strong> Delete your account and all
                associated data at any time.
              </li>
              <li>
                <strong>Portability:</strong> Export your data in a
                machine-readable format.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">
              8. Third-Party Sharing
            </h2>
            <p>
              We do not sell, rent, or share your personal data with third
              parties for marketing purposes. Data is only shared with:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <strong>Supabase:</strong> Our database and authentication
                provider, for storing your account and analysis data securely.
              </li>
              <li>
                <strong>Google Gemini AI:</strong> For processing skin analysis
                requests. No data is retained by Google beyond the request.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">9. Security</h2>
            <p>
              We implement industry-standard security measures including TLS
              encryption for all data in transit, AES-256 encryption at rest,
              row-level security policies on all database tables, and
              time-limited signed URLs for photo access. We conduct regular
              security reviews and follow privacy-by-design principles.
            </p>
          </section>

          <section className="border border-gold/30 rounded-xl p-6 bg-gold/5">
            <h2 className="text-2xl font-semibold mb-3 text-gold">
              Important: Not Medical Advice
            </h2>
            <p>
              Aura provides <strong>cosmetic guidance only</strong> and is not a
              substitute for professional medical advice, diagnosis, or
              treatment. Our AI analyzes visible cosmetic attributes of your
              skin and should not be relied upon for medical decisions. If you
              have concerns about a skin condition, please consult a qualified
              dermatologist or healthcare professional.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">10. Contact</h2>
            <p>
              If you have questions about this Privacy Policy or your data,
              please contact us at{" "}
              <a
                href="mailto:privacy@aura-skin.app"
                className="text-gold hover:underline"
              >
                privacy@aura-skin.app
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
