/* ---- types ---- */

import type { CableMedium, Connection, Device, PortTemplate, Rack } from "./types";

export type SampleDevice = Omit<Device, "id" | "source" | "importedAt" | "isGateway">;
export type SampleRack = Omit<Rack, "number"> & { number: string };
export type SampleConnection = Omit<Connection, "id" | "medium"> & { medium?: CableMedium };

export interface SampleFile {
  racks: SampleRack[];
  devices: SampleDevice[];
  connections: SampleConnection[];
  portTemplates?: PortTemplate[];
}

/* ---- randomisation helpers ---- */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function hostIp(subnet: string, hostId: number): string {
  const base = subnet.replace(/\.\d+\/\d+$/, "");
  const prefix = subnet.split("/")[1];
  return `${base}.${hostId}/${prefix}`;
}

/* ---- model / note pools ---- */

const ROUTER_MODELS = [
  "MikroTik CCR2004-16G-2S+",
  "Cisco ISR 4451-X",
  "Juniper MX204",
  "Fortinet FortiGate 600E",
];
const FIREWALL_MODELS = [
  "Palo Alto PA-3260",
  "Fortinet FortiGate 400E",
  "pfSense on Netgate 6100",
  "Cisco Firepower 2110",
];
const CORE_SWITCH_MODELS = [
  "Cisco Catalyst C9300-48P",
  "Arista 7050X3-48YC8",
  "Juniper EX4650-48T",
  "MikroTik CRS504-4XQS",
];
const DIST_SWITCH_MODELS = [
  "Ubiquiti USW-48-PoE",
  "Cisco Catalyst C9200L-48P",
  "Aruba 6200F 48G",
  "Dell N3248TE",
];
const SERVER_MODELS = [
  "Dell PowerEdge R740xd",
  "Dell PowerEdge R640",
  "HPE ProLiant DL380 Gen10",
  "HPE ProLiant DL360 Gen10",
  "Supermicro 5019D-4C",
  "Lenovo ThinkSystem SR650 V2",
];
const NAS_MODELS = [
  "Synology RS3621RPxs",
  "QNAP TS-h1886XU-RP",
  "Synology RS1221+",
];
const NVR_MODELS = [
  "Hanwha XRN-1610",
  "Ubiquiti UNVR Pro",
  "Milestone Husky M50",
];
const PATCH_MODELS = [
  "Panduit 24-port keystone",
  "Leviton 48-port patch panel",
  "APC NetShelter patch panel",
];
const UPS_MODELS = [
  "APC Smart-UPS SRT 3000",
  "Eaton 9PX 3000i",
  "Vertiv Liebert GXT4",
];
const PDU_MODELS = [
  "APC AP8886 3-phase",
  "Eaton ePDU G3",
  "ServerTech PRO4X",
];
const KVM_MODELS = [
  "Raritan Dominion KX III",
  "ATEN KN4164v",
  "Raritan Paragon II",
];
const AP_MODELS = [
  "Ubiquiti U6-Pro",
  "Cisco Catalyst 9120AXI",
  "Aruba AP-635",
  "Ruckus R750",
];
const CAMERA_MODELS = [
  "Hanwha XNV-6080R",
  "Axis P3245-V",
  "Dahua IPC-HDBW2841T",
];
const PHONE_MODELS = [
  "Poly VVX 450",
  "Cisco 8845",
  "Yealink T54W",
];
const PRINTER_MODELS = [
  "HP LaserJet Pro M404dn",
  "Ricoh IM C3000",
  "Brother HL-L6200DW",
];

const ROUTER_NOTES = [
  "Dual-WAN uplink, OSPF area 0.",
  "Primary gateway, BGP peer with ISP.",
  "Edge router, MPLS + broadband failover.",
];
const FIREWALL_NOTES = [
  "IDS/IPS inline, zone-based policy.",
  "Stateful firewall, 10 Gbps throughput.",
  "DMZ + internal segmentation.",
];
const SWITCH_NOTES = [
  "48-port 10G core, L3.",
  "L3 routing, 960 Gbps fabric.",
  "MLAG peer, spanning-tree root.",
  "Distribution switch, PoE+ budget 740 W.",
];
const SERVER_NOTES = [
  "Proxmox hypervisor, 256 GB RAM.",
  "vSphere 8, management VLAN.",
  "KVM host, Ceph OSD.",
  "Docker swarm node, 64 GB RAM.",
  "Database replica, 512 GB NVMe.",
  "CI/CD runner, 128 GB RAM.",
  "Monitoring: Prometheus + Grafana.",
  "Backup target, 48 TB raw.",
  "Log aggregator, 32 TB RAID6.",
  "DNS + DHCP authoritative.",
];

/* ================================================================
   SCENARIO 1 — General Network
   ================================================================ */

