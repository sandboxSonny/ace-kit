import { type RouteConfig, route } from "@react-router/dev/routes";

// One route draws every page: "/" is the home entry and "/{content type}/{entry}" any other.
export default [route("*", "routes/page.tsx")] satisfies RouteConfig;
