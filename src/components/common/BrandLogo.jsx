import logoIcon from "@/assets/image/logo/logo-icon.webp";
import logoText from "@/assets/image/logo/logo-text.webp";
import "./BrandLogo.css";

export default function BrandLogo({ variant = "full", tone = "default", className = "" }) {
  return (
    <span className={`service-logo service-logo-${variant} service-logo-${tone} ${className}`} role="img" aria-label="DevLink">
      {variant !== "wordmark" && (
        <img className="service-logo-icon" src={logoIcon} alt="" width={303} height={219} decoding="async" draggable={false} />
      )}
      {variant !== "icon" && (
        <img className="service-logo-wordmark" src={logoText} alt="" width={612} height={126} decoding="async" draggable={false} />
      )}
    </span>
  );
}
