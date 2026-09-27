import { useSidebar } from "@/context/SidebarContext";
import { NavGlyph, Logo } from "@/components/fyblue/shell";
import { isNavActive, NAV, useConnections, type NavGroup } from "@fyblue/core";
import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { HorizontaLDots } from "../icons";
import { cn } from "../utils";

/** Grup başlığındaki bağlantı durumu noktası (OSOS / EPİAŞ). */
function LinkDot({ linked }: { linked: boolean | undefined }) {
  if (linked === undefined) return null;
  return (
    <span
      title={linked ? "Hesap bağlı" : "Hesap bağlı değil"}
      className={cn("ms-auto size-1.5 rounded-full", linked ? "bg-success-500" : "bg-gray-300 dark:bg-gray-700")}
    />
  );
}

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, setIsMobileOpen } = useSidebar();
  const location = useLocation();
  const connections = useConnections();
  const open = isExpanded || isHovered || isMobileOpen;

  // Auto-close sidebar on mobile after route change
  useEffect(() => {
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const linkedFor = (g: NavGroup) =>
    g.id === "osos" ? connections.osos?.linked : g.id === "epias" ? connections.epias?.linked : undefined;

  return (
    <aside
      className={cn(
        "fixed inset-s-0 top-0 z-50 flex h-screen flex-col border-e border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out xl:translate-x-0 xl:rtl:translate-x-0 dark:border-gray-800 dark:bg-gray-900",
        isExpanded || isMobileOpen ? "w-72.5" : isHovered ? "w-72.5" : "w-22.5",
        isMobileOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
      )}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={cn("flex py-8", !isExpanded && !isHovered ? "xl:justify-center" : "justify-start")}>
        <Link to="/">
          <Logo compact={!open} />
        </Link>
      </div>

      <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            {NAV.map((group) => (
              <div key={group.id}>
                <h2
                  className={cn(
                    "mb-4 flex items-center gap-2 text-xs leading-5 text-gray-400 uppercase",
                    !isExpanded && !isHovered ? "xl:justify-center" : "justify-start",
                  )}
                >
                  {open ? (
                    <>
                      {group.title}
                      <LinkDot linked={linkedFor(group)} />
                    </>
                  ) : (
                    <HorizontaLDots className="size-6" />
                  )}
                </h2>
                <ul className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const active = isNavActive(item, location.pathname);
                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          title={item.title}
                          className={cn(
                            "group menu-item",
                            active ? "menu-item-active" : "menu-item-inactive",
                            !isExpanded && !isHovered ? "xl:justify-center" : "xl:justify-start",
                          )}
                        >
                          <span
                            className={cn(
                              "menu-item-icon-size",
                              active ? "menu-item-icon-active" : "menu-item-icon-inactive",
                            )}
                          >
                            <NavGlyph icon={item.icon} className="size-6" />
                          </span>
                          {open && <span className="menu-item-text">{item.title}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
