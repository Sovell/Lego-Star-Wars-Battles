import { Application, extend, useTick } from "@pixi/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { Container, Graphics, Text as PixiText, type Application as PixiApplication } from "pixi.js";
import type { CampaignRoute, CampaignState } from "../../core/campaign";
import { galacticHyperlanes } from "../../core/galactic-conquest/galaxy";
import { useI18n } from "../../i18n";
import { zoomCameraAtPoint, type BoardCamera } from "../../battlefield/board-camera";
import { buildCampaignMapNodes } from "./campaign-screen-model";
import type { CampaignActivationAction } from "./campaign-activation-model";

extend({ Container, Graphics, Text: PixiText });

const WORLD = { width: 1000, height: 700 };
const MIN_ZOOM = 0.72;
const MAX_ZOOM = 2.3;

export function CampaignGalaxy({
  campaign,
  selectedPlanetId,
  selectedArmyId,
  legalRoutes,
  pendingAction,
  onPlanetSelect,
  onRouteSelect,
}: {
  campaign: CampaignState;
  selectedPlanetId?: string;
  selectedArmyId?: string;
  legalRoutes: CampaignRoute[];
  pendingAction?: CampaignActivationAction;
  onPlanetSelect: (planetId: string) => void;
  onRouteSelect: (planetId: string) => void;
}) {
  const { text } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | undefined>(undefined);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [application, setApplication] = useState<PixiApplication | null>(null);
  const [camera, setCamera] = useState<BoardCamera>({ zoom: 1, x: 0, y: 0 });
  const nodes = useMemo(() => buildCampaignMapNodes(campaign), [campaign]);
  const baseScale = Math.min((size.width - 46) / WORLD.width, (size.height - 46) / WORLD.height);
  const routeByDestination = useMemo(
    () => new Map(legalRoutes.map((route) => [route.destinationPlanetId, route])),
    [legalRoutes],
  );
  const legalLinks = useMemo(() => new Set(
    legalRoutes.flatMap(({ planetIds }) => planetIds.slice(1).map((planetId, index) =>
      routeKey(planetIds[index], planetId))),
  ), [legalRoutes]);
  const selectedLinks = useMemo(() => {
    const destination = pendingAction && "destinationPlanetId" in pendingAction
      ? pendingAction.destinationPlanetId
      : undefined;
    const route = destination ? routeByDestination.get(destination) : undefined;
    return new Set(route?.planetIds.slice(1).map((planetId, index) =>
      routeKey(route.planetIds[index], planetId)));
  }, [pendingAction, routeByDestination]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const updateSize = () => {
      const bounds = host.getBoundingClientRect();
      setSize({ width: Math.max(1, Math.floor(bounds.width)), height: Math.max(1, Math.floor(bounds.height)) });
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    updateSize();
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => { application?.renderer.resize(size.width, size.height); }, [application, size]);

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - bounds.left - bounds.width / 2, y: event.clientY - bounds.top - bounds.height / 2 };
    setCamera((current) => zoomCameraAtPoint(current, clamp(current.zoom * Math.exp(-event.deltaY * 0.0012), MIN_ZOOM, MAX_ZOOM), point));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 1) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    setCamera((current) => ({ ...current, x: current.x + deltaX, y: current.y + deltaY }));
  }

  return <section className="campaignGalaxyPanel">
    <div className="campaignPanelHeading">
      <div><p className="eyebrow">{text("Teatr działań", "Theater of operations")}</p><h3>{text("Mapa galaktyczna", "Galactic map")}</h3></div>
      <div className="campaignLegend"><span className="legendRepublic">{text("Republika", "Republic")}</span><span className="legendSeparatists">{text("Separatyści", "Separatists")}</span><span className="legendNeutral">{text("Neutralne", "Neutral")}</span></div>
    </div>
    <div className="campaignPixiMap" ref={hostRef} onPointerCancel={() => { dragRef.current = undefined; }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => { dragRef.current = undefined; }} onWheel={handleWheel}>
      <Application antialias autoDensity backgroundAlpha={0} height={size.height} onInit={setApplication} resolution={Math.min(window.devicePixelRatio || 1, 2)} resizeTo={hostRef} width={size.width}>
        <GalaxyScene
          camera={camera} height={size.height} legalLinks={legalLinks} nodes={nodes}
          selectedArmyPlanetId={campaign.armies.find(({ id }) => id === selectedArmyId)?.planetId}
          selectedLinks={selectedLinks} selectedPlanetId={selectedPlanetId} width={size.width}
          onPlanetClick={(planetId) => { onPlanetSelect(planetId); if (routeByDestination.has(planetId)) onRouteSelect(planetId); }}
        />
      </Application>
      <CampaignMinimap
        baseScale={baseScale}
        camera={camera}
        height={size.height}
        nodes={nodes}
        width={size.width}
        onNavigate={(point) => setCamera((current) => ({
          ...current,
          x: (WORLD.width / 2 - point.x) * baseScale * current.zoom,
          y: (WORLD.height / 2 - point.y) * baseScale * current.zoom,
        }))}
      />
      <div className="campaignMapControls"><button onClick={() => setCamera((current) => zoomCameraAtPoint(current, clamp(current.zoom - 0.15, MIN_ZOOM, MAX_ZOOM), { x: 0, y: 0 }))}>−</button><button onClick={() => setCamera({ zoom: 1, x: 0, y: 0 })}>{Math.round(camera.zoom * 100)}%</button><button onClick={() => setCamera((current) => zoomCameraAtPoint(current, clamp(current.zoom + 0.15, MIN_ZOOM, MAX_ZOOM), { x: 0, y: 0 }))}>+</button></div>
      <small className="campaignMapHint">{text("Kółko: zoom · środkowy przycisk: przesuwanie", "Wheel: zoom · middle button: pan")}</small>
    </div>
  </section>;
}

