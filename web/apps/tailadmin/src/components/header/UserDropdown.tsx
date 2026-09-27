import { TemplateThumb } from "@/components/fyblue/shell";
import { useClickOutside } from "@/hooks/useClickOutside";
import { LayoutIcon, LogoutIcon, PlugInIcon, UserCircleIcon } from "@/icons";
import { cn } from "@/utils";
import { switchTemplate, TEMPLATES, useAuth } from "@fyblue/core";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";

const itemClass =
  "group flex items-center gap-3 rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300";
const iconClass = "size-6 fill-gray-500 group-hover:fill-gray-700 dark:fill-gray-400 dark:group-hover:fill-gray-300";

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubDropdownOpen, setIsSubDropdownOpen] = useState(false);
  const subDropdownRef = useRef<HTMLLIElement>(null);
  const { username, initial, signOut } = useAuth();
  const location = useLocation();

  useClickOutside(subDropdownRef, () => {
    setIsSubDropdownOpen(false);
  });

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
    setIsSubDropdownOpen(false);
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setIsSubDropdownOpen(false);
  };

  useEffect(() => {
    return () => {
      setIsOpen(false);
      setIsSubDropdownOpen(false);
    };
  }, []);

  return (
    <div className="relative">
      <button onClick={toggleDropdown} className="dropdown-toggle flex items-center text-gray-700 dark:text-gray-400">
        <span className="me-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-brand-500 text-base font-semibold text-white">
          {initial}
        </span>

        <span className="me-1 block text-theme-sm font-medium">{username}</span>
        <svg
          className={`stroke-gray-500 transition-transform duration-200 dark:stroke-gray-400 ${isOpen ? "rotate-180" : ""}`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M4.3125 8.65625L9 13.3437L13.6875 8.65625" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute inset-e-0 mt-4.25 flex w-65 flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div>
          <span className="block text-theme-sm font-medium text-gray-700 no-underline dark:text-gray-400">{username}</span>
          <span className="mt-0.5 block text-theme-xs text-gray-500 no-underline dark:text-gray-400">FyBlue hesabı</span>
        </div>

        <ul className="flex flex-col gap-1 border-b border-gray-200 pt-4 pb-3 dark:border-gray-800">
          <li>
            <DropdownItem onItemClick={closeDropdown} tag="a" to="/settings/profile" className={itemClass}>
              <UserCircleIcon className={iconClass} />
              Profil
            </DropdownItem>
          </li>
          <li>
            <DropdownItem onItemClick={closeDropdown} tag="a" to="/settings/connections" className={itemClass}>
              <PlugInIcon className={iconClass} />
              Bağlı Hesaplar
            </DropdownItem>
          </li>
          <li className="relative" ref={subDropdownRef}>
            <button
              type="button"
              onClick={() => setIsSubDropdownOpen((prev) => !prev)}
              className={cn(
                "group flex max-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-theme-sm font-medium transition-colors",
                isSubDropdownOpen
                  ? "bg-gray-100 text-gray-900 dark:bg-white/5 dark:text-white"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300",
              )}
            >
              <span className="flex items-center gap-3 text-theme-sm">
                <LayoutIcon className={iconClass} />
                <span>Arayüz şablonu</span>
              </span>
              <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-theme-xs font-medium text-gray-700 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300">
                TailAdmin
              </span>
            </button>

            {isSubDropdownOpen && (
              <div className="absolute -inset-s-2 top-11 w-62.5 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg md:inset-s-auto md:inset-e-[calc(100%+14px)] md:top-0 dark:border-gray-800 dark:bg-gray-dark">
                <ul className="flex flex-col gap-1">
                  {TEMPLATES.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => t.id !== "tailadmin" && switchTemplate(t.id, location.pathname)}
                        className={cn(
                          "flex w-full flex-col gap-1.5 rounded-lg p-2 text-start text-theme-sm transition-colors",
                          t.id === "tailadmin"
                            ? "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400"
                            : "text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5",
                        )}
                      >
                        <TemplateThumb id={t.id} />
                        <span className="font-medium">{t.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        </ul>
        <button
          onClick={() => {
            closeDropdown();
            signOut();
          }}
          className="group mt-3 flex items-center gap-3 rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
        >
          <LogoutIcon className={iconClass} />
          Çıkış yap
        </button>
      </Dropdown>
    </div>
  );
}
