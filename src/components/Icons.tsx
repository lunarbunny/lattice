import type { ReactNode } from "react";
import type { DeviceType } from "./../lib/types";
import { TEXT_TERTIARY, INTERNET_COLOUR } from "./../lib/colours";

export interface IconProps {
  className?: string;
  strokeWidth?: number;
  size?: number;
}

function Base({
  children,
  className,
  strokeWidth = 1.7,
  size = 24,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/* ---------- device glyphs ---------- */

export const IconCloud = (p: IconProps) => (
  <Base {...p}>
    <path d="M17.5 19a4.5 4.5 0 0 0 .42-8.98 6 6 0 0 0-11.7 1.62A3.5 3.5 0 0 0 6.5 19h11z" />
  </Base>
);

export const IconRouter = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M12 5.6V3m0 0L10.2 4.8M12 3l1.8 1.8M12 18.4V21m0 0 1.8-1.8M12 21l-1.8-1.8M5.6 12H3m0 0 1.8-1.8M3 12l1.8 1.8M18.4 12H21m0 0-1.8-1.8M21 12l-1.8 1.8" />
  </Base>
);

export const IconFirewall = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 6h17v12h-17z" />
    <path d="M3.5 12h17M8.2 6v6M15.8 6v6M12 12v6" />
  </Base>
);

export const IconSwitch = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="8" width="18" height="8.5" rx="1.8" />
    <circle cx="6.6" cy="12.2" r="0.4" fill="currentColor" />
    <circle cx="9.3" cy="12.2" r="0.4" fill="currentColor" />
    <path d="M12.8 10.8h4.7m0 0-1.6-1.6m1.6 1.6-1.6 1.6M17.5 13.8h-4.7m0 0 1.6-1.6m-1.6 1.6 1.6 1.6" />
  </Base>
);

export const IconAP = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.6 11.4a11 11 0 0 1 14.8 0" />
    <path d="M7.4 14.4a7 7 0 0 1 9.2 0" />
    <path d="M10.2 17.2a3 3 0 0 1 3.6 0" />
    <circle cx="12" cy="19.6" r="0.9" fill="currentColor" stroke="none" />
    <path d="M12 7.6V4.4" />
  </Base>
);

export const IconServer = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="3.8" width="16" height="7" rx="1.4" />
    <rect x="4" y="13.2" width="16" height="7" rx="1.4" />
    <circle cx="7.4" cy="7.3" r="0.5" fill="currentColor" />
    <circle cx="7.4" cy="16.7" r="0.5" fill="currentColor" />
    <path d="M12.6 7.3h4.2M12.6 16.7h4.2" />
  </Base>
);

export const IconPatch = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="6" width="18" height="12" rx="1.5" />
    <circle cx="7" cy="10" r="0.8" fill="currentColor" />
    <circle cx="10.3" cy="10" r="0.8" fill="currentColor" />
    <circle cx="13.7" cy="10" r="0.8" fill="currentColor" />
    <circle cx="17" cy="10" r="0.8" fill="currentColor" />
    <circle cx="7" cy="14" r="0.8" fill="currentColor" />
    <circle cx="10.3" cy="14" r="0.8" fill="currentColor" />
    <circle cx="13.7" cy="14" r="0.8" fill="currentColor" />
    <circle cx="17" cy="14" r="0.8" fill="currentColor" />
  </Base>
);

export const IconPower = (p: IconProps) => (
  <Base {...p}>
    <path d="M13 2.5 7.5 13h4L10 21.5l6.5-11h-4L13 2.5z" />
  </Base>
);

export const IconKvm = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="11" rx="1.5" />
    <path d="M7 18h10M9 15v3M15 15v3" />
    <circle cx="12" cy="9.5" r="1" fill="currentColor" stroke="none" />
  </Base>
);

export const IconAccessory = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <path d="M3 9h18M3 14h18M8 4v16M16 4v16" />
  </Base>
);