function generateGeneral(): SampleFile {
  const racks: SampleRack[] = [
    { id: "ER-1", name: "Comms Closet", number: "1", units: 24 },
    { id: "SR-1", name: "Server Room", number: "1", units: 24 },
    { id: "SR-2", name: "Server Room", number: "2", units: 18 },
    { id: "WR-1", name: "Warehouse", number: "1", units: 12 },
  ];

  const portTemplates: PortTemplate[] = [
    { name: "patch-panel-24", ports: ["P0/1/{1-24}"] },
    { name: "edge-router-4port", ports: ["G0/{1-4}"] },
    { name: "firewall-4nic", ports: ["eth{0-3}"] },
    { name: "catalyst-48", ports: ["G0/1/{1-48}"] },
    { name: "server-4nic", ports: ["eth{0-3}"] },
  ];

  const devices: SampleDevice[] = [
    /* ---- ER-1 ---- */
    { name: "pp-er-1", model: pick(PATCH_MODELS), notes: "Structured cabling, floor 1.", rackId: "ER-1", mountIndex: 1, size: 1, portTemplate: "patch-panel-24" },
    { name: "edge-router-01", model: pick(ROUTER_MODELS), notes: pick(ROUTER_NOTES), rackId: "ER-1", mountIndex: 2, size: 1, portTemplate: "edge-router-4port" },
    { name: "fw-01", model: pick(FIREWALL_MODELS), notes: pick(FIREWALL_NOTES), rackId: "ER-1", mountIndex: 3, size: 2, portTemplate: "firewall-4nic" },
    { name: "core-switch-01", model: pick(CORE_SWITCH_MODELS), notes: pick(SWITCH_NOTES), rackId: "ER-1", mountIndex: 5, size: 2, portTemplate: "catalyst-48" },

    /* ---- SR-1 ---- */
    { name: "pp-sr-1", model: pick(PATCH_MODELS), notes: "Server rack patch panel.", rackId: "SR-1", mountIndex: 1, size: 1, portTemplate: "patch-panel-24" },
    { name: "dist-switch-01", model: pick(DIST_SWITCH_MODELS), notes: pick(SWITCH_NOTES), rackId: "SR-1", mountIndex: 2, size: 1, portTemplate: "catalyst-48" },
    { name: "app-server-01", model: pick(SERVER_MODELS), notes: pick(SERVER_NOTES), rackId: "SR-1", mountIndex: 3, size: 2, portTemplate: "server-4nic" },
    { name: "db-server-01", model: pick(SERVER_MODELS), notes: pick(SERVER_NOTES), rackId: "SR-1", mountIndex: 5, size: 2, portTemplate: "server-4nic" },
    { name: "file-server-01", model: pick(NAS_MODELS), notes: pick(SERVER_NOTES), rackId: "SR-1", mountIndex: 7, size: 4 },
    { name: "kvm-switch-01", model: pick(KVM_MODELS), notes: "32-port digital KVM, remote access.", rackId: "SR-1", mountIndex: 11, size: 1 },
    { name: "ups-sr-01", model: pick(UPS_MODELS), notes: "Online double-conversion, 15 min runtime.", rackId: "SR-1", mountIndex: 12, size: 3 },
    { name: "pdu-sr-01", model: pick(PDU_MODELS), notes: "3-phase PDU, rack A.", rackId: "SR-1", mountIndex: 15, size: 1 },
    { name: "env-monitor-01", model: pick(SERVER_MODELS), notes: "Temperature and humidity sensor hub.", rackId: "SR-1", mountIndex: 16, size: 1 },

    /* ---- SR-2 ---- */
    { name: "pp-sr-2", model: pick(PATCH_MODELS), notes: "Endpoint patch panel.", rackId: "SR-2", mountIndex: 1, size: 1, portTemplate: "patch-panel-24" },
    { name: "access-switch-01", model: pick(DIST_SWITCH_MODELS), notes: "PoE+ access switch, 48-port.", rackId: "SR-2", mountIndex: 2, size: 1, portTemplate: "catalyst-48" },
    { name: "nvr-01", model: pick(NVR_MODELS), notes: "16-channel NVR, 30-day retention.", rackId: "SR-2", mountIndex: 3, size: 2 },
    { name: "cam-server-01", model: pick(SERVER_MODELS), notes: "Video analytics and recording engine.", rackId: "SR-2", mountIndex: 5, size: 1 },
    { name: "pbx-01", model: pick(SERVER_MODELS), notes: "VoIP PBX, 200 extensions.", rackId: "SR-2", mountIndex: 6, size: 1 },
    { name: "ups-sr-02", model: pick(UPS_MODELS), notes: "Line-interactive, 10 min runtime.", rackId: "SR-2", mountIndex: 7, size: 2 },

    /* ---- WR-1 ---- */
    { name: "pp-wr-1", model: pick(PATCH_MODELS), notes: "Warehouse patch panel.", rackId: "WR-1", mountIndex: 1, size: 1, portTemplate: "patch-panel-24" },
    { name: "iot-switch-01", model: pick(DIST_SWITCH_MODELS), notes: "PoE switch for IoT and AP endpoints.", rackId: "WR-1", mountIndex: 2, size: 1, portTemplate: "catalyst-48" },
    { name: "iot-gateway", model: pick(["Ubiquiti UDM-Pro", "MikroTik hEX PoE"]), notes: "Isolated VLAN for IoT and sensors.", rackId: "WR-1", mountIndex: 3, size: 1 },
    { name: "wlc-01", model: pick(SERVER_MODELS), notes: "Wireless LAN controller, 150 AP licence.", rackId: "WR-1", mountIndex: 4, size: 1 },
    { name: "ap-floor-01", model: pick(AP_MODELS), notes: "Warehouse ceiling mount, sector A.", rackId: "WR-1", mountIndex: 5, size: 1 },
    { name: "ap-floor-02", model: pick(AP_MODELS), notes: "Warehouse ceiling mount, sector B.", rackId: "WR-1", mountIndex: 6, size: 1 },

    /* ---- unracked ---- */
    { name: "cam-entrance", model: pick(CAMERA_MODELS), notes: "Entrance camera, PoE, IR night vision.", size: 1 },
    { name: "cam-warehouse", model: pick(CAMERA_MODELS), notes: "Warehouse camera, wide-angle, PoE.", size: 1 },
    { name: "phone-reception", model: pick(PHONE_MODELS), notes: "Front desk VoIP phone.", size: 1 },
    { name: "phone-office-01", model: pick(PHONE_MODELS), notes: "Open-plan office, desk cluster A.", size: 1 },
    { name: "printer-office", model: pick(PRINTER_MODELS), notes: "Shared office MFP, colour laser.", size: 1 },
    { name: "laptop-mgmt", model: "Lenovo ThinkPad X1 Carbon", notes: "Management laptop, out-of-band access.", size: 1 },
  ];

  const connections: SampleConnection[] = [
    /* ======== Within ER-1 ======== */
    { srcDevice: "edge-router-01", dstDevice: "fw-01", srcPort: "G0/1", dstPort: "eth0", srcIp: hostIp("10.10.0.0/24", 2), dstIp: hostIp("10.10.0.0/24", 3), srcIsPrimary: true, dstIsPrimary: true },
    { srcDevice: "edge-router-01", dstDevice: "fw-01", srcPort: "G0/2", dstPort: "eth1", srcIp: hostIp("10.10.0.0/24", 2), dstIp: hostIp("10.10.0.0/24", 4) },
    { srcDevice: "fw-01", dstDevice: "core-switch-01", srcPort: "eth2", dstPort: "G0/1/1", srcIp: hostIp("10.10.0.0/24", 5), dstIp: hostIp("10.10.0.0/24", 1), dstIsPrimary: true },
    { srcDevice: "edge-router-01", dstDevice: "pp-er-1", srcPort: "G0/3", dstPort: "P0/1/1" },
    { srcDevice: "core-switch-01", dstDevice: "pp-er-1", srcPort: "G0/1/40", dstPort: "P0/1/2" },

    /* ======== Within SR-1 ======== */
    /* 4-link LACP bundle */
    { srcDevice: "dist-switch-01", dstDevice: "app-server-01", srcPort: "G0/1/1", dstPort: "eth0", srcIp: hostIp("10.10.1.0/24", 10), dstIp: hostIp("10.10.1.0/24", 20), dstIsPrimary: true },
    { srcDevice: "dist-switch-01", dstDevice: "app-server-01", srcPort: "G0/1/2", dstPort: "eth1", srcIp: hostIp("10.10.1.0/24", 10), dstIp: hostIp("10.10.1.0/24", 21) },
    { srcDevice: "dist-switch-01", dstDevice: "app-server-01", srcPort: "G0/1/3", dstPort: "eth2", srcIp: hostIp("10.10.1.0/24", 10), dstIp: hostIp("10.10.1.0/24", 22) },
    { srcDevice: "dist-switch-01", dstDevice: "app-server-01", srcPort: "G0/1/4", dstPort: "eth3", srcIp: hostIp("10.10.1.0/24", 10), dstIp: hostIp("10.10.1.0/24", 23) },
    { srcDevice: "dist-switch-01", dstDevice: "db-server-01", srcPort: "G0/1/5", dstPort: "eth0", srcIp: hostIp("10.10.1.0/24", 11), dstIp: hostIp("10.10.1.0/24", 24), dstIsPrimary: true },
    { srcDevice: "dist-switch-01", dstDevice: "file-server-01", srcPort: "G0/1/6", dstPort: "eth0", srcIp: hostIp("10.10.1.0/24", 12), dstIp: hostIp("10.10.1.0/24", 25), dstIsPrimary: true },
    { srcDevice: "dist-switch-01", dstDevice: "kvm-switch-01", srcPort: "G0/1/10", dstPort: "eth0", srcIp: hostIp("10.10.1.0/24", 30), dstIp: hostIp("10.10.1.0/24", 31) },
    { srcDevice: "dist-switch-01", dstDevice: "pp-sr-1", srcPort: "G0/1/40", dstPort: "P0/1/1" },

    /* ======== Within SR-2 ======== */
    { srcDevice: "access-switch-01", dstDevice: "nvr-01", srcPort: "G0/1/1", dstPort: "eth0", srcIp: hostIp("10.10.2.0/24", 10), dstIp: hostIp("10.10.2.0/24", 20), dstIsPrimary: true },
    { srcDevice: "access-switch-01", dstDevice: "nvr-01", srcPort: "G0/1/2", dstPort: "eth1", srcIp: hostIp("10.10.2.0/24", 10), dstIp: hostIp("10.10.2.0/24", 21) },
    { srcDevice: "access-switch-01", dstDevice: "cam-entrance", srcPort: "G0/1/20", dstPort: "eth0", srcIp: hostIp("10.10.2.0/24", 30), dstIp: hostIp("10.10.2.0/24", 40) },
    { srcDevice: "access-switch-01", dstDevice: "cam-warehouse", srcPort: "G0/1/21", dstPort: "eth0", srcIp: hostIp("10.10.2.0/24", 31), dstIp: hostIp("10.10.2.0/24", 41) },
    { srcDevice: "access-switch-01", dstDevice: "phone-reception", srcPort: "G0/1/30", dstPort: "eth0", srcIp: hostIp("10.10.2.0/24", 50), dstIp: hostIp("10.10.2.0/24", 60) },
    { srcDevice: "access-switch-01", dstDevice: "phone-office-01", srcPort: "G0/1/31", dstPort: "eth0", srcIp: hostIp("10.10.2.0/24", 51), dstIp: hostIp("10.10.2.0/24", 61) },
    { srcDevice: "access-switch-01", dstDevice: "printer-office", srcPort: "G0/1/40", dstPort: "eth0", srcIp: hostIp("10.10.2.0/24", 70), dstIp: hostIp("10.10.2.0/24", 80) },
    { srcDevice: "access-switch-01", dstDevice: "pp-sr-2", srcPort: "G0/1/44", dstPort: "P0/1/1" },

    /* ======== Within WR-1 ======== */
    { srcDevice: "iot-switch-01", dstDevice: "iot-gateway", srcPort: "G0/1/1", dstPort: "G0/1/1", srcIp: hostIp("10.10.3.0/24", 10), dstIp: hostIp("10.10.3.0/24", 2), dstIsPrimary: true },
    { srcDevice: "iot-switch-01", dstDevice: "wlc-01", srcPort: "G0/1/2", dstPort: "eth0", srcIp: hostIp("10.10.3.0/24", 11), dstIp: hostIp("10.10.3.0/24", 20), dstIsPrimary: true },
    { srcDevice: "wlc-01", dstDevice: "ap-floor-01", srcPort: "eth1", dstPort: "eth0", srcIp: hostIp("10.10.3.0/24", 21), dstIp: hostIp("10.10.3.0/24", 30) },
    { srcDevice: "wlc-01", dstDevice: "ap-floor-02", srcPort: "eth2", dstPort: "eth0", srcIp: hostIp("10.10.3.0/24", 22), dstIp: hostIp("10.10.3.0/24", 31) },
    { srcDevice: "iot-switch-01", dstDevice: "pp-wr-1", srcPort: "G0/1/40", dstPort: "P0/1/1" },
    { srcDevice: "iot-gateway", dstDevice: "pp-wr-1", srcPort: "G0/1/1", dstPort: "P0/1/2" },

    /* ======== Cross-rack: ER-1 → SR-1 (via patch panels) ======== */
    { srcDevice: "pp-er-1", dstDevice: "pp-sr-1", srcPort: "P0/1/20", dstPort: "P0/1/10", medium: "fibre", srcIp: hostIp("10.10.0.0/24", 10), dstIp: hostIp("10.10.1.0/24", 1), dstIsPrimary: true },
    { srcDevice: "pp-er-1", dstDevice: "pp-sr-1", srcPort: "P0/1/21", dstPort: "P0/1/11", medium: "fibre", srcIp: hostIp("10.10.0.0/24", 10), dstIp: hostIp("10.10.1.0/24", 2) },

    /* ======== Cross-rack: ER-1 → SR-2 (via patch panels) ======== */
    { srcDevice: "pp-er-1", dstDevice: "pp-sr-2", srcPort: "P0/1/22", dstPort: "P0/1/10", medium: "fibre", srcIp: hostIp("10.10.0.0/24", 11), dstIp: hostIp("10.10.2.0/24", 1), dstIsPrimary: true },

    /* ======== Cross-rack: ER-1 → WR-1 (via patch panels) ======== */
    { srcDevice: "pp-er-1", dstDevice: "pp-wr-1", srcPort: "P0/1/23", dstPort: "P0/1/10", medium: "fibre", srcIp: hostIp("10.10.0.0/24", 12), dstIp: hostIp("10.10.3.0/24", 1), dstIsPrimary: true },
    { srcDevice: "pp-er-1", dstDevice: "pp-wr-1", srcPort: "P0/1/24", dstPort: "P0/1/11", medium: "fibre", srcIp: hostIp("10.10.0.0/24", 20), dstIp: hostIp("10.10.3.0/24", 2) },
  ];

  return { racks, devices, connections, portTemplates };
}

