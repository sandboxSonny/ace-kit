/** One link of a menu as the public API returns it, with its address already worked out. */
export type AceMenuItem = {
  label: string;
  /** A path on this site for a link to an entry, or the address as typed. */
  url: string;
  kind: "entry" | "url";
  /** The entry an entry link goes to; null for a typed address. */
  entry: { id: number; title: string; handle: string; content_type_handle: string } | null;
  children: AceMenuItem[];
};

export type AceMenu = {
  name: string;
  handle: string;
  items: AceMenuItem[];
};

/** One link in a navigation bar, ready to draw. */
export type AceNavigationLink = {
  label: string;
  to: string;
  /** Links shown under this one. */
  children?: AceNavigationLink[];
};