export const IconSubnet = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 2.9 19.9 7.45v9.1L12 21.1l-7.9-4.55v-9.1z" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </Base>
);

export function TypeIcon({
  type,
  className,
  strokeWidth,
  size,
}: {
  type: DeviceType | "internet" | "subnet" | "no-gateway";
  className?: string;
  strokeWidth?: number;
  size?: number;
}) {
  const props = { className, strokeWidth, size };
  switch (type) {
    case "internet":
      return <IconCloud {...props} />;
    case "no-gateway":
      return <IconSubnet {...props} />;
    case "router":
      return <IconRouter {...props} />;
    case "firewall":
      return <IconFirewall {...props} />;
    case "switch":
      return <IconSwitch {...props} />;
    case "ap":
      return <IconAP {...props} />;
    case "server":
      return <IconServer {...props} />;
    case "patch":
      return <IconPatch {...props} />;
    case "kvm":
      return <IconKvm {...props} />;
    case "power":
      return <IconPower {...props} />;
    case "accessory":
      return <IconAccessory {...props} />;
    case "subnet":
      return <IconSubnet {...props} />;
    default:
      return <IconServer {...props} />;
  }
}

/* ---------- UI glyphs ---------- */

export const IconUpload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 15.5V4m0 0 4.2 4.2M12 4 7.8 8.2" />
    <path d="M4 15.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3.5" />
  </Base>
);

export const IconArrowLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="M19.5 12h-15m0 0 6 6m-6-6 6-6" />
  </Base>
);

export const IconList = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="4" width="17" height="4.2" rx="1" />
    <rect x="3.5" y="10" width="17" height="4.2" rx="1" />
    <rect x="3.5" y="16" width="17" height="4.2" rx="1" />
    <circle cx="6.4" cy="6.1" r="0.45" fill="currentColor" />
    <circle cx="6.4" cy="12.1" r="0.45" fill="currentColor" />
    <circle cx="6.4" cy="18.1" r="0.45" fill="currentColor" />
  </Base>
);

export const IconX = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Base>
);

export const IconZoomIn = (p: IconProps) => (
  <Base {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20.5 20.5-5.4-5.4M10.5 7.8v5.4M7.8 10.5h5.4" />
  </Base>
);

export const IconZoomOut = (p: IconProps) => (
  <Base {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20.5 20.5-5.4-5.4M7.8 10.5h5.4" />
  </Base>
);

export const IconFit = (p: IconProps) => (
  <Base {...p}>
    <path d="M8.5 3.5H5.6a2.1 2.1 0 0 0-2.1 2.1v2.9M15.5 3.5h2.9a2.1 2.1 0 0 1 2.1 2.1v2.9M8.5 20.5H5.6a2.1 2.1 0 0 1-2.1-2.1v-2.9M15.5 20.5h2.9a2.1 2.1 0 0 0 2.1-2.1v-2.9" />
  </Base>
);

export const IconTrash = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 6.8h16M9.3 6.8V4.5h5.4v2.3M6.4 6.8l1 13h9.2l1-13M10 11v5M14 11v5" />
  </Base>
);

export const IconChevronDown = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 9.5 6 6 6-6" />
  </Base>
);

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Base>
);

export const IconAlert = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.6 22 20H2z" />
    <path d="M12 9.8v4.4" />
    <circle cx="12" cy="17" r="0.5" fill="currentColor" />
  </Base>
);

export const IconInfo = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5" />
    <circle cx="12" cy="7.8" r="0.5" fill="currentColor" />
  </Base>
);

export const IconNotes = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </Base>
);

export const IconLocate = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="6.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5" />
  </Base>
);

export const IconEdit = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20h4l10.5-10.5a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5V20z" />
    <path d="m13.5 6.5 3.5 3.5" />
  </Base>
);