/* ================================================================
   SCENARIO 2 — Data Centre
   ================================================================ */

function generateDataCentre(): SampleFile {
  const racks: SampleRack[] = [
    { id: "MMR-1", name: "Meet-Me Room", number: "1", units: 42 },
    { id: "MMR-2", name: "Meet-Me Room", number: "2", units: 42 },
    { id: "MMR-3", name: "Meet-Me Room", number: "3", units: 42 },
    { id: "N-01", name: "North Hall", number: "A01", units: 42 },
    { id: "N-02", name: "North Hall", number: "A02", units: 42 },
    { id: "N-03", name: "North Hall", number: "A03", units: 42 },
    { id: "N-04", name: "North Hall", number: "A04", units: 42 },
    { id: "S-01", name: "South Hall", number: "B01", units: 42 },
    { id: "S-02", name: "South Hall", number: "B02", units: 42 },
    { id: "S-03", name: "South Hall", number: "B03", units: 42 },
    { id: "NOC-1", name: "NOC", number: "1", units: 24 },
    { id: "NOC-2", name: "NOC", number: "2", units: 24 },
  ];

  const devices: SampleDevice[] = [];

  const portTemplates: PortTemplate[] = [
    { name: "patch-panel-48", ports: ["P0/1/{1-48}"] },
    { name: "arista-7050x3", ports: ["et-0/0/{1-48}"] },
    { name: "arista-7280r3", ports: ["et-0/0/{0-31}"] },
    { name: "juniper-mx204", ports: ["et-0/{0-1}/{0-3}"] },
    { name: "adva-fsp3000", ports: ["P0/{1-8}"] },
    { name: "catalyst-mgmt", ports: ["G0/1/{1-48}"] },
    { name: "server-2nic", ports: ["eth{0-1}"] },
  ];

  /* ---- MMR-1 ---- */
  devices.push(
    { name: "mmr-patch-01", model: pick(PATCH_MODELS), notes: "MMR-1 core patch panel.", rackId: "MMR-1", mountIndex: 1, size: 1, portTemplate: "patch-panel-48" },
    { name: "demarc-01", model: "ADVA FSP 3000", notes: "Carrier demarcation, primary ISP.", rackId: "MMR-1", mountIndex: 2, size: 2, portTemplate: "adva-fsp3000" },
    { name: "edge-router-01", model: "Juniper MX204", notes: "Edge router, BGP peering, primary.", rackId: "MMR-1", mountIndex: 4, size: 2, portTemplate: "juniper-mx204" },
    { name: "edge-router-02", model: "Juniper MX204", notes: "Edge router, BGP peering, secondary.", rackId: "MMR-1", mountIndex: 6, size: 2, portTemplate: "juniper-mx204" },
  );
  /* ---- MMR-2 ---- */
  devices.push(
    { name: "mmr-patch-02", model: pick(PATCH_MODELS), notes: "MMR-2 patch panel.", rackId: "MMR-2", mountIndex: 1, size: 1, portTemplate: "patch-panel-48" },
    { name: "xconnect-01", model: pick(PATCH_MODELS), notes: "Carrier cross-connect panel.", rackId: "MMR-2", mountIndex: 2, size: 1, portTemplate: "patch-panel-48" },
  );
  /* ---- MMR-3 ---- */
  devices.push(
    { name: "mmr-patch-03", model: pick(PATCH_MODELS), notes: "MMR-3 patch panel.", rackId: "MMR-3", mountIndex: 1, size: 1, portTemplate: "patch-panel-48" },
    { name: "carrier-01", model: "ADVA FSP 3000", notes: "Carrier transport equipment.", rackId: "MMR-3", mountIndex: 2, size: 2, portTemplate: "adva-fsp3000" },
  );

  /* ---- N-01: spine ---- */
  devices.push(
    { name: "n01-patch", model: pick(PATCH_MODELS), notes: "North spine patch panel.", rackId: "N-01", mountIndex: 1, size: 1, portTemplate: "patch-panel-48" },
    { name: "spine-01", model: "Arista 7280R3", notes: "Spine switch, slot 1, 3.2 Tbps.", rackId: "N-01", mountIndex: 2, size: 2, portTemplate: "arista-7280r3" },
    { name: "spine-02", model: "Arista 7280R3", notes: "Spine switch, slot 2, 3.2 Tbps.", rackId: "N-01", mountIndex: 4, size: 2, portTemplate: "arista-7280r3" },
  );

  /* ---- N-02..N-04: leaf + compute ---- */
  const northLeafRacks = ["N-02", "N-03", "N-04"];
  for (let r = 0; r < 3; r++) {
    const rackId = northLeafRacks[r];
    const p = r + 1;
    devices.push(
      { name: `${rackId.toLowerCase()}-patch`, model: pick(PATCH_MODELS), notes: `${rackId} patch panel.`, rackId, mountIndex: 1, size: 1, portTemplate: "patch-panel-48" },
      { name: `leaf-n${String(p).padStart(2, "0")}a`, model: "Arista 7050X3-48YC8", notes: `Leaf, North pair ${p}A.`, rackId, mountIndex: 2, size: 2, portTemplate: "arista-7050x3" },
      { name: `leaf-n${String(p).padStart(2, "0")}b`, model: "Arista 7050X3-48YC8", notes: `Leaf, North pair ${p}B.`, rackId, mountIndex: 4, size: 2, portTemplate: "arista-7050x3" },
    );
    for (let s = 0; s < 4; s++) {
      devices.push({ name: `compute-n${String(r * 4 + s + 1).padStart(2, "0")}`, model: pick(SERVER_MODELS), notes: pick(SERVER_NOTES), rackId, mountIndex: 6 + s * 2, size: 2, portTemplate: "server-2nic" });
    }
  }

  /* ---- S-01: spine ---- */
  devices.push(
    { name: "s01-patch", model: pick(PATCH_MODELS), notes: "South spine patch panel.", rackId: "S-01", mountIndex: 1, size: 1, portTemplate: "patch-panel-48" },
    { name: "spine-03", model: "Arista 7280R3", notes: "Spine switch, slot 3.", rackId: "S-01", mountIndex: 2, size: 2, portTemplate: "arista-7280r3" },
    { name: "spine-04", model: "Arista 7280R3", notes: "Spine switch, slot 4.", rackId: "S-01", mountIndex: 4, size: 2, portTemplate: "arista-7280r3" },
  );

  /* ---- S-02..S-03: leaf + compute ---- */
  const southLeafRacks = ["S-02", "S-03"];
  for (let r = 0; r < 2; r++) {
    const rackId = southLeafRacks[r];
    const p = r + 1;
    devices.push(
      { name: `${rackId.toLowerCase()}-patch`, model: pick(PATCH_MODELS), notes: `${rackId} patch panel.`, rackId, mountIndex: 1, size: 1, portTemplate: "patch-panel-48" },
      { name: `leaf-s${String(p).padStart(2, "0")}a`, model: "Arista 7050X3-48YC8", notes: `Leaf, South pair ${p}A.`, rackId, mountIndex: 2, size: 2, portTemplate: "arista-7050x3" },
      { name: `leaf-s${String(p).padStart(2, "0")}b`, model: "Arista 7050X3-48YC8", notes: `Leaf, South pair ${p}B.`, rackId, mountIndex: 4, size: 2, portTemplate: "arista-7050x3" },
    );
    for (let s = 0; s < 4; s++) {
      devices.push({ name: `compute-s${String(r * 4 + s + 1).padStart(2, "0")}`, model: pick(SERVER_MODELS), notes: pick(SERVER_NOTES), rackId, mountIndex: 6 + s * 2, size: 2, portTemplate: "server-2nic" });
    }
  }
  /* GPU nodes in S-03 */
  for (let i = 0; i < 3; i++) {
    devices.push({ name: `gpu-s${String(i + 1).padStart(2, "0")}`, model: "NVIDIA DGX A100", notes: "GPU compute, 4× A100 80 GB.", rackId: "S-03", mountIndex: 16 + i * 4, size: 4, portTemplate: "server-2nic" });
  }

  /* ---- NOC-1 ---- */
  devices.push(
    { name: "noc-patch-01", model: pick(PATCH_MODELS), notes: "NOC-1 patch panel.", rackId: "NOC-1", mountIndex: 1, size: 1, portTemplate: "patch-panel-48" },
    { name: "mgmt-switch-01", model: pick(CORE_SWITCH_MODELS), notes: "Out-of-band management switch.", rackId: "NOC-1", mountIndex: 2, size: 2, portTemplate: "catalyst-mgmt" },
    { name: "monitor-01", model: pick(SERVER_MODELS), notes: "Monitoring: Prometheus + Grafana.", rackId: "NOC-1", mountIndex: 4, size: 2, portTemplate: "server-2nic" },
    { name: "log-collector-01", model: pick(SERVER_MODELS), notes: "Centralised log aggregator.", rackId: "NOC-1", mountIndex: 6, size: 2, portTemplate: "server-2nic" },
    { name: "kvm-noc-01", model: pick(KVM_MODELS), notes: "NOC KVM, remote console access.", rackId: "NOC-1", mountIndex: 8, size: 1 },
    { name: "ups-noc-01", model: pick(UPS_MODELS), notes: "NOC UPS, 30 min runtime.", rackId: "NOC-1", mountIndex: 9, size: 4 },
  );

  /* ---- NOC-2 ---- */
  devices.push(
    { name: "noc2-patch", model: pick(PATCH_MODELS), notes: "NOC-2 patch panel.", rackId: "NOC-2", mountIndex: 1, size: 1, portTemplate: "patch-panel-48" },
    { name: "storage-primary", model: pick(NAS_MODELS), notes: "Primary storage array, 200 TB raw.", rackId: "NOC-2", mountIndex: 2, size: 4, portTemplate: "server-2nic" },
    { name: "storage-replica", model: pick(NAS_MODELS), notes: "Replica storage array, 200 TB raw.", rackId: "NOC-2", mountIndex: 6, size: 4, portTemplate: "server-2nic" },
    { name: "backup-01", model: pick(SERVER_MODELS), notes: "Backup target, 48 TB RAID6.", rackId: "NOC-2", mountIndex: 10, size: 2, portTemplate: "server-2nic" },
    { name: "storage-leaf-01", model: "Arista 7050X3-48YC8", notes: "Leaf for storage network.", rackId: "NOC-2", mountIndex: 12, size: 2, portTemplate: "arista-7050x3" },
  );

  /* ---- connections ---- */
  const connections: SampleConnection[] = [];
  let ci = 0;
  const coreHosts = shuffle([2, 3, 5, 10, 11, 13, 14, 20, 30, 31, 40, 50, 60, 70]);
  const nextCore = () => coreHosts[ci++ % coreHosts.length];
  let li = 0;
  const leafHosts = shuffle([1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 20, 21, 22, 23, 24, 30, 31, 32, 33, 34]);
  const nextLeaf = () => leafHosts[li++ % leafHosts.length];

  /* Within MMR-1 */
  connections.push(
    { srcDevice: "demarc-01", dstDevice: "edge-router-01", srcPort: "P0/1", dstPort: "et-0/0/0", medium: "fibre", srcIsPrimary: true, dstIsPrimary: true },
    { srcDevice: "demarc-01", dstDevice: "edge-router-02", srcPort: "P0/2", dstPort: "et-0/0/0", medium: "fibre", dstIsPrimary: true },
    { srcDevice: "edge-router-01", dstDevice: "mmr-patch-01", srcPort: "et-0/1/0", dstPort: "P0/1/1" },
    { srcDevice: "edge-router-02", dstDevice: "mmr-patch-01", srcPort: "et-0/1/0", dstPort: "P0/1/2" },
  );

  /* Cross-rack: MMR-1 → N-01 */
  const northSpines = ["spine-01", "spine-02"];
  for (const sp of northSpines) {
    connections.push({ srcDevice: "mmr-patch-01", dstDevice: "n01-patch", srcPort: `P0/1/${randInt(10, 14)}`, dstPort: `P0/1/${randInt(1, 4)}`, medium: "fibre", srcIp: hostIp("10.0.0.0/24", nextCore()), dstIp: hostIp("10.0.0.0/24", nextCore()), dstIsPrimary: true });
  }
  for (const sp of northSpines) {
    connections.push({ srcDevice: sp, dstDevice: "n01-patch", srcPort: `et-0/0/${randInt(1, 4)}`, dstPort: `P0/1/${randInt(10, 14)}` });
  }

  /* Cross-rack: MMR-1 → S-01 */
  const southSpines = ["spine-03", "spine-04"];
  for (const sp of southSpines) {
    connections.push({ srcDevice: "mmr-patch-01", dstDevice: "s01-patch", srcPort: `P0/1/${randInt(15, 18)}`, dstPort: `P0/1/${randInt(1, 4)}`, medium: "fibre", srcIp: hostIp("10.0.0.0/24", nextCore()), dstIp: hostIp("10.0.0.0/24", nextCore()), dstIsPrimary: true });
  }
  for (const sp of southSpines) {
    connections.push({ srcDevice: sp, dstDevice: "s01-patch", srcPort: `et-0/0/${randInt(1, 4)}`, dstPort: `P0/1/${randInt(10, 14)}` });
  }

  /* Cross-rack: N-01 → N-02/N-03/N-04 */
  for (let r = 0; r < 3; r++) {
    const rackId = northLeafRacks[r];
    const p = r + 1;
    const leafA = `leaf-n${String(p).padStart(2, "0")}a`;
    const leafB = `leaf-n${String(p).padStart(2, "0")}b`;
    const remotePatch = `${rackId.toLowerCase()}-patch`;
    for (const _sp of northSpines) {
      connections.push({ srcDevice: "n01-patch", dstDevice: remotePatch, srcPort: `P0/1/${randInt(20, 30)}`, dstPort: `P0/1/${randInt(1, 4)}`, medium: "fibre", srcIp: hostIp("10.0.0.0/24", nextCore()), dstIp: hostIp("10.0.1.0/24", nextLeaf()) });
    }
    connections.push(
      { srcDevice: leafA, dstDevice: remotePatch, srcPort: `et-0/0/${randInt(40, 44)}`, dstPort: `P0/1/${randInt(10, 14)}` },
      { srcDevice: leafB, dstDevice: remotePatch, srcPort: `et-0/0/${randInt(40, 44)}`, dstPort: `P0/1/${randInt(10, 14)}` },
    );
  }

  /* Cross-rack: S-01 → S-02/S-03 */
  for (let r = 0; r < 2; r++) {
    const rackId = southLeafRacks[r];
    const p = r + 1;
    const leafA = `leaf-s${String(p).padStart(2, "0")}a`;
    const leafB = `leaf-s${String(p).padStart(2, "0")}b`;
    const remotePatch = `${rackId.toLowerCase()}-patch`;
    for (const _sp of southSpines) {
      connections.push({ srcDevice: "s01-patch", dstDevice: remotePatch, srcPort: `P0/1/${randInt(20, 30)}`, dstPort: `P0/1/${randInt(1, 4)}`, medium: "fibre", srcIp: hostIp("10.0.0.0/24", nextCore()), dstIp: hostIp("10.0.1.0/24", nextLeaf()) });
    }
    connections.push(
      { srcDevice: leafA, dstDevice: remotePatch, srcPort: `et-0/0/${randInt(40, 44)}`, dstPort: `P0/1/${randInt(10, 14)}` },
      { srcDevice: leafB, dstDevice: remotePatch, srcPort: `et-0/0/${randInt(40, 44)}`, dstPort: `P0/1/${randInt(10, 14)}` },
    );
  }

  /* Within leaf racks: leaf → compute */
  for (let r = 0; r < 3; r++) {
    const p = r + 1;
    const leafA = `leaf-n${String(p).padStart(2, "0")}a`;
    const leafB = `leaf-n${String(p).padStart(2, "0")}b`;
    for (let s = 0; s < 4; s++) {
      const srv = `compute-n${String(r * 4 + s + 1).padStart(2, "0")}`;
      connections.push(
        { srcDevice: leafA, dstDevice: srv, srcPort: `et-0/0/${randInt(1, 20)}`, dstPort: "eth0", srcIp: hostIp("10.0.1.0/24", nextLeaf()), dstIp: hostIp("10.0.1.0/24", nextLeaf()), dstIsPrimary: true },
        { srcDevice: leafB, dstDevice: srv, srcPort: `et-0/0/${randInt(1, 20)}`, dstPort: "eth1", srcIp: hostIp("10.0.1.0/24", nextLeaf()), dstIp: hostIp("10.0.1.0/24", nextLeaf()) },
      );
    }
  }
  for (let r = 0; r < 2; r++) {
    const p = r + 1;
    const leafA = `leaf-s${String(p).padStart(2, "0")}a`;
    const leafB = `leaf-s${String(p).padStart(2, "0")}b`;
    for (let s = 0; s < 4; s++) {
      const srv = `compute-s${String(r * 4 + s + 1).padStart(2, "0")}`;
      connections.push(
        { srcDevice: leafA, dstDevice: srv, srcPort: `et-0/0/${randInt(1, 20)}`, dstPort: "eth0", srcIp: hostIp("10.0.1.0/24", nextLeaf()), dstIp: hostIp("10.0.1.0/24", nextLeaf()), dstIsPrimary: true },
        { srcDevice: leafB, dstDevice: srv, srcPort: `et-0/0/${randInt(1, 20)}`, dstPort: "eth1", srcIp: hostIp("10.0.1.0/24", nextLeaf()), dstIp: hostIp("10.0.1.0/24", nextLeaf()) },
      );
    }
  }
  /* GPU → leaf (within S-03) */
  for (let i = 1; i <= 3; i++) {
    connections.push(
      { srcDevice: "leaf-s02a", dstDevice: `gpu-s${String(i).padStart(2, "0")}`, srcPort: `et-0/0/${randInt(1, 10)}`, dstPort: "eth0", medium: "fibre", srcIp: hostIp("10.0.1.0/24", nextLeaf()), dstIp: hostIp("10.0.1.0/24", nextLeaf()), dstIsPrimary: true },
      { srcDevice: "leaf-s02b", dstDevice: `gpu-s${String(i).padStart(2, "0")}`, srcPort: `et-0/0/${randInt(1, 10)}`, dstPort: "eth1", medium: "fibre" },
    );
  }

  /* Cross-rack: NOC-2 → S-01 */
  connections.push(
    { srcDevice: "storage-leaf-01", dstDevice: "noc2-patch", srcPort: "et-0/0/40", dstPort: "P0/1/1" },
    { srcDevice: "noc2-patch", dstDevice: "s01-patch", srcPort: "P0/1/20", dstPort: "P0/1/30", medium: "fibre", srcIp: hostIp("10.0.2.0/24", 30), dstIp: hostIp("10.0.0.0/24", nextCore()) },
  );

  /* Cross-rack: NOC-1 → N-01 */
  connections.push(
    { srcDevice: "mgmt-switch-01", dstDevice: "noc-patch-01", srcPort: "G0/1/48", dstPort: "P0/1/1" },
    { srcDevice: "noc-patch-01", dstDevice: "n01-patch", srcPort: "P0/1/20", dstPort: "P0/1/30", medium: "fibre", srcIp: hostIp("10.0.3.0/24", 30), dstIp: hostIp("10.0.0.0/24", nextCore()) },
  );

  /* Within NOC-2: storage */
  connections.push(
    { srcDevice: "storage-leaf-01", dstDevice: "storage-primary", srcPort: "et-0/0/1", dstPort: "eth0", medium: "fibre", srcIp: hostIp("10.0.2.0/24", 1), dstIp: hostIp("10.0.2.0/24", 10), dstIsPrimary: true },
    { srcDevice: "storage-leaf-01", dstDevice: "storage-primary", srcPort: "et-0/0/2", dstPort: "eth1", medium: "fibre" },
    { srcDevice: "storage-leaf-01", dstDevice: "storage-replica", srcPort: "et-0/0/3", dstPort: "eth0", medium: "fibre", srcIp: hostIp("10.0.2.0/24", 2), dstIp: hostIp("10.0.2.0/24", 11), dstIsPrimary: true },
    { srcDevice: "storage-leaf-01", dstDevice: "storage-replica", srcPort: "et-0/0/4", dstPort: "eth1", medium: "fibre" },
    { srcDevice: "storage-leaf-01", dstDevice: "backup-01", srcPort: "et-0/0/5", dstPort: "eth0", srcIp: hostIp("10.0.2.0/24", 3), dstIp: hostIp("10.0.2.0/24", 20) },
  );

  /* Within NOC-1: mgmt */
  connections.push(
    { srcDevice: "mgmt-switch-01", dstDevice: "monitor-01", srcPort: "G0/1/1", dstPort: "eth0", srcIp: hostIp("10.0.3.0/24", 1), dstIp: hostIp("10.0.3.0/24", 10) },
    { srcDevice: "mgmt-switch-01", dstDevice: "log-collector-01", srcPort: "G0/1/2", dstPort: "eth0", srcIp: hostIp("10.0.3.0/24", 2), dstIp: hostIp("10.0.3.0/24", 11) },
    { srcDevice: "mgmt-switch-01", dstDevice: "kvm-noc-01", srcPort: "G0/1/3", dstPort: "eth0", srcIp: hostIp("10.0.3.0/24", 3), dstIp: hostIp("10.0.3.0/24", 12) },
  );

  /* MMR backbone cross-connects */
  connections.push(
    { srcDevice: "mmr-patch-01", dstDevice: "mmr-patch-02", srcPort: "P0/1/40", dstPort: "P0/1/1", medium: "fibre" },
    { srcDevice: "mmr-patch-01", dstDevice: "mmr-patch-03", srcPort: "P0/1/41", dstPort: "P0/1/1", medium: "fibre" },
    { srcDevice: "xconnect-01", dstDevice: "mmr-patch-02", srcPort: "P0/1/1", dstPort: "P0/1/10", medium: "fibre" },
  );

  return { racks, devices, connections, portTemplates };
}

