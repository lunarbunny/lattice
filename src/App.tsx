import { useState } from "react";
import { useRoute, navigate } from "./lib/router";
import { DatastoreProvider, useDatastore } from "./store";
import { ToastProvider } from "./components/Toast";
import MainPage from "./pages/MainPage";
import DatacenterPage from "./pages/DatacenterPage";
import SamplePickerModal from "./components/sample/SamplePickerModal";
import { LogoMark, IconList, IconArrowLeft, IconSamples, IconX } from "./components/Icons";

function TopBar({ route }: { route: ReturnType<typeof useRoute> }) {
  const { devices, isPreview, previewName, exitPreview } = useDatastore();
  const [showSamples, setShowSamples] = useState(false);

  return (
    <>
      <header className="relative z-40 flex h-14 shrink-0 items-center justify-between border-b border-line bg-deep/80 px-4 backdrop-blur-md sm:px-5">
        <button
          onClick={() => navigate("/")}
          className="group flex items-center gap-2.5"
          aria-label="Lattice home"
        >
          <LogoMark className="h-7 w-7 transition-transform group-hover:scale-110" size={28} />
          <span className="text-left leading-none">
            <span className="block font-display text-[16px] font-bold tracking-[0.08em] text-txt">
              LATTICE
            </span>
            <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.22em] text-faint">
              network atlas
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          {isPreview ? (
            <>
              <span className="flex items-center gap-1.5 rounded-md bg-brand/15 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-brand">
                {previewName ?? "Preview"}
              </span>
              <button
                onClick={exitPreview}
                className="flex items-center gap-2 rounded-lg border border-line bg-raised/70 px-3.5 py-2 text-[13px] font-semibold text-txt transition-all hover:border-brand/60 hover:bg-brand/10 hover:text-brand active:scale-[0.97]"
              >
                <IconX className="h-4 w-4" size={16} />
                Exit preview
              </button>
            </>
          ) : route.page === "main" ? (
            <>
              <button
                onClick={() => setShowSamples(true)}
                className="flex items-center justify-center rounded-lg border border-line bg-raised/70 p-2 text-mute transition-all hover:border-brand/60 hover:bg-brand/10 hover:text-brand active:scale-[0.97]"
                aria-label="Sample networks"
              >
                <IconSamples className="h-4 w-4" size={16} />
              </button>
              <button
                onClick={() => navigate("/datacenter")}
                className="flex items-center gap-2 rounded-lg border border-line bg-raised/70 px-3.5 py-2 text-[13px] font-semibold text-txt transition-all hover:border-brand/60 hover:bg-brand/10 hover:text-brand active:scale-[0.97]"
              >
                <IconList className="h-4 w-4" size={16} />
                Datacenter
                <span className="rounded-md bg-brand/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand">
                  {devices.length}
                </span>
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 rounded-lg border border-line bg-raised/70 px-3.5 py-2 text-[13px] font-semibold text-txt transition-all hover:border-brand/60 hover:bg-brand/10 hover:text-brand active:scale-[0.97]"
            >
              <IconArrowLeft className="h-4 w-4" size={16} />
              Back to fabric
            </button>
          )}
        </div>
      </header>

      {showSamples && <SamplePickerModal onClose={() => setShowSamples(false)} />}
    </>
  );
}

function Shell() {
  const route = useRoute();
  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-abyss text-txt">
      {/* ambient layers */}
      <div
        aria-hidden="true"
        className="dotgrid pointer-events-none absolute inset-0"
        style={{
          maskImage: "radial-gradient(ellipse 90% 80% at 50% 30%, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 80% at 50% 30%, black 40%, transparent 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full opacity-60"
        style={{
          background: "radial-gradient(circle, rgba(45,212,191,0.10) 0%, transparent 65%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-24 h-[360px] w-[360px] rounded-full opacity-50"
        style={{
          background: "radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 65%)",
        }}
      />

      <TopBar route={route} />

      <main className="relative min-h-0 flex-1">
        {route.page === "main" ? (
          <MainPage key={route.focusId ?? "main"} focusId={route.focusId} />
        ) : (
          <DatacenterPage />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <DatastoreProvider>
        <Shell />
      </DatastoreProvider>
    </ToastProvider>
  );
}
