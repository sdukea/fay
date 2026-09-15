"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CommandBar } from "@/components/shell/CommandBar";
import { StatusBar } from "@/components/shell/StatusBar";
import { TopBar, type AppMode } from "@/components/shell/TopBar";
import { ToastStack, useToasts } from "@/components/shell/ToastStack";
import { OperationsDrawer, useOperationsDrawerControl } from "@/components/incidents/OperationsDrawer";
import { MapContainer } from "@/components/map/MapContainer";
import { FayPanel } from "@/components/decision/FayPanel";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { postAutoDispatchTick, postDispatchMode, postIncidentStreamTick, postLifecycleTick } from "@/lib/client/api";
import { useSession } from "@/lib/client/useSession";
import { useSystemState } from "@/lib/client/useSystemState";

export default function Home() {
  const { operator, loading: sessionLoading, login, logout } = useSession();
  const { data, error, loading, refresh } = useSystemState();
  const [mode, setMode] = useState<AppMode>("LIVE");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [focusIncidentIds, setFocusIncidentIds] = useState<string[] | null>(null);
  const drawer = useOperationsDrawerControl();
  const { toasts, push } = useToasts();

  useEffect(() => {
    // Auto-dispatch tick is a no-op server-side unless AUTO_DISPATCH mode is active.
    const id = setInterval(() => {
      postAutoDispatchTick().then((res) => {
        if (res.ran) refresh();
      });
    }, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    // Physical lifecycle simulation (EN_ROUTE → ON_SCENE → back in service) —
    // always runs, independent of dispatch mode; ticks faster than
    // auto-dispatch so resource movement and arrival feel responsive.
    const id = setInterval(() => {
      postLifecycleTick().then((res) => {
        if (res.arrived.length === 0 && res.returnedToService.length === 0) return;
        for (const code of res.returnedToService) {
          push(`${code} is back in service — available for reassignment`, "green");
        }
        refresh();
      });
    }, 2000);
    return () => clearInterval(id);
  }, [refresh, push]);

  useEffect(() => {
    // Keeps the board alive on its own — a real command center never goes
    // quiet. Self-regulating server-side (see incidentStream.ts), so this is
    // just a steady poll, not a rate the client controls.
    const id = setInterval(() => {
      postIncidentStreamTick().then((res) => {
        if (res.created.length > 0) refresh();
      });
    }, 6000);
    return () => clearInterval(id);
  }, [refresh]);

  const selectedIncident = useMemo(
    () => data?.incidents.find((i) => i.id === selectedIncidentId) ?? null,
    [data, selectedIncidentId],
  );

  const routeResource = useMemo(() => {
    if (!selectedIncident || !data) return null;
    return data.resources.find((r) => r.code === selectedIncident.assignedResourceCode) ?? null;
  }, [selectedIncident, data]);

  const handleSelectResource = useCallback(
    (resourceId: string) => {
      setSelectedResourceId(resourceId);
      // If it's currently assigned, also surface the incident it's responding
      // to — but the camera always flies to the resource's own live position
      // (handled inside the map), not the incident's.
      const resource = data?.resources.find((r) => r.id === resourceId);
      if (!resource?.currentIncidentCode || !data) return;
      const incident = data.incidents.find((i) => i.code === resource.currentIncidentCode);
      if (incident) setSelectedIncidentId(incident.id);
    },
    [data],
  );

  const handleSelectIncidentByCode = useCallback(
    (code: string) => {
      const incident = data?.incidents.find((i) => i.code === code);
      if (incident) {
        setMode("LIVE");
        setSelectedIncidentId(incident.id);
      }
    },
    [data],
  );

  const handleBrowseResources = useCallback(() => {
    drawer.setTab("RESOURCES");
    drawer.setExpanded(true);
  }, [drawer]);

  async function toggleDispatchMode() {
    if (!data) return;
    const next = data.dispatchMode === "AUTO_DISPATCH" ? "HUMAN_APPROVAL" : "AUTO_DISPATCH";
    await postDispatchMode(next);
    refresh();
  }

  if (sessionLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-void)] text-[var(--text-tertiary)] text-[13px]">
        Loading…
      </div>
    );
  }

  if (!operator) {
    return <LoginScreen onSignIn={login} />;
  }

  if (loading && !data) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-void)] text-[var(--text-tertiary)] text-[13px]">
        Initializing Fay…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-void)] text-[13px] text-[var(--accent-red)] px-6 text-center">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="h-screen w-screen bg-[var(--bg-void)] overflow-hidden relative">
      <div className="absolute inset-0">
        <MapContainer
          incidents={data.incidents}
          resources={data.resources}
          hospitals={data.hospitals}
          selectedIncidentId={selectedIncidentId}
          selectedResourceId={selectedResourceId}
          routeResource={routeResource}
          focusIncidentIds={mode === "OPTIMIZE" ? focusIncidentIds : null}
          onSelectIncident={(id) => {
            setMode("LIVE");
            setSelectedIncidentId(id);
          }}
          onSelectResource={handleSelectResource}
        />
      </div>

      <div className="absolute top-0 left-0 right-0 z-30 scrim-top pb-6 pointer-events-none">
        <div className="pointer-events-auto">
          <TopBar
            mode={mode}
            onModeChange={setMode}
            connected={!error}
            dispatchMode={data.dispatchMode}
            onToggleDispatchMode={toggleDispatchMode}
            operator={operator}
            onSignOut={logout}
            events={data.events}
            onSelectIncidentByCode={handleSelectIncidentByCode}
          />
          <StatusBar metrics={data.metrics} />
        </div>
      </div>

      <ToastStack toasts={toasts} />

      <OperationsDrawer
        incidents={data.incidents}
        resources={data.resources}
        selectedIncidentId={selectedIncidentId}
        selectedIncident={selectedIncident}
        selectedResourceId={selectedResourceId}
        onSelectIncident={(id) => {
          setMode("LIVE");
          setSelectedIncidentId(id);
        }}
        onSelectResource={handleSelectResource}
        onDispatched={refresh}
        control={drawer}
      />

      <FayPanel
        mode={mode}
        incident={selectedIncident}
        events={data.events}
        onDispatched={refresh}
        onSelectIncidentByCode={handleSelectIncidentByCode}
        onOptimizePreview={setFocusIncidentIds}
        onBrowseResources={handleBrowseResources}
      />

      <CommandBar />
    </div>
  );
}
