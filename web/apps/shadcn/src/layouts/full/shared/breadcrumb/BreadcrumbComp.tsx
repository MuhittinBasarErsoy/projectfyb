import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Fragment, type ReactNode } from "react";
import { Link } from "react-router";

interface BreadcrumbItem {
  to?: string;
  title: string;
}

interface BreadCrumbType {
  subtitle?: ReactNode;
  items?: BreadcrumbItem[];
  title: string;
  module?: "osos" | "epias";
  actions?: ReactNode;
}

const BreadcrumbComp = ({ title, subtitle, items = [], module, actions }: BreadCrumbType) => {
  return (
    <>
      <Card
        className={`py-5 px-6 bg-background  overflow-hidden rounded-xl border`}
      >
        <div className="flex flex-wrap items-start justify-between gap-6 relative">
          <div className="flex flex-col gap-1.5 max-w-3xl">
            <div className="flex items-center gap-2">
              {module && <Badge variant="outline">{module === "osos" ? "OSOS" : "EPİAŞ"}</Badge>}
              <h4 className="font-semibold text-xl text-forground">{title}</h4>
            </div>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex flex-col items-end gap-3">
            <ol
              className="flex items-center whitespace-nowrap"
              aria-label="Breadcrumb"
            >
              <li className="flex items-center">
                <Link className="text-forground text-sm  leading-none" to="/">
                  Ana sayfa
                </Link>
              </li>
              {items.map((item) => (
                <Fragment key={item.title}>
                  <li className="mx-2">
                    <div className="p-0.5 text-forground">/</div>
                  </li>
                  <li className="flex items-center text-sm leading-none">
                    {item.to ? <Link to={item.to}>{item.title}</Link> : item.title}
                  </li>
                </Fragment>
              ))}
              <li className="mx-2">
                <div className="p-0.5 text-forground">/</div>
              </li>
              <li
                className="flex items-center text-sm text-forground leading-none opacity-80"
                aria-current="page"
              >
                {title}
              </li>
            </ol>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        </div>
      </Card>
    </>
  );
};

export default BreadcrumbComp;