function GalaxyScene({ camera, height, legalLinks, nodes, selectedArmyPlanetId, selectedLinks, selectedPlanetId, width, onPlanetClick }: {
  camera: BoardCamera; height: number; legalLinks: Set<string>; nodes: ReturnType<typeof buildCampaignMapNodes>; selectedArmyPlanetId?: string; selectedLinks: Set<string>; selectedPlanetId?: string; width: number; onPlanetClick: (planetId: string) => void;
}) {
  const baseScale = Math.min((width - 46) / WORLD.width, (height - 46) / WORLD.height);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  return <pixiContainer x={width / 2 + camera.x} y={height / 2 + camera.y} scale={baseScale * camera.zoom}>
    <pixiContainer x={-WORLD.width / 2} y={-WORLD.height / 2}>
      <GalaxyBackdrop />
      {galacticHyperlanes.map((lane) => {
        const from = nodesById.get(lane.fromPlanetId);
        const to = nodesById.get(lane.toPlanetId);
        if (!from || !to) return null;
        const key = routeKey(lane.fromPlanetId, lane.toPlanetId);
        const color = selectedLinks.has(key) ? 0xfff2a2 : legalLinks.has(key) ? 0xece06c : 0x4e8ca9;
        const alpha = selectedLinks.has(key) ? 1 : legalLinks.has(key) ? 0.88 : 0.3;
        return <pixiGraphics key={lane.id} draw={(graphics) => graphics.clear().moveTo(from.x * 10, from.y * 7).lineTo(to.x * 10, to.y * 7).stroke({ color, alpha, width: selectedLinks.has(key) ? 4 : legalLinks.has(key) ? 3 : 2 })} />;
      })}
      {nodes.map((node) => <PlanetNode key={node.id} node={node} selected={node.id === selectedPlanetId} armyOrigin={node.id === selectedArmyPlanetId} onClick={onPlanetClick} />)}
    </pixiContainer>
  </pixiContainer>;
}

function GalaxyBackdrop() {
  return <pixiGraphics draw={(graphics) => {
    graphics.clear().roundRect(0, 0, WORLD.width, WORLD.height, 20).fill({ color: 0x07111d });
    for (let index = 0; index < 170; index += 1) {
      const x = (index * 83) % WORLD.width;
      const y = (index * 149) % WORLD.height;
      const alpha = 0.1 + (index % 5) * 0.06;
      graphics.circle(x, y, index % 13 === 0 ? 2 : 1).fill({ color: 0xcce8ff, alpha });
    }
    graphics.ellipse(500, 350, 310, 230).stroke({ color: 0x31556f, alpha: 0.2, width: 2 });
    graphics.ellipse(500, 350, 180, 135).stroke({ color: 0x31556f, alpha: 0.17, width: 2 });
  }} />;
}

