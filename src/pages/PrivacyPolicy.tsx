import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Introduction</h2>
            <p className="text-muted-foreground">
              InFlow ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy 
              explains how we collect, use, disclose, and safeguard your information when you use our 
              AI-powered instructional design platform.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. Information We Collect</h2>
            
            <h3 className="text-lg font-medium">Personal Information</h3>
            <p className="text-muted-foreground">We may collect:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Name and email address when you create an account</li>
              <li>Profile information you choose to provide</li>
              <li>Payment information for premium features</li>
            </ul>

            <h3 className="text-lg font-medium mt-4">Usage Information</h3>
            <p className="text-muted-foreground">We automatically collect:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Device and browser information</li>
              <li>IP address and location data</li>
              <li>Usage patterns and feature interactions</li>
              <li>Error logs and performance data</li>
            </ul>

            <h3 className="text-lg font-medium mt-4">Content Data</h3>
            <p className="text-muted-foreground">
              We store the content you create, including projects, messages, and generated artifacts, 
              to provide and improve our Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3. How We Use Your Information</h2>
            <p className="text-muted-foreground">We use collected information to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Provide and maintain the Service</li>
              <li>Process AI requests and generate content</li>
              <li>Improve our algorithms and features</li>
              <li>Send service-related communications</li>
              <li>Respond to your inquiries and support requests</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. AI Processing</h2>
            <p className="text-muted-foreground">
              Your content is processed by AI systems to generate suggestions and content. We may use 
              anonymized and aggregated data to improve our AI models. We do not use your personal 
              content to train AI models without your explicit consent.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. Data Sharing</h2>
            <p className="text-muted-foreground">We may share your information with:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Service providers who assist in operating the Service</li>
              <li>AI processing partners for content generation</li>
              <li>Legal authorities when required by law</li>
              <li>Business partners with your consent</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">6. Data Security</h2>
            <p className="text-muted-foreground">
              We implement appropriate technical and organizational measures to protect your information, 
              including encryption, access controls, and regular security assessments. However, no method 
              of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">7. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain your information for as long as your account is active or as needed to provide 
              the Service. You may request deletion of your data at any time, subject to legal retention 
              requirements.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">8. Your Rights</h2>
            <p className="text-muted-foreground">Depending on your location, you may have the right to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability</li>
              <li>Withdraw consent where applicable</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">9. Cookies and Tracking</h2>
            <p className="text-muted-foreground">
              We use cookies and similar technologies to maintain sessions, remember preferences, 
              and analyze usage. You can control cookie settings through your browser, though some 
              features may not function properly without cookies.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">10. Children's Privacy</h2>
            <p className="text-muted-foreground">
              The Service is not intended for children under 13. We do not knowingly collect 
              information from children under 13. If you believe we have collected such information, 
              please contact us immediately.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">11. International Transfers</h2>
            <p className="text-muted-foreground">
              Your information may be transferred to and processed in countries other than your own. 
              We ensure appropriate safeguards are in place for such transfers.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">12. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy periodically. We will notify you of significant changes 
              by posting a notice on the Service or sending you an email. Your continued use after 
              changes constitutes acceptance.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">13. Contact Us</h2>
            <p className="text-muted-foreground">
              For questions about this Privacy Policy or your data, please contact us through our website.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
