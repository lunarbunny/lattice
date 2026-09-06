// Centralized colour palette for all canvas views, device states, and UI elements.

export const Colour = {
  /* Device card states */
  cardFill: "#141F3B",
  cardFillSelected: "#1C2B4D",
  cardFillHover: "#182645",
  cardFillGateway: "#16203E",
  cardStroke: "#263252",
  cardStrokeGateway: "#FBBF2460",

  /* Topology node states */
  nodeFill: "#131F3A",
  nodeFillActive: "#1B2A4B",
  nodeFillNoGw: "#0F172A",

  /* Text fills (SVG-specific) */
  textName: "#C3CEE8",
  textNameActive: "#F2F6FF",
  textSublabel: "#7C8DB5",
  textSublabelHeuristic: "#FBBF24",
  textHeading: "#E7EDF9",
  textTertiary: "#5E6D94",
  textEmptySlot: "#3A4770",
  textLink: "#60A5FA",

  /* Status dots */
  dotConnected: "#4ADE80",
  dotNoLink: "#FBBF24",

  /* Connection mediums */
  cableEthernet: "#3B82F6",
  cableFibre: "#FBBF24",
  cableMixed: "#A78BFA",
  cableHover: "#4ADE80",

  /* Gateway badges */
  gwExplicitFill: "#2DD4BF20",
  gwExplicitStroke: "#2DD4BF50",
  gwExplicitText: "#2DD4BF",
  gwImplicitFill: "#FBBF2420",
  gwImplicitStroke: "#FBBF2450",
  gwImplicitText: "#FBBF24",

  /* Containers / groups */
  containerFill: "#0F1A33",
  containerFillHover: "#142040",
  containerHeaderFill: "#111D3A",
  containerHeaderFillHover: "#172850",
  containerStroke: "#223055",
  containerInnerFill: "#0E1730",
  containerInnerStroke: "#2A3A63",
  separatorLine: "#1B2542",
  dotPattern: "#18233F",

  /* Rack structural */
  railStroke: "#263252",
  railScrew: "#33406A",
  uRowLine: "#161F3A",
  rackFoot: "#17223E",

  /* Cable highway */
  highwayFill: "#1e2a4a",
  highwayStroke: "#3a4a6a",
  highwayLabel: "#5a6a8a",

  /* Topology edges */
  edgeStroke: "#2B3A61",
  edgeFlow: "#3E5386",

  /* Special node overrides */
  internet: "#38BDF8",
  noGateway: "#64748B",

  /* Empty-state illustration */
  illustrationLine: "#2E3C63",
  illustrationNode: "#0E1730",

  /* Drag and drop */
  dragDropTarget: "#22c55e",
  dragSwapStripe: "#eab308",
  dragSource: "#3b82f6",
} as const;
