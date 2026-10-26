import { type RouteConfig, index, route } from "@react-router/dev/routes";

// One route draws every page: "/" is the home entry and "/{content type}/{entry}" any other. The home page needs its own
// `index` line: a "*" route doesn't match "/", so with only that line the home page would come out empty. The sitemap,
// robots.txt and the contact form's endpoint come first, so the catch-all doesn't answer for them.
export default [
  route("sitemap.xml", "routes/sitemap.ts"),
  route("robots.txt", "routes/robots.ts"),
  route("api/contact", "routes/contact.ts"),
  index("routes/page.tsx", { id: "home" }),
  route("*", "routes/page.tsx", { id: "page" }),
] satisfies RouteConfig;
