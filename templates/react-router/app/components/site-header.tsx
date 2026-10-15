import { isInternalPath } from "@sandboxsonny/ace-kit";
import type { AceNavigationLink } from "@sandboxsonny/ace-kit";
import { NavLink } from "react-router";

/** One link: a router link for a page of this site (which marks the current page), a plain one for anywhere else. */
function HeaderLink({ link }: { link: AceNavigationLink }) {
  return isInternalPath(link.to) ? (
    <NavLink to={link.to} end>
      {link.label}
    </NavLink>
  ) : (
    <a href={link.to}>{link.label}</a>
  );
}

function SubLinks({ links, deep = false }: { links: AceNavigationLink[]; deep?: boolean }) {
  return (
    <ul className={deep ? "site-header__sublinks site-header__sublinks--deep" : "site-header__sublinks"}>
      {links.map((link) => (
        <li key={`${link.to}|${link.label}`}>
          <HeaderLink link={link} />
          {link.children && link.children.length > 0 ? <SubLinks links={link.children} deep /> : null}
        </li>
      ))}
    </ul>
  );
}

export function SiteHeader({ links }: { links: AceNavigationLink[] }) {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <a href="/" className="site-header__name">
          Example Site
        </a>
        <nav aria-label="Main">
          <ul className="site-header__links">
            {links.map((link) => (
              <li key={`${link.to}|${link.label}`}>
                <HeaderLink link={link} />
                {link.children && link.children.length > 0 ? <SubLinks links={link.children} /> : null}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