function PlanetNode({ node, selected, armyOrigin, onClick }: { node: ReturnType<typeof buildCampaignMapNodes>[number]; selected: boolean; armyOrigin: boolean; onClick: (planetId: string) => void }) {
  const radius = node.playable ? 22 : 15;
  const color = node.controller === "Republic" ? 0x52b8ed : node.controller === "Separatists" ? 0xe35f6e : node.controller === "Contested" ? 0xd8ad5d : 0x778797;
  const pulseRef = useRef<Graphics>(null);
  const age = useRef(0);
  useEffect(() => { age.current = 0; }, [armyOrigin, selected]);
  useTick((ticker) => {
    age.current += ticker.deltaMS;
    const pulse = pulseRef.current;
    if (!pulse) return;
    pulse.clear();
    if (!selected && !armyOrigin) return;
    const cycle = (Math.sin(age.current / 280) + 1) / 2;
    const accent = selected ? 0xffef8a : 0x6bd2ff;
    pulse.circle(0, 0, radius + 9 + cycle * 7).stroke({ color: accent, alpha: 0.12 + cycle * 0.2, width: 2 });
  });
  return <pixiContainer x={node.x * 10} y={node.y * 7} alpha={node.playable ? 1 : 0.38} eventMode={node.playable ? "static" : "none"} cursor={node.playable ? "pointer" : "default"} onPointerTap={() => onClick(node.id)}>
    <pixiGraphics ref={pulseRef} draw={(graphics) => graphics.clear()} />
    <pixiGraphics draw={(graphics) => {
      graphics.clear().circle(0, 0, radius).fill({ color: 0x142d40 }).stroke({ color, width: selected ? 5 : 3, alpha: 0.98 });
      if (selected || armyOrigin) graphics.circle(0, 0, radius + (selected ? 9 : 6)).stroke({ color: selected ? 0xffef8a : 0x6bd2ff, alpha: 0.75, width: 3 });
      node.sectorControllers.forEach((controller, index) => graphics.roundRect(-13 + index * 9, -3, 7, 12, 2).fill({ color: controller === "Republic" ? 0x327ea7 : controller === "Separatists" ? 0xa83f4a : 0x56616c }));
    }} />
    <pixiText anchor={{ x: 0.5, y: 0 }} style={{ fill: "#dfe8ef", fontFamily: "Inter, sans-serif", fontSize: node.playable ? 16 : 13, fontWeight: "700", stroke: { color: "#07111d", width: 4 } }} text={node.name} x={0} y={radius + 8} />
    {node.armyCount > 0 ? <pixiText anchor={{ x: 0.5, y: 0.5 }} style={{ fill: "#171816", fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: "900" }} text={`A${node.armyCount}`} x={radius - 2} y={-radius + 2} /> : null}
    {node.baseLevel ? <pixiText anchor={{ x: 0.5, y: 0.5 }} style={{ fill: "#dbe5ed", fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: "900" }} text={`B${node.baseLevel}`} x={-radius + 3} y={-radius + 2} /> : null}
  </pixiContainer>;
}

function CampaignMinimap({
  baseScale,
  camera,
  height,
  nodes,
  onNavigate,
  width,
}: {
  baseScale: number;
  camera: BoardCamera;
  height: number;
  nodes: ReturnType<typeof buildCampaignMapNodes>;
  onNavigate: (point: { x: number; y: number }) => void;
  width: number;
}) {
  const scale = Math.max(0.001, baseScale * camera.zoom);
  const viewport = {
    left: clamp((WORLD.width / 2 - camera.x / scale - width / (2 * scale)) / WORLD.width * 100, 0, 100),
    top: clamp((WORLD.height / 2 - camera.y / scale - height / (2 * scale)) / WORLD.height * 100, 0, 100),
    width: clamp(width / scale / WORLD.width * 100, 0, 100),
    height: clamp(height / scale / WORLD.height * 100, 0, 100),
  };
  return <button
    aria-label="Navigate galactic map"
    className="campaignMinimap"
    onClick={(event) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      onNavigate({
        x: clamp((event.clientX - bounds.left) / bounds.width * WORLD.width, 0, WORLD.width),
        y: clamp((event.clientY - bounds.top) / bounds.height * WORLD.height, 0, WORLD.height),
      });
    }}
    type="button"
  >
    <span className="campaignMinimapLabel">MAP</span>
    {nodes.map((node) => <i
      className={`controller${node.controller}`}
      key={node.id}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
    />)}
    <b style={{ height: `${viewport.height}%`, left: `${viewport.left}%`, top: `${viewport.top}%`, width: `${viewport.width}%` }} />
  </button>;
}

function routeKey(left: string, right: string) { return [left, right].sort().join("--"); }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
