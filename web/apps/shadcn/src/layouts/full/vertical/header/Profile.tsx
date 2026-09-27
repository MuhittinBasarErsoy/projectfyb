import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetFooter,
  SheetClose,
} from "src/components/ui/sheet";
import { Avatar, AvatarFallback } from "src/components/ui/avatar";
import { Button } from "src/components/ui/button";
import { cn } from "src/lib/utils";
import { Link2, LogOut, UserRound, X } from 'lucide-react';
import { Link, useLocation } from "react-router";
import { switchTemplate, TEMPLATES, useAuth } from "@fyblue/core";
import { TemplateThumb } from "@/components/fyblue/shell";

const profileDD = [
  { title: "Profil", href: "/settings/profile", icon: UserRound },
  { title: "Bağlı Hesaplar", href: "/settings/connections", icon: Link2 },
];

export default function ProfileSheet() {
  const { username, initial, signOut } = useAuth();
  const { pathname } = useLocation();

  return (
    <Sheet>
      {/* Trigger Button */}
      <SheetTrigger className="cursor-pointer hover:bg-primary/5 flex items-center justify-center rounded-full h-10 w-10">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </SheetTrigger>

      {/* Drawer Panel */}
      <SheetContent
        showCloseButton={false}
        side="right"
        className="border-s-0 w-full sm:max-w-80 max-w-60"
      >
        <SheetClose className="absolute top-5 end-5 p-2 hover:bg-primary/5 hover:text-primary rounded-full">
          <X size={20} />
        </SheetClose>

        {/* Top Profile Section */}
        <div className="p-6 py-6">
          <div className="flex flex-col gap-4 justify-center items-center pt-10">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-xl">{initial}</AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h6 className="text-lg font-semibold">{username}</h6>
              <span className="text-sm font-normal text-muted-foreground">FyBlue hesabı</span>
            </div>
          </div>
        </div>

        {/* Menu List */}
        <div className="border-t  border-border">
          <ul className="flex flex-col gap-2 p-6">
            {profileDD.map((item) => (
              <li key={item.title} className="group">
                <SheetClose
                  render={<Link to={item.href} />}
                  className={cn(
                    "flex gap-3 py-2 px-3 rounded-md group-hover:bg-primary/5 text-muted-foreground"
                  )}
                >
                  <item.icon width={20} height={20} className="group-hover:text-primary" />
                  <h6 className="text-sm group-hover:text-primary">{item.title}</h6>
                </SheetClose>
              </li>
            ))}
          </ul>
        </div>

        {/* Arayüz şablonu */}
        <div className="border-t border-border p-6 flex flex-col gap-3">
          <span className="text-xs uppercase font-semibold text-muted-foreground">Arayüz şablonu</span>
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.description}
                onClick={() => t.id !== "shadcn" && switchTemplate(t.id, pathname)}
                className={cn(
                  "flex flex-col gap-1 border p-1 text-left text-[11px] leading-tight",
                  t.id === "shadcn" ? "border-foreground" : "border-border hover:bg-muted",
                )}
              >
                <TemplateThumb id={t.id} />
                <span className="truncate font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="px-0 pb-6">
          <div className="border-t border-border w-full px-6 pt-6">
            <Button variant="secondary" onClick={signOut} className="w-full text-primary">
              <LogOut /> Çıkış yap
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
