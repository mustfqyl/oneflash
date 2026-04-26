import type { Metadata } from "next";
import LegalDocument from "@/app/_components/LegalDocument";
import { getRootDomain } from "@/lib/subdomain";

export const metadata: Metadata = {
  title: "Privacy Policy | oneflash",
  description: "Learn how oneflash collects, uses, and protects your account and cloud connection data.",
};

const LAST_UPDATED = "April 26, 2026";

export default function PrivacyPage() {
  const rootDomain = getRootDomain();

  return (
    <LegalDocument
      activeDocument="privacy"
      eyebrow="Privacy Policy"
      title="How oneflash handles your data"
      description={`This Privacy Policy explains what information ${rootDomain} collects, how it is used, and the choices you have when you create an account, connect cloud providers, and use the service.`}
      lastUpdated={LAST_UPDATED}
      sections={[
        {
          title: "1. Information we collect",
          paragraphs: [
            "When you create an account, we collect the information you provide directly, including your username, email address, password, and 6-digit access PIN. Passwords and PINs are stored as hashes rather than plain text.",
            "When you connect a storage provider such as Google Drive or OneDrive, we store the account details needed to keep that connection working, including provider identifiers, account email when available, and encrypted access and refresh tokens.",
            "We also keep limited security and operational data such as trusted device records, sign-in or access logs, IP-derived abuse controls, and service diagnostics needed to protect the platform."
          ],
        },
        {
          title: "2. How we use information",
          paragraphs: [
            "We use your information to create and secure your account, authenticate you, route you to your personal subdomain, connect your cloud providers, and deliver the file management features you request.",
            "We may also use account, connection, and usage data to prevent abuse, enforce rate limits, troubleshoot reliability issues, and maintain the security of the service."
          ],
        },
        {
          title: "3. How cloud file data is handled",
          paragraphs: [
            "oneflash is designed to help you access storage that you choose to connect. We use provider access granted by you to list files, show metadata, and complete actions such as uploads, downloads, previews, renames, moves, or deletions that you initiate.",
            "Your cloud content may pass through service infrastructure when a requested feature requires it, but it is handled only as needed to complete that feature. We do not sell your files or claim ownership over content stored in your connected drives."
          ],
        },
        {
          title: "4. Sharing and disclosure",
          paragraphs: [
            "We do not sell personal information. Information may be shared with infrastructure, authentication, analytics, storage, or hosting providers only when necessary to operate the service.",
            "We may also disclose information when required by law, to enforce our terms, or to protect the rights, safety, and security of users, the service, or third parties."
          ],
        },
        {
          title: "5. Security and retention",
          paragraphs: [
            "We use reasonable technical and organizational safeguards intended to protect account data, including hashed credentials and encrypted provider tokens where supported by the service.",
            "We retain information for as long as needed to operate the service, comply with legal obligations, resolve disputes, or enforce agreements. Connected provider data may remain until you disconnect the provider or delete the related account."
          ],
        },
        {
          title: "6. Your choices",
          paragraphs: [
            "You can update certain account information from your settings and you can disconnect supported cloud providers at any time.",
            "If you want your account or associated data removed, use the support or administrator contact method made available for the service instance you are using."
          ],
        },
      ]}
    />
  );
}
