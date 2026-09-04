import type { DeviceType } from "../../lib/types";
import { TYPE_META } from "../../lib/types";
import type { DeviceLinkState } from "../../lib/helpers";
import { TypeIcon } from "../Icons";
import {
  CARD_FILL, CARD_FILL_SELECTED, CARD_FILL_HOVER, CARD_FILL_GATEWAY,
  CARD_STROKE, CARD_STROKE_GATEWAY,
  TEXT_NAME, TEXT_NAME_ACTIVE, TEXT_SUBLABEL, TEXT_TERTIARY,
  DOT_CONNECTED, DOT_NO_LINK,
  GW_EXPLICIT_FILL, GW_EXPLICIT_STROKE, GW_EXPLICIT_TEXT,
  GW_IMPLICIT_FILL, GW_IMPLICIT_STROKE, GW_IMPLICIT_TEXT,
} from "../../lib/colours";
import { fitText, NAME_FONT } from "../../lib/fitText";

interface DeviceCardProps {
  width: number;
  height: number;
  type: DeviceType;
  name: string;
  sublabel: string;
  linkState: DeviceLinkState;
  isSelected: boolean;
  isHover: boolean;
  dimmed?: boolean;
  showGwBadge?: boolean;
  isExplicitGw?: boolean;
  alwaysShowDot?: boolean;
}

export default function DeviceCard({
  width: w, height: h, type, name, sublabel, linkState,
  isSelected, isHover, dimmed, showGwBadge, isExplicitGw, alwaysShowDot,
}: DeviceCardProps) {
  const col = TYPE_META[type].color;
  const showDot = linkState !== "none" || alwaysShowDot;
  const dotFill = linkState === "connected"
    ? DOT_CONNECTED
    : linkState === "unlinked"
      ? DOT_NO_LINK
      : col;

  let cardFill: string;
  let cardStroke: string;
  if (isSelected) {
    cardFill = CARD_FILL_SELECTED;
    cardStroke = col;
  } else if (isHover) {
    cardFill = CARD_FILL_HOVER;
    cardStroke = col;
  } else if (showGwBadge && !isExplicitGw) {
    cardFill = CARD_FILL_GATEWAY;
    cardStroke = CARD_STROKE_GATEWAY;
  } else {
    cardFill = CARD_FILL;
    cardStroke = CARD_STROKE;
  }

  const nameFill = dimmed
    ? TEXT_TERTIARY
    : isSelected || isHover
      ? TEXT_NAME_ACTIVE
      : TEXT_NAME;

  const textBlockH = sublabel ? 28 : 17;
  const textBlockY = (h - textBlockH) / 2;

  return (
    <>
      {isSelected && (
        <rect x={-3} y={-2.5} width={w + 6} height={h + 5} rx={5}
          fill="none" stroke={col} strokeWidth={1.2} className="ants" />
      )}
      <rect width={w} height={h} rx={4}
        fill={cardFill} stroke={cardStroke}
        strokeWidth={isSelected ? 1.5 : showGwBadge && !isExplicitGw ? 1.3 : 1.1} />
      <rect width={3.5} height={h} rx={1.75} fill={col} />
      <g transform={`translate(9 ${(h - 13) / 2})`} color={col}>
        <TypeIcon type={type} size={13} className="h-[13px] w-[13px]" />
      </g>
      <g transform={`translate(0 ${textBlockY})`}>
        <text x={30} y={12.5} fontSize={11.5} fontWeight={600}
          fontFamily="IBM Plex Sans, sans-serif" fill={nameFill}>
          {fitText(name, w - 30 - 18, NAME_FONT)}
        </text>
        {sublabel && (
          <text x={30} y={24.5} fontSize={9.5}
            fontFamily="IBM Plex Mono, monospace" fill={TEXT_SUBLABEL}>
            {sublabel}
          </text>
        )}
      </g>
      {showDot && (
        <circle cx={w - 7.5} cy={h / 2} r={3} fill={dotFill}
          className={isSelected || isHover ? "blink" : undefined} />
      )}
      {showGwBadge && (
        <g transform={`translate(${w - 26} 2)`}>
          <rect width={18} height={11} rx={3}
            fill={isExplicitGw ? GW_EXPLICIT_FILL : GW_IMPLICIT_FILL}
            stroke={isExplicitGw ? GW_EXPLICIT_STROKE : GW_IMPLICIT_STROKE}
            strokeWidth={0.8} />
          <text x={9} y={8.5} textAnchor="middle" fontSize={7} fontWeight={700}
            fontFamily="IBM Plex Mono, monospace"
            fill={isExplicitGw ? GW_EXPLICIT_TEXT : GW_IMPLICIT_TEXT}
            letterSpacing={0.5}>
            GW
          </text>
        </g>
      )}
    </>
  );
}
