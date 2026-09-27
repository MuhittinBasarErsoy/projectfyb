import { PlugZap } from 'lucide-react';
import { Link } from 'react-router';
import { useConnections } from '@fyblue/core';

/** Şablondaki "plan" kutusunun yerinde: OSOS / EPİAŞ hesap bağlantı durumu. */
export function NavSecondary() {
    const c = useConnections();
    const linked = [c.osos?.linked, c.epias?.linked].filter(Boolean).length;
    const rows = [
        { label: "OSOS", status: c.osos },
        { label: "EPİAŞ", status: c.epias },
    ];
    return (
        <div className="-mx-4 border-t border-b border-border px-5 py-5">
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-4">
                        {/* Header row */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <PlugZap className="size-5 shrink-0" />
                                <span className="font-medium text-base leading-6 text-foreground">Bağlı hesaplar</span>
                            </div>
                            <span className="font-medium text-base leading-6 text-foreground">{linked}/2</span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                            <div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${linked * 50}%` }} />
                        </div>
                    </div>
                    <ul className="flex flex-col gap-1 text-sm">
                        {rows.map((r) => (
                            <li key={r.label} className="flex items-center justify-between text-muted-foreground">
                                <span>{r.label}</span>
                                <span className={r.status?.linked ? "text-foreground" : ""}>
                                    {!c.loaded ? "…" : r.status?.linked ? r.status.username : "bağlı değil"}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
                {linked < 2 && (
                    <Link to="/settings/connections" className="w-full cursor-pointer h-9 flex items-center justify-center bg-foreground text-background hover:bg-foreground/90 rounded-lg text-sm font-medium">
                        Hesap bağla
                    </Link>
                )}
            </div>
        </div>
    )
}
