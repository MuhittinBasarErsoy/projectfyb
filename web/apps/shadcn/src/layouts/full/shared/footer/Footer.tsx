import { Link } from "react-router";

export default function Footer() {
    return (
        <div className="flex md:flex-row flex-col items-center justify-between gap-3 text-center">
            <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} FyBlue · OSOS ve EPİAŞ verileri tek panelde.
            </p>
            <div className="flex gap-4">
                <Link to="/settings/connections" className="text-sm hover:text-primary text-muted-foreground">
                    Bağlı Hesaplar
                </Link>
                <a href="/hangfire" target="_blank" rel="noopener" className="text-sm hover:text-primary text-muted-foreground">
                    Hangfire
                </a>
            </div>
        </div>
    );
}