/* ================================================================
   SCENARIO 3 — Cabling & Connections
   ================================================================ */

function generateCabling(): SampleFile {
  const racks: SampleRack[] = [
    { id: "CORE-1", name: "Core", number: "1", units: 24 },
    { id: "AGG-1", name: "Distribution", number: "1", units: 24 },
    { id: "ACC-1", name: "Access", number: "1", units: 18 },
  ];

  const portTemplates: PortTemplate[] = [
    { name: "patch-panel-48", ports: ["P0/1/{1-48}"] },
    { name: "isr-4451", ports: ["Gig0/0/{0-1}", "Ten0/1/{0-1}", "Ten0/2/0"] },
    { name: "pa-3260", ports: ["eth{0-5}"] },
    { name: "arista-7050x3", ports: ["et-0/0/{1-48}"] },
    { name: "catalyst-c9300", ports: ["Ten0/0/{1-48}"] },
    { name: "access-switch-48", ports: ["G0/1/{1-48}"] },
    { name: "server-2nic", ports: ["eth{0-1}"] },
  ];

  const devices: SampleDevice[] = [
    /* ---- CORE-1 ---- */
    { name: "pp-core", model: pick(PATCH_MODELS), notes: "Core patch panel, 48-port.", rackId: "CORE-1", mountIndex: 1, size: 1, portTemplate: "patch-panel-48" },
    { name: "router-a", model: "Cisco ISR 4451-X", notes: "Core router A, active.", rackId: "CORE-1", mountIndex: 2, size: 2, portTemplate: "isr-4451" },
    { name: "router-b", model: "Cisco ISR 4451-X", notes: "Core router B, standby.", rackId: "CORE-1", mountIndex: 4, size: 2, portTemplate: "isr-4451" },
    { name: "fw-primary", model: "Palo Alto PA-3260", notes: "Firewall, active.", rackId: "CORE-1", mountIndex: 6, size: 2, portTemplate: "pa-3260" },
    { name: "fw-secondary", model: "Palo Alto PA-3260", notes: "Firewall, passive HA.", rackId: "CORE-1", mountIndex: 8, size: 2, portTemplate: "pa-3260" },
    { name: "core-sw-a", model: "Arista 7050X3-48YC8", notes: "Core switch A, 48×100G.", rackId: "CORE-1", mountIndex: 10, size: 2, portTemplate: "arista-7050x3" },
    { name: "core-sw-b", model: "Arista 7050X3-48YC8", notes: "Core switch B, 48×100G.", rackId: "CORE-1", mountIndex: 12, size: 2, portTemplate: "arista-7050x3" },
    { name: "ups-core", model: pick(UPS_MODELS), notes: "Core UPS, 30 min runtime.", rackId: "CORE-1", mountIndex: 14, size: 3 },

    /* ---- AGG-1 ---- */
    { name: "pp-agg", model: pick(PATCH_MODELS), notes: "Distribution patch panel.", rackId: "AGG-1", mountIndex: 1, size: 1, portTemplate: "patch-panel-48" },
    { name: "dist-sw-a", model: "Cisco Catalyst C9300-48P", notes: "Distribution switch A.", rackId: "AGG-1", mountIndex: 2, size: 2, portTemplate: "catalyst-c9300" },
    { name: "dist-sw-b", model: "Cisco Catalyst C9300-48P", notes: "Distribution switch B.", rackId: "AGG-1", mountIndex: 4, size: 2, portTemplate: "catalyst-c9300" },
    { name: "ups-agg", model: pick(UPS_MODELS), notes: "Distribution UPS.", rackId: "AGG-1", mountIndex: 6, size: 2 },

    /* ---- ACC-1 ---- */
    { name: "pp-acc", model: pick(PATCH_MODELS), notes: "Access patch panel.", rackId: "ACC-1", mountIndex: 1, size: 1, portTemplate: "patch-panel-48" },
    { name: "access-sw-a", model: pick(DIST_SWITCH_MODELS), notes: "Access switch A, PoE+.", rackId: "ACC-1", mountIndex: 2, size: 2, portTemplate: "access-switch-48" },
    { name: "access-sw-b", model: pick(DIST_SWITCH_MODELS), notes: "Access switch B, PoE+.", rackId: "ACC-1", mountIndex: 4, size: 2, portTemplate: "access-switch-48" },
    { name: "server-alpha", model: pick(SERVER_MODELS), notes: "Dual-homed app server.", rackId: "ACC-1", mountIndex: 6, size: 2, portTemplate: "server-2nic" },
    { name: "server-beta", model: pick(SERVER_MODELS), notes: "Dual-homed DB server.", rackId: "ACC-1", mountIndex: 8, size: 2, portTemplate: "server-2nic" },
    { name: "server-gamma", model: pick(SERVER_MODELS), notes: "Single-homed file server.", rackId: "ACC-1", mountIndex: 10, size: 2, portTemplate: "server-2nic" },
    { name: "nas-01", model: pick(NAS_MODELS), notes: "NAS, dual 10G uplink.", rackId: "ACC-1", mountIndex: 12, size: 2, portTemplate: "server-2nic" },
    { name: "ap-01", model: pick(AP_MODELS), notes: "Wi-Fi 6E AP, multi-link.", rackId: "ACC-1", mountIndex: 14, size: 1, portTemplate: "server-2nic" },

    /* ---- unracked ---- */
    { name: "ip-phone-01", model: pick(PHONE_MODELS), notes: "VoIP phone, primary.", size: 1, portTemplate: "server-2nic" },
    { name: "ip-phone-02", model: pick(PHONE_MODELS), notes: "VoIP phone, daisy-chained via phone 01.", size: 1, portTemplate: "server-2nic" },
    { name: "printer-01", model: pick(PRINTER_MODELS), notes: "Shared colour laser.", size: 1 },
    { name: "cam-01", model: pick(CAMERA_MODELS), notes: "PoE IP camera, entrance.", size: 1 },
  ];

  const connections: SampleConnection[] = [
    /* ======== Within CORE-1 ======== */
    { srcDevice: "router-a", dstDevice: "router-b", srcPort: "Gig0/0/0", dstPort: "Gig0/0/0", srcIp: hostIp("10.0.0.0/24", 2), dstIp: hostIp("10.0.0.0/24", 3), srcIsPrimary: true, dstIsPrimary: true },
    { srcDevice: "router-a", dstDevice: "router-b", srcPort: "Gig0/0/1", dstPort: "Gig0/0/1", srcIp: hostIp("10.0.0.0/24", 2), dstIp: hostIp("10.0.0.0/24", 3) },
    { srcDevice: "router-a", dstDevice: "router-b", srcPort: "Ten0/2/0", dstPort: "Ten0/2/0", medium: "fibre", srcIp: hostIp("172.16.0.0/30", 1), dstIp: hostIp("172.16.0.0/30", 2) },
    { srcDevice: "router-a", dstDevice: "fw-primary", srcPort: "Ten0/1/0", dstPort: "eth0", medium: "fibre", srcIp: hostIp("10.0.0.0/24", 10), dstIp: hostIp("10.0.0.0/24", 20), dstIsPrimary: true },
    { srcDevice: "router-b", dstDevice: "fw-secondary", srcPort: "Ten0/1/0", dstPort: "eth0", medium: "fibre", srcIp: hostIp("10.0.0.0/24", 11), dstIp: hostIp("10.0.0.0/24", 21), dstIsPrimary: true },
    { srcDevice: "router-a", dstDevice: "fw-secondary", srcPort: "Ten0/1/1", dstPort: "eth1", medium: "fibre" },
    { srcDevice: "router-b", dstDevice: "fw-primary", srcPort: "Ten0/1/1", dstPort: "eth1", medium: "fibre" },
    { srcDevice: "fw-primary", dstDevice: "core-sw-a", srcPort: "eth2", dstPort: "et-0/0/1", srcIp: hostIp("10.0.0.0/24", 30), dstIp: hostIp("10.0.0.0/24", 40), dstIsPrimary: true },
    { srcDevice: "fw-primary", dstDevice: "core-sw-a", srcPort: "eth3", dstPort: "et-0/0/2", srcIp: hostIp("10.0.0.0/24", 30), dstIp: hostIp("10.0.0.0/24", 41) },
    { srcDevice: "fw-primary", dstDevice: "core-sw-b", srcPort: "eth4", dstPort: "et-0/0/1", srcIp: hostIp("10.0.0.0/24", 31), dstIp: hostIp("10.0.0.0/24", 50) },
    { srcDevice: "fw-secondary", dstDevice: "core-sw-b", srcPort: "eth2", dstPort: "et-0/0/2", srcIp: hostIp("10.0.0.0/24", 32), dstIp: hostIp("10.0.0.0/24", 51), dstIsPrimary: true },
    { srcDevice: "fw-secondary", dstDevice: "core-sw-a", srcPort: "eth3", dstPort: "et-0/0/3" },
    { srcDevice: "core-sw-a", dstDevice: "pp-core", srcPort: "et-0/0/40", dstPort: "P0/1/1" },
    { srcDevice: "core-sw-b", dstDevice: "pp-core", srcPort: "et-0/0/40", dstPort: "P0/1/2" },

    /* ======== Cross-rack: CORE-1 → AGG-1 ======== */
    { srcDevice: "pp-core", dstDevice: "pp-agg", srcPort: "P0/1/20", dstPort: "P0/1/1", medium: "fibre" },
    { srcDevice: "pp-core", dstDevice: "pp-agg", srcPort: "P0/1/21", dstPort: "P0/1/2", medium: "fibre" },
    { srcDevice: "pp-core", dstDevice: "pp-agg", srcPort: "P0/1/22", dstPort: "P0/1/3", medium: "fibre" },
    { srcDevice: "pp-core", dstDevice: "pp-agg", srcPort: "P0/1/23", dstPort: "P0/1/4", medium: "fibre" },
    { srcDevice: "pp-agg", dstDevice: "dist-sw-a", srcPort: "P0/1/10", dstPort: "Ten0/0/1", srcIp: hostIp("10.0.1.0/24", 1), dstIp: hostIp("10.0.1.0/24", 10), dstIsPrimary: true },
    { srcDevice: "pp-agg", dstDevice: "dist-sw-a", srcPort: "P0/1/11", dstPort: "Ten0/0/2", srcIp: hostIp("10.0.1.0/24", 1), dstIp: hostIp("10.0.1.0/24", 11) },
    { srcDevice: "pp-agg", dstDevice: "dist-sw-b", srcPort: "P0/1/12", dstPort: "Ten0/0/1", srcIp: hostIp("10.0.1.0/24", 2), dstIp: hostIp("10.0.1.0/24", 20), dstIsPrimary: true },
    { srcDevice: "pp-agg", dstDevice: "dist-sw-b", srcPort: "P0/1/13", dstPort: "Ten0/0/2", srcIp: hostIp("10.0.1.0/24", 2), dstIp: hostIp("10.0.1.0/24", 21) },
    { srcDevice: "dist-sw-a", dstDevice: "pp-agg", srcPort: "Ten0/0/48", dstPort: "P0/1/30" },
    { srcDevice: "dist-sw-b", dstDevice: "pp-agg", srcPort: "Ten0/0/48", dstPort: "P0/1/31" },

    /* ======== Cross-rack: AGG-1 → ACC-1 ======== */
    { srcDevice: "pp-agg", dstDevice: "pp-acc", srcPort: "P0/1/40", dstPort: "P0/1/1", medium: "fibre" },
    { srcDevice: "pp-agg", dstDevice: "pp-acc", srcPort: "P0/1/41", dstPort: "P0/1/2", medium: "fibre" },
    { srcDevice: "pp-acc", dstDevice: "access-sw-a", srcPort: "P0/1/10", dstPort: "G0/1/48", srcIp: hostIp("10.0.2.0/24", 1), dstIp: hostIp("10.0.2.0/24", 10), dstIsPrimary: true },
    { srcDevice: "pp-acc", dstDevice: "access-sw-b", srcPort: "P0/1/11", dstPort: "G0/1/48", srcIp: hostIp("10.0.2.0/24", 2), dstIp: hostIp("10.0.2.0/24", 11), dstIsPrimary: true },

    /* ======== Within ACC-1 ======== */
    { srcDevice: "access-sw-a", dstDevice: "server-alpha", srcPort: "G0/1/1", dstPort: "eth0", srcIp: hostIp("10.0.2.0/24", 20), dstIp: hostIp("10.0.2.0/24", 30), dstIsPrimary: true },
    { srcDevice: "access-sw-b", dstDevice: "server-alpha", srcPort: "G0/1/1", dstPort: "eth1", srcIp: hostIp("10.0.2.0/24", 21), dstIp: hostIp("10.0.2.0/24", 31) },
    { srcDevice: "access-sw-a", dstDevice: "server-beta", srcPort: "G0/1/2", dstPort: "eth0", srcIp: hostIp("10.0.2.0/24", 22), dstIp: hostIp("10.0.2.0/24", 40), dstIsPrimary: true },
    { srcDevice: "access-sw-b", dstDevice: "server-beta", srcPort: "G0/1/2", dstPort: "eth1", srcIp: hostIp("10.0.2.0/24", 23), dstIp: hostIp("10.0.2.0/24", 41) },
    { srcDevice: "access-sw-a", dstDevice: "server-gamma", srcPort: "G0/1/3", dstPort: "eth0", srcIp: hostIp("10.0.2.0/24", 24), dstIp: hostIp("10.0.2.0/24", 50), dstIsPrimary: true },
    { srcDevice: "access-sw-a", dstDevice: "nas-01", srcPort: "G0/1/10", dstPort: "eth0", medium: "fibre", srcIp: hostIp("10.0.2.0/24", 60), dstIp: hostIp("10.0.2.0/24", 70), dstIsPrimary: true },
    { srcDevice: "access-sw-b", dstDevice: "nas-01", srcPort: "G0/1/10", dstPort: "eth1", medium: "fibre" },
    { srcDevice: "access-sw-a", dstDevice: "ap-01", srcPort: "G0/1/20", dstPort: "eth0", srcIp: hostIp("10.0.2.0/24", 80), dstIp: hostIp("10.0.2.0/24", 90), dstIsPrimary: true },
    { srcDevice: "access-sw-b", dstDevice: "ap-01", srcPort: "G0/1/20", dstPort: "eth1", srcIp: hostIp("10.0.2.0/24", 81), dstIp: hostIp("10.0.2.0/24", 91) },
    { srcDevice: "access-sw-a", dstDevice: "ip-phone-01", srcPort: "G0/1/30", dstPort: "eth0", srcIp: hostIp("10.0.2.0/24", 100), dstIp: hostIp("10.0.2.0/24", 110) },
    { srcDevice: "ip-phone-01", dstDevice: "ip-phone-02", srcPort: "eth1", dstPort: "eth0", srcIp: hostIp("10.0.2.0/24", 110), dstIp: hostIp("10.0.2.0/24", 111) },
    { srcDevice: "access-sw-a", dstDevice: "printer-01", srcPort: "G0/1/40", dstPort: "eth0", srcIp: hostIp("10.0.2.0/24", 120), dstIp: hostIp("10.0.2.0/24", 130) },
    { srcDevice: "access-sw-b", dstDevice: "cam-01", srcPort: "G0/1/40", dstPort: "eth0", srcIp: hostIp("10.0.2.0/24", 121), dstIp: hostIp("10.0.2.0/24", 140) },
  ];

  return { racks, devices, connections, portTemplates };
}

