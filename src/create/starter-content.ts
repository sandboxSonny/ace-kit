import type { Framework } from "./create-site";

/** A rich text document of plain paragraphs: blank lines in `text` separate them. */
const richText = (text: string) => ({
  type: "doc",
  content: text.split("\n\n").map((paragraph) => ({ type: "paragraph", content: [{ type: "text", text: paragraph }] })),
});

/** Which starters draw sections (they all have components for the hero, FAQ and gallery). */
export const frameworksWithSections: readonly Framework[] = ["astro", "react-router"];

/** Which starters have a contact form section, so the Contact page can show it. */
export const frameworksWithContactForm: readonly Framework[] = ["astro"];

/**
 * The fields of the `pages` content type the starter's pages read. `sections` is left out for a starter without them.
 * The CMS adds the SEO title and description to every content type, so they aren't listed here; the entries below fill them in.
 */
export function pageFields(framework: Framework) {
  const fields = [
    { componentKey: "text", label: "Headline", handle: "headline", config: { required: true } },
    { componentKey: "richtext", label: "Body", handle: "body", config: {} },
    { componentKey: "image", label: "Hero image", handle: "hero", config: {} },
    { componentKey: "date", label: "Published", handle: "published", config: {} },
    { componentKey: "link", label: "Button", handle: "button", config: {} },
  ];
  if (frameworksWithSections.includes(framework))
    fields.push({ componentKey: "sections", label: "Content", handle: "content", config: {} });
  return fields;
}

export type StarterEntry = {
  handle: string;
  title: string;
  description: string;
  /** Values by field handle. A function is given the IDs of the entries made before it (by handle). */
  values: Record<string, unknown | ((entryIds: Record<string, number>) => unknown)>;
};

/** The entries a new site starts with: Home, About and Contact. */
export function starterEntries(framework: Framework, siteName: string): StarterEntry[] {
  const withSections = frameworksWithSections.includes(framework);
  // A date field holds a day with no time of day.
  const today = new Date().toISOString().slice(0, 10);
  const entries: StarterEntry[] = [
    {
      handle: "home",
      title: "Home",
      description: `Welcome to ${siteName}.`,
      values: {
        "seo-title": `${siteName} | Welcome`,
        "seo-description": `Welcome to ${siteName}.`,
        headline: `Welcome to ${siteName}`,
        body: richText(
          "Edit this text in the CMS and reload the page to see it change.\n\nPages are rendered on each request, so there is nothing to rebuild.",
        ),
        button: { href: "https://github.com/sandboxSonny/ace-kit", label: "See Ace Kit" },
        ...(withSections && {
          content: [
            {
              id: "home-hero",
              type: "hero",
              values: {
                heading: "Build pages from sections",
                subheading:
                  "Each section below is a component in this site. Add, reorder and fill them in from the CMS.",
                button: { href: "/pages/about", label: "About this site" },
              },
              blocks: [],
            },
            {
              id: "home-faq",
              type: "faq",
              values: { heading: "Questions" },
              blocks: [
                {
                  id: "home-faq-1",
                  type: "question",
                  values: {
                    question: "What is a section?",
                    answer: richText("A part of a page with its own fields, defined in this site's code."),
                  },
                },
                {
                  id: "home-faq-2",
                  type: "question",
                  values: {
                    question: "What is a block?",
                    answer: richText("One item of a list inside a section, like one of these questions."),
                  },
                },
                {
                  id: "home-faq-3",
                  type: "question",
                  values: {
                    question: "Can I change the order?",
                    answer: richText("Yes: move sections and blocks up and down in the editor."),
                  },
                },
              ],
            },
          ],
        }),
      },
    },
    {
      handle: "about",
      title: "About",
      description: `About ${siteName}.`,
      values: {
        "seo-title": `About | ${siteName}`,
        "seo-description": `About ${siteName}.`,
        headline: "About",
        body: richText(
          "Say who you are and what you do.\n\nThis text is an entry in the CMS: editing it there changes this page.",
        ),
        published: today,
        ...(withSections && {
          content: [
            { id: "about-gallery", type: "gallery", values: { heading: "Gallery", published: today }, blocks: [] },
          ],
        }),
      },
    },
    {
      handle: "contact",
      title: "Contact",
      description: `How to reach ${siteName}.`,
      values: {
        "seo-title": `Contact | ${siteName}`,
        "seo-description": `How to reach ${siteName}.`,
        headline: "Contact",
        body: richText("Tell people how to get in touch."),
        // A link to another entry of the site: it needs About's ID, which exists by now.
        button: (entryIds: Record<string, number>) => ({ entryId: entryIds.about, label: "Learn about us" }),
        ...(frameworksWithContactForm.includes(framework) && {
          content: [
            {
              id: "contact-form",
              type: "contact-form",
              values: {
                heading: "Send us a message",
                intro:
                  "Fill this in and we will get back to you. Messages are emailed to the people chosen under Forms in the CMS.",
                button: "Send message",
              },
              blocks: [],
            },
          ],
        }),
      },
    },
  ];
  return entries;
}
