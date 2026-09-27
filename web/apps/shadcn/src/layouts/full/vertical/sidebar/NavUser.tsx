import { Link2, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroupContent, SidebarGroup } from "@/components/ui/sidebar"

export function NavUser() {
    const navItems = [
        {
            title: "Bağlı Hesaplar",
            url: "/settings/connections",
            icon: Link2,
        },
        {
            title: "Profil",
            url: "/settings/profile",
            icon: UserRound,
        },
    ]
    return (
        <SidebarGroup className="mt-auto p-0">
            <SidebarGroupContent>
                <SidebarMenu className=" ">
                    {navItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton size="lg" className="h-full cursor-pointer" render={<Link to={item.url} />}>
                                <div className="flex items-center gap-3 w-full">
                                    <item.icon className="shadow-none size-5 shrink-0" />
                                    <div className="flex flex-col flex-1 text-left text-sm leading-tight hide-menu whitespace-nowrap">
                                        <span className="truncate font-medium">{item.title}</span>
                                    </div>
                                </div>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}