/* ================================================================
   Registry
   ================================================================ */

export interface SampleDef {
  id: string;
  name: string;
  description: string;
  source: string;
  data: SampleFile;
  stats: { racks: number; devices: number; connections: number };
}

const _samples: SampleDef[] = [
  {
    id: "general",
    name: "General Network",
    description: "Small-to-medium business with edge routing, switching, servers, wireless, surveillance, VoIP, printers, KVM, and structured cabling.",
    source: "sample-general.json",
    data: generateGeneral(),
    stats: { racks: 0, devices: 0, connections: 0 },
  },
  {
    id: "datacentre",
    name: "Data Centre",
    description: "Large-scale facility with 12 racks across 4 groups, spine-leaf fabric, compute/storage nodes, and carrier meet-me room.",
    source: "sample-datacentre.json",
    data: generateDataCentre(),
    stats: { racks: 0, devices: 0, connections: 0 },
  },
  {
    id: "cabling",
    name: "Cabling & Connections",
    description: "Connection-focused demo: multi-link, mixed medium, dual-homed servers, patch panel routing, phone daisy-chain, and DAC/AOC links.",
    source: "sample-cabling.json",
    data: generateCabling(),
    stats: { racks: 0, devices: 0, connections: 0 },
  },
];

for (const s of _samples) {
  s.stats.racks = s.data.racks.length;
  s.stats.devices = s.data.devices.length;
  s.stats.connections = s.data.connections.length;
}

export function getSample(id: string): SampleDef | undefined {
  return _samples.find((s) => s.id === id);
}

export function getSamples(): SampleDef[] {
  return _samples;
}

export const SAMPLE_SOURCE = "sample-network.json";
const _legacy = generateGeneral();
export const SAMPLE_FILE: SampleFile = _legacy;
export const SAMPLE_JSON = JSON.stringify(_legacy, null, 2);
export const SAMPLE_SNIPPET = JSON.stringify(
  {
    racks: _legacy.racks.slice(0, 2),
    devices: _legacy.devices.slice(0, 2),
    connections: _legacy.connections.slice(0, 1),
    portTemplates: _legacy.portTemplates?.slice(0, 2),
  },
  null,
  2,
);
