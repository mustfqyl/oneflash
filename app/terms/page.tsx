import type { Metadata } from "next";
import LegalDocument from "@/app/_components/LegalDocument";
import { getRootDomain } from "@/lib/subdomain";

export const metadata: Metadata = {
  title: "Terms of Service | oneflash",
  description: "Read the basic terms that govern access to oneflash and its connected cloud storage workflows.",
};

const LAST_UPDATED = "April 26, 2026";

export default function TermsPage() {
  const rootDomain = getRootDomain();

  return (
    <LegalDocument
      activeDocument="terms"
      eyebrow="Terms of Service"
      title="Rules for using oneflash"
      description={`These Terms of Service govern your access to and use of ${rootDomain}, including account creation, connected cloud storage features, and any related content or services made available through the platform.`}
      lastUpdated={LAST_UPDATED}
      sections={[
        {
          title: "1. Acceptance of these terms",
          paragraphs: [
            "By creating an account, connecting a provider, or otherwise using the service, you agree to these Terms of Service and to the Privacy Policy.",
            "If you use the service on behalf of an organization, you confirm that you have authority to accept these terms for that organization."
          ],
        },
        {
          title: "2. Accounts and security",
          paragraphs: [
            "You are responsible for providing accurate registration information, keeping your credentials confidential, and maintaining the security of your account, PIN, and connected storage providers.",
            "You must notify the service operator promptly if you believe your account, device, or connected provider access has been compromised."
          ],
        },
        {
          title: "3. Acceptable use",
          paragraphs: [
            "You may not use the service to violate applicable law, infringe intellectual property or privacy rights, distribute malware, attempt unauthorized access, interfere with platform stability, or abuse rate limits or automated workflows.",
            "You may not use the service in a way that harms other users, connected providers, or the underlying infrastructure."
          ],
        },
        {
          title: "4. Connected provider services",
          paragraphs: [
            "The service depends on third-party providers such as Google Drive and OneDrive. Your use of those providers remains subject to their own terms, privacy policies, technical limits, and availability.",
            "We are not responsible for downtime, API changes, quota restrictions, suspensions, or data loss caused by those third-party providers."
          ],
        },
        {
          title: "5. Your content",
          paragraphs: [
            "You retain ownership of the files and content stored in the cloud accounts you connect. By using the service, you grant only the limited permissions necessary for the platform to access, display, transfer, and manage that content on your behalf.",
            "You are solely responsible for ensuring that you have the rights needed to upload, store, share, or manage any content through the service."
          ],
        },
        {
          title: "6. Suspension and termination",
          paragraphs: [
            "We may suspend, limit, or terminate access if we reasonably believe you have violated these terms, created security risk, caused operational harm, or used the service in a fraudulent or abusive manner.",
            "You may stop using the service at any time, and you may disconnect providers or request account deletion through the support path made available for the service."
          ],
        },
        {
          title: "7. Disclaimers and limitation of liability",
          paragraphs: [
            "The service is provided on an as available and as is basis to the fullest extent permitted by law. We do not guarantee uninterrupted availability, perfect compatibility, or error-free operation.",
            "To the fullest extent permitted by law, we are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, data, business, or goodwill arising from your use of the service."
          ],
        },
        {
          title: "8. Changes to the service or these terms",
          paragraphs: [
            "We may update the service or these terms from time to time. Continued use after an update becomes effective means you accept the revised terms.",
            "If a provision of these terms is found unenforceable, the remaining provisions will continue to apply."
          ],
        },
      ]}
    />
  );
}
