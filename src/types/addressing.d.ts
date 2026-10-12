/** Which entry an address is for: the content type's handle, then the entry's. */
export type AceAddress = {
  contentTypeHandle: string;
  entryHandle: string;
};
