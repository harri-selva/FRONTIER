import { useCallback, useEffect, useMemo, useState } from "react";
import { api, useData, type FieldId, type LandInfo } from "./data";
import { go, parent, useRoute, type Route } from "./router";
import { useSettings } from "./settings";
import { sfx } from "./sound";
import Galaxy from "./scenes/Galaxy";
import Planet from "./scenes/Planet";
import Land from "./scenes/Land";
import DetailPanel from "./ui/DetailPanel";
import Validation from "./ui/Validation";
import { GapsBoard, Method } from "./ui/Pages";
import { Boot, Hud, Starfield, type Crumb } from "./ui/Hud";

const NAME: Record<FieldId, string> = { medicine: "MEDICINE", quant: "QUANT" };

export default function App() {
  const route = useRoute();
  const { crt } = useSettings();
  const [boot, setBoot] = useState(() => { try { return !sessionStorage.getItem("frontier.booted"); } catch { return true; } });
  const endBoot = useCallback(() => { try { sessionStorage.setItem("frontier.booted", "1"); } catch { /* ignore */ } setBoot(false); }, []);
  const fields = useData(() => api.fields(), []);

  const field = "field" in route ? route.field : undefined;
  const lands = useData(() => (field ? api.lands(field) : Promise.resolve(undefined)), [field]);
  const landInfo: LandInfo | undefined = route.view === "land" ? lands?.find((l) => l.slug === route.land) : undefined;
  const landData = useData(() => (route.view === "land" && landInfo ? api.land(route.field, landInfo.id) : Promise.resolve(undefined)),
    [route.view === "land" ? `${route.field}/${landInfo?.id}` : ""]);
  const showPanel = route.view === "land" && (route.concept !== undefined || !!route.gap);
  const text = useData(() => (showPanel && landInfo && field ? api.landText(field, landInfo.id) : Promise.resolve(undefined)),
    [showPanel ? `${field}/${landInfo?.id}` : ""]);
  const concepts = useData(() => (field ? api.concepts(field) : Promise.resolve(undefined)), [field]);
  const conceptMap = useMemo(() => new Map((concepts || []).map((c) => [c.id, c])), [concepts]);

  // ESC = up one level
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || boot) return;
      if (document.querySelector(".modal-back")) return;   // dialogs close themselves
      const up = parent(route);
      if (up) { sfx.back(); go(up); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [route, boot]);

  const crumbs: Crumb[] = [{ label: "GALAXY", route: { view: "galaxy" } }];
  if (field && (route.view === "planet" || route.view === "land")) crumbs.push({ label: NAME[field], route: { view: "planet", field } });
  if (route.view === "land") {
    crumbs.push({ label: (landInfo?.name || route.land).toUpperCase(), route: { view: "land", field: route.field, land: route.land } });
    if (route.gap && landData) { const g = landData.gaps.find((x) => x.id === route.gap); if (g) crumbs.push({ label: `${g.u_name} + ${g.v_name}`, route }); }
    else if (route.concept !== undefined) {
      const n = landData?.nodes.find((x) => x.id === route.concept)?.name ?? conceptMap.get(route.concept!)?.name;
      if (n) crumbs.push({ label: n, route });
    }
  }
  if (route.view === "backtest") crumbs.push({ label: "VALIDATION", route });
  if (route.view === "gaps") crumbs.push({ label: "TOP GAPS", route });
  if (route.view === "method") crumbs.push({ label: "HOW IT WORKS", route });

  return (
    <div className={`app ${crt ? "crt" : ""}`}>
      {view(route, { fields, lands, landInfo, landData })}
      {route.view === "land" && landData && landInfo && lands && showPanel && (
        <DetailPanel land={landData} lands={lands} concepts={conceptMap} text={text}
          concept={route.concept ?? null} gapId={route.gap ?? null}
          onGap={(id) => go({ view: "land", field: route.field, land: route.land, gap: id })}
          onConcept={(id) => go({ view: "land", field: route.field, land: route.land, concept: id })}
          onClose={() => go({ view: "land", field: route.field, land: route.land })}
          onLand={(l) => go({ view: "land", field: route.field, land: l.slug })} />
      )}
      {route.view === "land" && lands && !landInfo && <div className="loading">UNKNOWN SECTOR. <a href="#/">Return to galaxy</a></div>}
      <Hud route={route} crumbs={crumbs} />
      {crt && <div className="crt-fx" aria-hidden="true" />}
      {boot && <Boot onDone={endBoot} />}
    </div>
  );
}

function view(route: Route, d: { fields?: import("./data").FieldInfo[]; lands?: LandInfo[]; landInfo?: LandInfo; landData?: import("./data").LandData }) {
  switch (route.view) {
    case "galaxy":
      return <Galaxy key="galaxy" fields={d.fields} onEnter={(f) => go({ view: "planet", field: f })} />;
    case "planet":
      return <Planet key={`p-${route.field}`} field={route.field} info={d.fields?.find((x) => x.id === route.field)} lands={d.lands}
        onEnter={(slug) => go({ view: "land", field: route.field, land: slug })} />;
    case "land":
      return d.lands ? (
        <Land key={`l-${route.field}-${route.land}`} field={route.field} lands={d.lands} data={d.landData}
          selConcept={route.concept ?? null} selGap={route.gap ?? null}
          onPickNode={(id) => go({ view: "land", field: route.field, land: route.land, concept: id })}
          onPickGap={(id) => go({ view: "land", field: route.field, land: route.land, gap: id })}
          onPickLand={(l) => go({ view: "land", field: route.field, land: l.slug })} />
      ) : <div className="loading">SCANNING SECTOR...</div>;
    case "backtest":
      return <><Starfield /><Validation field={route.field} /></>;
    case "gaps":
      return <><Starfield /><GapsBoard /></>;
    case "method":
      return <><Starfield /><Method /></>;
  }
}
