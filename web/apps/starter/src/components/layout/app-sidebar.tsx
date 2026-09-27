'use client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from '@/components/ui/sidebar';
import { navGroups } from '@/config/nav-config';
import { isNavActive, switchTemplate, TEMPLATES, useAuth, useConnections } from '@fyblue/core';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { Icons } from '../icons';

function UserBlock({ name, initial }: { name: string; initial: string }) {
  return (
    <>
      <Avatar className='h-8 w-8 rounded-lg'>
        <AvatarFallback className='rounded-lg'>{initial}</AvatarFallback>
      </Avatar>
      <div className='grid flex-1 text-left text-sm leading-tight'>
        <span className='truncate font-semibold'>{name}</span>
        <span className='text-muted-foreground truncate text-xs'>FyBlue hesabı</span>
      </div>
    </>
  );
}

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { username, initial, signOut } = useAuth();
  const connections = useConnections();

  const linked = (label: string) =>
    label === 'OSOS' ? connections.osos?.linked : label === 'EPİAŞ' ? connections.epias?.linked : undefined;

  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader className='group-data-[collapsible=icon]:pt-4'>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' render={<Link href='/' />}>
              <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg'>
                <Icons.logo className='size-4' />
              </div>
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-medium'>FyBlue</span>
                <span className='text-muted-foreground truncate text-xs'>OSOS · EPİAŞ</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className='overflow-x-hidden'>
        {navGroups.map((group) => {
          const isLinked = linked(group.label);
          return (
            <SidebarGroup key={group.label} className='py-0'>
              {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon ? Icons[item.icon] : Icons.logo;
                  const active = isNavActive({ title: item.title, path: item.url, icon: 'home', exact: item.exact }, pathname);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        render={<Link href={item.url} aria-label={item.title} />}
                        tooltip={item.title}
                        isActive={active}
                      >
                        <Icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
              {isLinked === false && (
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton size='sm' render={<Link href='/settings/connections' />} className='text-muted-foreground'>
                      <Icons.plug />
                      <span>Hesap bağlı değil</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge>!</SidebarMenuBadge>
                  </SidebarMenuItem>
                </SidebarMenu>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size='lg'
                    className='data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground'
                  />
                }
              >
                <UserBlock name={username ?? ''} initial={initial} />
                <Icons.chevronsDown className='ml-auto size-4' />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className='w-(--anchor-width) min-w-56 rounded-lg'
                side='bottom'
                align='end'
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className='p-0 font-normal'>
                    <div className='flex items-center gap-2 px-1 py-1.5'>
                      <UserBlock name={username ?? ''} initial={initial} />
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push('/settings/profile')}>
                    <Icons.account className='mr-2 h-4 w-4' />
                    Profil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/settings/connections')}>
                    <Icons.plug className='mr-2 h-4 w-4' />
                    Bağlı Hesaplar
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Icons.palette className='mr-2 h-4 w-4' />
                      Arayüz şablonu
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {TEMPLATES.map((t) => (
                        <DropdownMenuItem
                          key={t.id}
                          onClick={() => t.id !== 'starter' && switchTemplate(t.id, pathname + window.location.search)}
                        >
                          {t.name}
                          {t.id === 'starter' && <Icons.check className='ml-auto size-4' />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={signOut}>
                    <Icons.logout aria-hidden className='mr-2 h-4 w-4' />
                    Çıkış yap
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
