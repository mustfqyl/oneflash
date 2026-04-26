import type { Metadata } from "next";
import LegalDocument from "@/app/_components/LegalDocument";
import { getRootDomain } from "@/lib/subdomain";

export const metadata: Metadata = {
  title: "What Is This? | oneflash",
  description: "Understand what oneflash is, what it does, and how the platform is meant to be used.",
};

const LAST_UPDATED = "April 26, 2026";

export default function WhatIsThisPage() {
  const rootDomain = getRootDomain();

  return (
    <LegalDocument
      activeDocument="what-is-this"
      eyebrow="What Is This?"
      title="What oneflash is and what it is not"
      description={`${rootDomain} is a personal cloud control panel that lets you connect supported storage providers and access them from a cleaner, faster, and more private interface.`}
      lastUpdated={LAST_UPDATED}
      sections={[
        {
          title: "Overview",
          paragraphs: [
            "oneflash brings supported cloud storage accounts into a single interface so you can browse, organize, and open files without jumping between different provider dashboards.",
            "It is designed around a personal subdomain, account login, and PIN-based file access flow so your workspace feels more like a private file hub than a generic storage settings page."
          ],
        },
      ]}
      bulletSections={[
        {
          title: "What oneflash does",
          items: [
            "Lets you connect supported providers such as Google Drive and OneDrive into one workspace.",
            "Gives you a personal subdomain where your file area can be accessed with your account and PIN flow.",
            "Shows cloud files in a Finder-like interface built for browsing, selecting, previewing, and managing content.",
            "Supports everyday file actions such as navigating folders, creating folders, uploading files, downloading files, renaming items, moving items, and deleting items.",
            "Keeps provider connections tied to your account so you can manage multiple connected storage sources from one place."
          ],
        },
        {
          title: "What oneflash is not",
          items: [
            "It is not a new cloud storage provider that replaces Google Drive or OneDrive.",
            "It is not a public file marketplace or social content platform.",
            "It is not an unlimited backup service that silently stores extra copies of all your files for you.",
            "It is not meant to change the ownership of your content; your files remain in the cloud accounts you choose to connect."
          ],
        },
      ]}
      faqItems={[
        {
          question: "Does oneflash store my files itself?",
          answer:
            "Its main role is to help you access and manage files from the providers you connect. Your files continue to live in those connected cloud accounts.",
        },
        {
          question: "Can I use oneflash without connecting a provider?",
          answer:
            "Not meaningfully. The product is built around connected cloud storage, so its core experience starts after you link a supported account.",
        },
        {
          question: "Who is this for?",
          answer:
            "It is best suited for people who want a simpler personal file hub for supported cloud drives instead of switching between multiple provider interfaces.",
        },
        {
          question: "Is oneflash a replacement for Google Drive or OneDrive accounts?",
          answer:
            "No. It works on top of supported providers rather than replacing them, and those provider accounts still determine storage, availability, and account-level rules.",
        },
      ]}
    />
  );
}
