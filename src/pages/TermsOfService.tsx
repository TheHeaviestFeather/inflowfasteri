import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using InFlow ("Service"), you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. Description of Service</h2>
            <p className="text-muted-foreground">
              InFlow is an AI-powered instructional design platform that helps create educational content, 
              learning objectives, assessments, and course materials. The Service uses artificial intelligence 
              to assist in generating and refining instructional content.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3. User Accounts</h2>
            <p className="text-muted-foreground">
              To access certain features, you must create an account. You are responsible for:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Providing accurate and complete registration information</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. Acceptable Use</h2>
            <p className="text-muted-foreground">You agree not to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Upload malicious code or content</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon the intellectual property rights of others</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. Intellectual Property</h2>
            <p className="text-muted-foreground">
              Content you create using the Service remains your property. However, you grant us a limited 
              license to process and store your content as necessary to provide the Service. The Service 
              itself, including its design, features, and underlying technology, remains our property.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">6. AI-Generated Content</h2>
            <p className="text-muted-foreground">
              The Service uses AI to generate content suggestions. You acknowledge that:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>AI-generated content may require review and editing</li>
              <li>We do not guarantee the accuracy of AI-generated content</li>
              <li>You are responsible for reviewing and approving all content before use</li>
              <li>AI outputs should be verified for factual accuracy</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">7. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, 
              special, consequential, or punitive damages, or any loss of profits or revenues, whether 
              incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">8. Termination</h2>
            <p className="text-muted-foreground">
              We reserve the right to suspend or terminate your access to the Service at any time for 
              violation of these terms or for any other reason at our discretion. Upon termination, 
              your right to use the Service will immediately cease.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">9. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We may modify these terms at any time. We will notify you of significant changes by posting 
              a notice on the Service or sending you an email. Your continued use of the Service after 
              changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">10. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions about these Terms of Service, please contact us through our website.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfService;
