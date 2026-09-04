// Data storage keys (store.tsx)
export const KEY_DEVICES = "lattice.devices.v4";
export const KEY_RACKS = "lattice.racks.v3";
export const KEY_CONNECTIONS = "lattice.connections.v2";
export const KEY_PORT_TEMPLATES = "lattice.portTemplates.v1";

// View settings keys (MainPage.tsx)
export const KEY_VIEW = "lattice.view.v1";
export const KEY_TOPOLOGY_LAYOUT = "lattice.layout.v1";
export const KEY_TOPOLOGY_V_SPACING = "lattice.vSpacing.v1";
export const KEY_TOPOLOGY_H_SPACING = "lattice.hSpacing.v1";
export const KEY_RACK_CABLE_STYLE = "lattice.cableStyle.v1";
export const KEY_RACK_ALIGN = "lattice.rackAlign.v1";
export const KEY_RACK_U_ORDER = "lattice.rackUOrder.v1";
export const KEY_RACK_LABEL_MODE = "lattice.rackLabelMode.v1";

export type ViewMode = "topology" | "network" | "rack";
