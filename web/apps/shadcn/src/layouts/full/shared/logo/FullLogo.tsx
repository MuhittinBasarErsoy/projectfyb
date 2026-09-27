import { Link } from "react-router";
import Logo from "src/assets/images/logos/logoicon.svg";

const FullLogo = () => {
  return (
    <Link to={'/'} className="flex items-center gap-2 overflow-hidden">
      <img src={Logo} alt="" width={32} height={32} className="shrink-0 dark:invert" />
      <span className="hide-menu text-lg font-semibold tracking-tight whitespace-nowrap">FyBlue</span>
    </Link>
  );
};

export default FullLogo;