export const IconPlus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconCopy = (p: IconProps) => (
  <Base {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Base>
);

export const IconDownload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5" />
    <path d="M4 17v2.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5V17" />
  </Base>
);

export const IconBraces = (p: IconProps) => (
  <Base {...p}>
    <path d="M8.5 4C7 4 6 5 6 6.5v2C6 10 5 11 3.8 11v2C5 13 6 14 6 15.5v2C6 19 7 20 8.5 20M15.5 4c1.5 0 2.5 1 2.5 2.5v2c0 1.5 1 2.5 2.2 2.5v2c-1.2 0-2.2 1-2.2 2.5v2c0 1.5-1 2.5-2.5 2.5" />
  </Base>
);

export const IconSamples = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </Base>
);

export const IconTree = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="4.6" r="2.1" />
    <circle cx="5" cy="18.4" r="2.1" />
    <circle cx="19" cy="18.4" r="2.1" />
    <path d="M12 6.7v3.6m0 0-5.3 5.6M12 10.3l5.3 5.6" />
  </Base>
);

export const IconNetwork = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <path d="M10 6.5h4M6.5 10v4M17.5 10v4M10 17.5h4" />
  </Base>
);

export const IconRack = (p: IconProps) => (
  <Base {...p}>
    <rect x="5.5" y="3" width="13" height="18" rx="1.6" />
    <path d="M5.5 9h13M5.5 15h13" />
    <circle cx="15.4" cy="6" r="0.5" fill="currentColor" />
    <circle cx="15.4" cy="12" r="0.5" fill="currentColor" />
    <circle cx="15.4" cy="18" r="0.5" fill="currentColor" />
  </Base>
);

export const IconLayoutHorizontal = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="5" r="2.2" />
    <circle cx="5.5" cy="18" r="2.2" />
    <circle cx="18.5" cy="18" r="2.2" />
    <path d="M12 7.2v3.3m0 0-6.5 5.3M12 10.5l6.5 5.3" />
  </Base>
);

export const IconLayoutVertical = (p: IconProps) => (
  <Base {...p}>
    <circle cx="5" cy="12" r="2.2" />
    <circle cx="18" cy="5.5" r="2.2" />
    <circle cx="18" cy="18.5" r="2.2" />
    <path d="M7.2 12h3.3m0 0 5.3-6.5M10.5 12l5.3 6.5" />
  </Base>
);

export const IconBezierLine = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" className={className} aria-hidden="true">
    <path d="M4 6C10 6 10 14 16 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const IconOrthogonalLine = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" className={className} aria-hidden="true">
    <path d="M4 6h6v8h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconAlignTop = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" className={className} aria-hidden="true">
    <line x1="3" y1="3" x2="17" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="4" y="5" width="4" height="12" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
    <rect x="10" y="5" width="4" height="8" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

export const IconAlignBottom = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" className={className} aria-hidden="true">
    <line x1="3" y1="17" x2="17" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="4" y="3" width="4" height="12" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
    <rect x="10" y="7" width="4" height="8" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

export const IconFibre = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 9c3-4 5-4 8 0s5 4 8 0" />
    <path d="M3 15c3-4 5-4 8 0s5 4 8 0" />
  </Base>
);

export const IconEthernet = (p: IconProps) => (
  <Base {...p}>
    <rect x="7" y="3" width="10" height="13" rx="1.5" />
    <path d="M10 7v3M14 7v3" />
    <path d="M10 16v5M14 16v5" />
  </Base>
);

/** Brand mark: three linked nodes. */
export const LogoMark = ({ className, size = 24 }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M12 7.4v3.4m0 0-5.6 4.6M12 10.8l5.6 4.6"
      stroke={TEXT_TERTIARY}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="12" cy="5" r="2.9" fill="#2DD4BF" />
    <circle cx="5" cy="18" r="2.9" fill="#F5A524" />
    <circle cx="19" cy="18" r="2.9" fill={INTERNET_COLOUR} />
  </svg>
);
