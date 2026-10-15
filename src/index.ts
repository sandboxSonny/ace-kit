// The framework-free core: everything here runs on a server or in a browser with no framework installed.
// Astro and React adapters live in "@sandboxsonny/ace-kit/astro" and "@sandboxsonny/ace-kit/react".

export { createAceClient } from "./client/create-client";
export type { AceClient } from "./client/create-client";
export { AcePreviewExpiredError, AceUnavailableError } from "./client/errors";

export { addressFromPath, homeAddress, isHomeAddress, pathOfAddress, visitablePath } from "./helpers/addressing";
export { imageAttributes } from "./helpers/images";
export type { AceImageAttributes, AceImageOptions } from "./helpers/images";
export { defineSection } from "./sections/define-section";
export type {
  BlockDefinition,
  SectionDefinition,
  SectionFieldDefinition,
  SectionFieldType,
  SectionOf,
  ValuesOfFields,
} from "./sections/define-section";
export { checkSectionDefinition, sectionTypesPayload } from "./sections/payload";
export type { SectionTypesPayload } from "./sections/payload";
export { formatAceDate } from "./helpers/dates";
export type { AceDateFormat } from "./helpers/dates";
export { isInternalPath, linkAddress, linkAttributes } from "./helpers/links";
export type { AceLinkAttributes } from "./helpers/links";
export { isCurrentPage, linksFromMenu, loadMenuLinks } from "./helpers/menus";
export { loadPage } from "./helpers/page";
export { pageNotices } from "./helpers/notices";
export {
  addFramingPolicy,
  framingPolicy,
  isRefreshRequest,
  originOf,
  previewHeaders,
  previewParameter,
  previewTokenFrom,
  refreshMessageType,
  swapPageContent,
} from "./helpers/preview";
export { listenForPreviewRefresh, refreshPageContent } from "./helpers/preview-listener";
export { seoDescriptionHandle, seoProperties, seoTitleHandle } from "./helpers/seo";
export type { AceSeoOptions, AceSeoProperties } from "./helpers/seo";
export { renderTextArea } from "./helpers/text-area";
export { headingLevel, listStart, renderRichText, richTextImageSizes } from "./helpers/rich-text";

export type { AceAddress } from "./types/addressing";
export type { AceClientOptions } from "./types/client";
export type { AceContentTypeSchema, AceFieldSchema } from "./types/content-types";
export type { AceContentTypeHandle, AceContentTypes, AceEntry, AceValuesOf } from "./types/entries";
export type { AceImageData } from "./types/images";
export type { AceLinkData } from "./types/links";
export type { AceMenu, AceMenuItem, AceNavigationLink } from "./types/menus";
export type { AceSection, AceSectionBlock } from "./types/sections";
export type { AcePage } from "./types/page";
export type { AceRichTextDocument, AceRichTextMark, AceRichTextNode } from "./types/rich-text";
