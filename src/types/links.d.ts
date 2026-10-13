/**
 * What a link field holds in an entry's values, as visitors get it: where it goes, already worked out (a link to a
 * page of the site is its address, such as "/pages/about"), and the words it is shown with, if the editor gave any.
 */
export type AceLinkData = {
  href: string;
  label?: string;
};
