import { Application, extend, useTick } from "@pixi/react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  Assets,
  type Application as PixiApplication,
  Container,
  type FederatedPointerEvent,
  Graphics,
  Rectangle,
  Sprite,
  Text as PixiText,
  Texture,
} from "pixi.js";
import type { BattlefieldObjectType, FactionId, TerrainType } from "../types";
import { calculateSquareBoardLayout } from "./board-layout";
import { zoomCameraAtPoint, type BoardCamera } from "./board-camera";
import { getBoardCellInteraction, type BoardCellInteraction } from "./board-interaction-model";
import type { BattlefieldVisualEvent } from "./battlefield-visual-events";
import { boardPositionKey, type BoardTokenViewModel, type BoardViewModel } from "./board-view-model";
import type { BoardRendererProps } from "./board-renderer";

extend({ Container, Graphics, Sprite, Text: PixiText });

const BOARD_PADDING = 34;
const CELL_GAP = 4;
const MIN_ZOOM = 0.72;
const MAX_ZOOM = 2.35;

export function PixiMapBoard(props: BoardRendererProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | undefined>(undefined);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [application, setApplication] = useState<PixiApplication | null>(null);
  const [camera, setCamera] = useState<BoardCamera>({ zoom: 1, x: 0, y: 0 });

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const updateSize = () => {
      const bounds = host.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.floor(bounds.width)),
        height: Math.max(1, Math.floor(bounds.height)),
      });
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    updateSize();
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (application) application.renderer.resize(size.width, size.height);
  }, [application, size.height, size.width]);

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0012);
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = {
      x: event.clientX - bounds.left - bounds.width / 2,
      y: event.clientY - bounds.top - bounds.height / 2,
    };
    setCamera((current) => zoomCameraAtPoint(
      current,
      clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM),
      point,
    ));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 1) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    setCamera((current) => ({ ...current, x: current.x + deltaX, y: current.y + deltaY }));
  }

  function stopDragging(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = undefined;
  }

  return (
    <div
      aria-label="Interaktywna plansza Pixi"
      className="pixiMapBoard"
      onPointerCancel={stopDragging}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onWheel={handleWheel}
      ref={hostRef}
    >
      <Application
        antialias
        autoDensity
        backgroundColor={0x0b1017}
        height={size.height}
        onInit={setApplication}
        resolution={Math.min(window.devicePixelRatio || 1, 2)}
        resizeTo={hostRef}
        width={size.width}
      >
        <PixiBoardScene {...props} camera={camera} height={size.height} width={size.width} />
      </Application>
      <div className="pixiCameraControls" aria-label="Sterowanie kamerą">
        <button
          aria-label="Oddal planszę"
          onClick={() => setCamera((current) => zoomCameraAtPoint(
            current,
            clamp(current.zoom - 0.15, MIN_ZOOM, MAX_ZOOM),
            { x: 0, y: 0 },
          ))}
          type="button"
        >−</button>
        <button
          className="pixiCameraReset"
          onClick={() => setCamera({ zoom: 1, x: 0, y: 0 })}
          title="Wyśrodkuj planszę"
          type="button"
        >{Math.round(camera.zoom * 100)}%</button>
        <button
          aria-label="Przybliż planszę"
          onClick={() => setCamera((current) => zoomCameraAtPoint(
            current,
            clamp(current.zoom + 0.15, MIN_ZOOM, MAX_ZOOM),
            { x: 0, y: 0 },
          ))}
          type="button"
        >+</button>
      </div>
      <small className="pixiCameraHint">Kółko: zoom pod kursorem · środkowy przycisk: przesuń</small>
    </div>
  );
}

function PixiBoardScene({
  camera,
  height,
  interactionDisabled,
  interactionModel,
  selectedUnitId,
  viewModel,
  visualEvent,
  width,
  onCellClick,
  onSelectedUnitChange,
}: BoardRendererProps & { camera: BoardCamera; height: number; width: number }) {
  const [hoveredCellKey, setHoveredCellKey] = useState<string>();
  const { cellSize } = calculateSquareBoardLayout({
    columns: viewModel.width,
    gap: CELL_GAP,
    height,
    padding: BOARD_PADDING,
    rows: viewModel.height,
    width,
  });
  const stride = cellSize + CELL_GAP;
  const boardWidth = viewModel.width * stride - CELL_GAP;
  const boardHeight = viewModel.height * stride - CELL_GAP;

  return (
    <CameraWorld camera={camera} height={height} visualEvent={visualEvent} width={width}>
      <pixiContainer x={-boardWidth / 2} y={-boardHeight / 2}>
        <TerrainLayer cellSize={cellSize} stride={stride} viewModel={viewModel} />
        <TerritoryLayer cellSize={cellSize} stride={stride} viewModel={viewModel} />
        <InteractionLayer
          cellSize={cellSize}
          hoveredCellKey={hoveredCellKey}
          interactionDisabled={interactionDisabled}
          interactionModel={interactionModel}
          stride={stride}
          viewModel={viewModel}
          onCellClick={onCellClick}
          onHoveredCellChange={setHoveredCellKey}
        />
        <ObjectLayer cellSize={cellSize} stride={stride} viewModel={viewModel} />
        <UnitLayer
          cellSize={cellSize}
          interactionDisabled={interactionDisabled}
          selectedUnitId={selectedUnitId}
          stride={stride}
          viewModel={viewModel}
          onSelectedUnitChange={onSelectedUnitChange}
        />
        <CombatEffect cellSize={cellSize} event={visualEvent} stride={stride} />
      </pixiContainer>
    </CameraWorld>
  );
}

function CameraWorld({
  camera,
  children,
  height,
  visualEvent,
  width,
}: {
  camera: BoardCamera;
  children: React.ReactNode;
  height: number;
  visualEvent?: BattlefieldVisualEvent;
  width: number;
}) {
  const containerRef = useRef<Container>(null);
  const effectAge = useRef(Number.POSITIVE_INFINITY);
  useEffect(() => { effectAge.current = 0; }, [visualEvent?.id]);
  useTick((ticker) => {
    effectAge.current += ticker.deltaMS;
    const strength = visualEvent?.damage && effectAge.current > 430 && effectAge.current < 720
      ? (1 - (effectAge.current - 430) / 290) * Math.min(7, 2 + visualEvent.damage)
      : 0;
    const container = containerRef.current;
    if (!container) return;
    container.position.set(
      width / 2 + camera.x + Math.sin(effectAge.current * 0.19) * strength,
      height / 2 + camera.y + Math.cos(effectAge.current * 0.23) * strength,
    );
    container.scale.set(camera.zoom);
  });

  return <pixiContainer ref={containerRef}>{children}</pixiContainer>;
}

function TerrainLayer({
  cellSize,
  stride,
  viewModel,
}: { cellSize: number; stride: number; viewModel: BoardViewModel }) {
  return (
    <pixiContainer eventMode="none">
      {viewModel.positions.map(({ x, y }) => {
        const tile = viewModel.tilesByPosition.get(boardPositionKey(x, y));
        return (
          <TerrainCell
            cellSize={cellSize}
            key={`${x},${y}`}
            terrainType={tile?.terrainType ?? "Open"}
            x={x * stride}
            y={y * stride}
          />
        );
      })}
    </pixiContainer>
  );
}

function TerrainCell({
  cellSize,
  terrainType,
  x,
  y,
}: { cellSize: number; terrainType: TerrainType; x: number; y: number }) {
  const texture = usePixiTexture(getTerrainTextureUrl(terrainType));
  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={(graphics) => {
        graphics.clear().roundRect(0, 0, cellSize, cellSize, 6)
          .fill({ color: getTerrainColor(terrainType) });
      }} />
      {texture ? (
        <pixiSprite
          alpha={0.78}
          height={cellSize}
          texture={texture}
          width={cellSize}
        />
      ) : null}
      <pixiGraphics draw={(graphics) => {
        graphics.clear().roundRect(0, 0, cellSize, cellSize, 6)
          .fill({ color: 0x081019, alpha: 0.14 })
          .stroke({ color: 0x66788b, alpha: 0.55, width: 1 });
      }} />
      <pixiText
        text={`${x / (cellSize + CELL_GAP) | 0},${y / (cellSize + CELL_GAP) | 0}`}
        x={6}
        y={5}
        style={{ fill: 0xd7e4f2, fontFamily: "Arial", fontSize: 9, fontWeight: "700" }}
      />
      <pixiText
        text={getTerrainLabel(terrainType)}
        x={6}
        y={cellSize - 16}
        style={{ fill: 0xe4edf6, fontFamily: "Arial", fontSize: 8, fontWeight: "700" }}
      />
    </pixiContainer>
  );
}

function TerritoryLayer({ cellSize, stride, viewModel }: LayerProps) {
  return (
    <pixiContainer eventMode="none">
      {viewModel.positions.map(({ x, y }) => {
        const territory = viewModel.territoryByPosition.get(boardPositionKey(x, y));
        if (!territory) return null;
        return <pixiGraphics key={`${x},${y}`} x={x * stride} y={y * stride} draw={(graphics) => {
          graphics.clear().roundRect(2, 2, cellSize - 4, cellSize - 4, 5)
            .stroke({ color: getTerritoryColor(territory.faction) ?? 0xffffff, alpha: 0.95, width: 3 });
        }} />;
      })}
    </pixiContainer>
  );
}

function ObjectLayer({ cellSize, stride, viewModel }: LayerProps) {
  return (
    <pixiContainer eventMode="none">
      {viewModel.positions.map(({ x, y }) => {
        const object = viewModel.objectsByPosition.get(boardPositionKey(x, y));
        if (!object) return null;
        return (
          <pixiContainer key={object.id} x={x * stride + cellSize - 28} y={y * stride + 16}>
            <pixiGraphics draw={(graphics) => {
              graphics.clear().roundRect(-22, -11, 44, 22, 5)
                .fill({ color: 0x10151c, alpha: 0.94 })
                .stroke({ color: object.status === "Destroyed" ? 0x65707c : 0xffe56b, width: 1.5 });
            }} />
            <pixiText
              anchor={0.5}
              text={`${getObjectCode(object.type)} ${object.currentHp}/${object.maxHp}`}
              style={{ fill: 0xfff27a, fontFamily: "Arial", fontSize: 8, fontWeight: "800" }}
            />
          </pixiContainer>
        );
      })}
    </pixiContainer>
  );
}

function UnitLayer({
  cellSize,
  interactionDisabled,
  selectedUnitId,
  stride,
  viewModel,
  onSelectedUnitChange,
}: LayerProps & Pick<BoardRendererProps, "interactionDisabled" | "selectedUnitId" | "onSelectedUnitChange">) {
  const tokens = useMemo(() => viewModel.positions.flatMap(({ x, y }) =>
    (viewModel.unitsByPosition.get(boardPositionKey(x, y)) ?? []).map((token, index, stack) => ({
      token,
      x: x * stride + cellSize / 2 + (index - (stack.length - 1) / 2) * Math.min(24, cellSize * 0.25),
      y: y * stride + cellSize / 2,
    }))), [cellSize, stride, viewModel]);
  const radius = Math.max(14, Math.min(25, cellSize * 0.28));

  return (
    <pixiContainer>
      {tokens.map(({ token, x, y }) => (
        <AnimatedUnitToken
          interactionDisabled={interactionDisabled}
          key={token.unitId}
          radius={radius}
          selected={token.unitId === selectedUnitId}
          targetX={x}
          targetY={y}
          token={token}
          onSelectedUnitChange={onSelectedUnitChange}
        />
      ))}
    </pixiContainer>
  );
}

function AnimatedUnitToken({
  interactionDisabled,
  radius,
  selected,
  targetX,
  targetY,
  token,
  onSelectedUnitChange,
}: {
  interactionDisabled: boolean;
  radius: number;
  selected: boolean;
  targetX: number;
  targetY: number;
  token: BoardTokenViewModel;
  onSelectedUnitChange: (unitId: string) => void;
}) {
  const containerRef = useRef<Container>(null);
  const ringRef = useRef<Graphics>(null);
  const initialized = useRef(false);
  const target = useRef({ x: targetX, y: targetY });
  const texture = usePixiTexture(token.imageUrl);
  target.current = { x: targetX, y: targetY };

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container && !initialized.current) {
      container.position.set(targetX, targetY);
      initialized.current = true;
    }
  }, [targetX, targetY]);

  useTick((ticker) => {
    const container = containerRef.current;
    if (!container) return;
    const easing = 1 - Math.exp(-ticker.deltaMS / 105);
    container.x += (target.current.x - container.x) * easing;
    container.y += (target.current.y - container.y) * easing;
    container.alpha += ((token.status === "Destroyed" ? 0.38 : 1) - container.alpha) * easing;
    if (ringRef.current) {
      const pulse = selected ? 1 + Math.sin(performance.now() * 0.006) * 0.08 : 1;
      ringRef.current.scale.set(pulse);
      ringRef.current.alpha = selected ? 0.9 : 0.48;
    }
  });

  return (
    <pixiContainer
      cursor={interactionDisabled ? "default" : "pointer"}
      eventMode={interactionDisabled ? "none" : "static"}
      hitArea={new Rectangle(-radius - 5, -radius - 5, radius * 2 + 10, radius * 2 + 18)}
      onPointerTap={(event: FederatedPointerEvent) => {
        event.stopPropagation();
        onSelectedUnitChange(token.unitId);
      }}
      ref={containerRef}
    >
      <pixiGraphics ref={ringRef} draw={(graphics) => {
        graphics.clear().circle(0, 0, radius + 4)
          .fill({ color: selected ? 0xffef67 : getFactionColor(token.faction), alpha: selected ? 0.22 : 0.12 })
          .stroke({ color: selected ? 0xffef67 : getFactionColor(token.faction), width: selected ? 3 : 2 });
      }} />
      <pixiGraphics draw={(graphics) => {
        graphics.clear().circle(0, 0, radius)
          .fill({ color: getFactionColor(token.faction) })
          .stroke({ color: 0xe8f1f9, width: 1.5 });
      }} />
      {texture ? (
        <pixiSprite
          anchor={0.5}
          height={radius * 1.82}
          texture={texture}
          width={radius * 1.82}
        />
      ) : null}
      <pixiGraphics draw={(graphics) => {
        graphics.clear().roundRect(-radius * 0.72, radius * 0.28, radius * 1.44, radius * 0.48, 3)
          .fill({ color: 0x071019, alpha: 0.82 });
      }} />
      <pixiText
        anchor={0.5}
        text={token.initials}
        y={radius * 0.52}
        style={{ fill: 0xffffff, fontFamily: "Arial", fontSize: Math.max(7, radius * 0.42), fontWeight: "800" }}
      />
      <HealthBar radius={radius} targetRatio={token.healthRatio} />
      <pixiGraphics x={radius * 0.72} y={-radius * 0.72} draw={(graphics) => {
        graphics.clear().circle(0, 0, 6).fill({ color: getStatusColor(token.status) })
          .stroke({ color: 0xffffff, width: 1 });
      }} />
      <pixiText
        anchor={0.5}
        text={getStatusCode(token.status)}
        x={radius * 0.72}
        y={-radius * 0.72}
        style={{ fill: 0xffffff, fontFamily: "Arial", fontSize: 7, fontWeight: "800" }}
      />
    </pixiContainer>
  );
}

function HealthBar({ radius, targetRatio }: { radius: number; targetRatio: number }) {
  const graphicsRef = useRef<Graphics>(null);
  const ratio = useRef(targetRatio);
  useTick((ticker) => {
    ratio.current += (targetRatio - ratio.current) * (1 - Math.exp(-ticker.deltaMS / 140));
    const graphics = graphicsRef.current;
    if (!graphics) return;
    const width = radius * 2.1;
    const y = radius + 4;
    graphics.clear().roundRect(-width / 2, y, width, 6, 3)
      .fill({ color: 0x071019, alpha: 0.95 })
      .stroke({ color: 0xd9e2eb, width: 0.7 });
    graphics.roundRect(-width / 2 + 1, y + 1, Math.max(0, (width - 2) * ratio.current), 4, 2)
      .fill({ color: getHealthColor(ratio.current) });
  });
  return <pixiGraphics draw={() => undefined} ref={graphicsRef} />;
}

function InteractionLayer({
  cellSize,
  hoveredCellKey,
  interactionDisabled,
  interactionModel,
  stride,
  viewModel,
  onCellClick,
  onHoveredCellChange,
}: LayerProps & Pick<BoardRendererProps, "interactionDisabled" | "interactionModel" | "onCellClick"> & {
  hoveredCellKey?: string;
  onHoveredCellChange: (key?: string) => void;
}) {
  return (
    <pixiContainer>
      {viewModel.positions.map(({ x, y }) => {
        const key = boardPositionKey(x, y);
        const interaction = getBoardCellInteraction(interactionModel, x, y);
        const hovered = hoveredCellKey === key && !interactionDisabled;
        return (
          <pixiContainer
            cursor={interactionDisabled ? "default" : interaction === "invalid" ? "not-allowed" : "crosshair"}
            eventMode={interactionDisabled ? "none" : "static"}
            hitArea={new Rectangle(0, 0, cellSize, cellSize)}
            key={key}
            onPointerTap={() => onCellClick(x, y)}
            onPointerOut={() => onHoveredCellChange(undefined)}
            onPointerOver={() => onHoveredCellChange(key)}
            x={x * stride}
            y={y * stride}
          >
            <pixiGraphics draw={(graphics) => {
              graphics.clear();
              if (interaction !== "default") {
                graphics.roundRect(2, 2, cellSize - 4, cellSize - 4, 5)
                  .fill({ color: interaction === "invalid" ? 0x10151c : getInteractionColor(interaction), alpha: interaction === "invalid" ? 0.32 : 0.18 })
                  .stroke({ color: getInteractionColor(interaction), alpha: 0.92, width: 3 });
              }
              if (hovered) {
                graphics.roundRect(2, 2, cellSize - 4, cellSize - 4, 5)
                  .fill({ color: getInteractionColor(interaction), alpha: 0.14 })
                  .stroke({ color: getInteractionColor(interaction), width: 3 });
              }
            }} />
          </pixiContainer>
        );
      })}
    </pixiContainer>
  );
}

function CombatEffect({
  cellSize,
  event,
  stride,
}: { cellSize: number; event?: BattlefieldVisualEvent; stride: number }) {
  const beamRef = useRef<Graphics>(null);
  const impactRef = useRef<Graphics>(null);
  const damageTextRef = useRef<PixiText>(null);
  const age = useRef(Number.POSITIVE_INFINITY);
  useEffect(() => { age.current = 0; }, [event?.id]);

  useTick((ticker) => {
    age.current += ticker.deltaMS;
    const beam = beamRef.current;
    const impact = impactRef.current;
    const damageText = damageTextRef.current;
    if (!beam || !impact || !damageText || !event) return;
    beam.clear();
    impact.clear();
    const source = cellCenter(event.source, cellSize, stride);
    const target = cellCenter(event.target, cellSize, stride);
    const color = getProjectileColor(event.faction);
    const progress = clamp(age.current / 430, 0, 1);
    if (progress < 1) {
      const eased = 1 - Math.pow(1 - progress, 3);
      const x = source.x + (target.x - source.x) * eased;
      const y = source.y + (target.y - source.y) * eased;
      beam.moveTo(source.x, source.y).lineTo(x, y).stroke({ color, alpha: 0.32, width: 7 });
      beam.moveTo(source.x, source.y).lineTo(x, y).stroke({ color: 0xffffff, alpha: 0.95, width: 2 });
      beam.circle(x, y, 5).fill({ color: 0xffffff }).circle(x, y, 10).stroke({ color, alpha: 0.8, width: 2 });
    }
    const impactProgress = clamp((age.current - 400) / 430, 0, 1);
    if (impactProgress > 0 && impactProgress < 1) {
      const radius = 8 + impactProgress * cellSize * 0.38;
      impact.circle(target.x, target.y, radius).stroke({ color: event.damage > 0 ? 0xffc857 : 0x8ad4ff, alpha: 1 - impactProgress, width: 4 });
      for (let index = 0; index < 8; index += 1) {
        const angle = index * Math.PI / 4 + event.id;
        const distance = radius * (0.55 + (index % 3) * 0.15);
        impact.circle(target.x + Math.cos(angle) * distance, target.y + Math.sin(angle) * distance, 2.2)
          .fill({ color, alpha: 1 - impactProgress });
      }
    }
    damageText.text = event.damage > 0 ? `-${event.damage} PW` : "ODBITY";
    damageText.position.set(target.x, target.y - cellSize * 0.18 - impactProgress * 25);
    damageText.alpha = impactProgress > 0 ? Math.sin(impactProgress * Math.PI) : 0;
    damageText.scale.set(event.destroyed ? 1.18 : 1);
  });

  return (
    <pixiContainer eventMode="none" isRenderGroup>
      <pixiGraphics draw={() => undefined} ref={beamRef} />
      <pixiGraphics draw={() => undefined} ref={impactRef} />
      <pixiText
        anchor={0.5}
        ref={damageTextRef}
        style={{ fill: 0xffffff, fontFamily: "Arial", fontSize: Math.max(12, cellSize * 0.14), fontWeight: "900", stroke: { color: 0x10151c, width: 4 } }}
      />
    </pixiContainer>
  );
}

function usePixiTexture(url?: string): Texture | undefined {
  const [texture, setTexture] = useState<Texture>();
  useEffect(() => {
    let active = true;
    setTexture(undefined);
    if (!url) return () => { active = false; };
    void Assets.load<Texture>(url).then((loaded) => {
      if (active) setTexture(loaded);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [url]);
  return texture;
}

type LayerProps = { cellSize: number; stride: number; viewModel: BoardViewModel };

function cellCenter(position: { x: number; y: number }, cellSize: number, stride: number) {
  return { x: position.x * stride + cellSize / 2, y: position.y * stride + cellSize / 2 };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getTerrainTextureUrl(terrainType: TerrainType): string {
  switch (terrainType) {
    case "LightCover": return "/terrain-textures/light-cover.png";
    case "HeavyCover": return "/terrain-textures/heavy-cover.png";
    case "Building": return "/terrain-textures/building.png";
    case "DifficultTerrain": return "/terrain-textures/difficult-terrain.png";
    default: return "/terrain-textures/open.png";
  }
}

function getTerrainColor(terrainType: TerrainType): number {
  switch (terrainType) {
    case "LightCover": return 0x263a30;
    case "HeavyCover": return 0x35343d;
    case "Building": return 0x303a40;
    case "DifficultTerrain": return 0x493b27;
    default: return 0x242c34;
  }
}

function getTerrainLabel(terrainType: TerrainType): string {
  switch (terrainType) {
    case "LightCover": return "OSŁONA";
    case "HeavyCover": return "CIĘŻKA";
    case "Building": return "BUDYNEK";
    case "DifficultTerrain": return "TRUDNY";
    default: return "OTWARTY";
  }
}

function getInteractionColor(interaction: BoardCellInteraction): number {
  switch (interaction) {
    case "legal": return 0x55d98a;
    case "reserve": return 0x4da3ff;
    case "target": return 0xff626d;
    case "invalid": return 0x8d4248;
    case "selected": return 0xc77dff;
    default: return 0xffef67;
  }
}

function getFactionColor(faction?: FactionId): number {
  if (faction === "Republic") return 0x347dcc;
  if (faction === "Separatists") return 0xa83f4a;
  return 0x6b7480;
}

function getTerritoryColor(faction?: FactionId): number | undefined {
  if (faction === "Republic") return 0x4191ff;
  if (faction === "Separatists") return 0xe74c5a;
  return undefined;
}

function getProjectileColor(faction?: FactionId): number {
  if (faction === "Republic") return 0x57b8ff;
  if (faction === "Separatists") return 0xff4d5d;
  return 0xffef67;
}

function getHealthColor(ratio: number): number {
  if (ratio <= 0.25) return 0xff626d;
  if (ratio <= 0.5) return 0xf2c94c;
  return 0x55d98a;
}

function getStatusColor(status: "Ready" | "Activated" | "Destroyed" | "Pinned"): number {
  switch (status) {
    case "Ready": return 0x2f9b61;
    case "Activated": return 0x5f6b78;
    case "Destroyed": return 0x171b21;
    case "Pinned": return 0xd59a2f;
  }
}

function getStatusCode(status: "Ready" | "Activated" | "Destroyed" | "Pinned"): string {
  switch (status) {
    case "Ready": return "R";
    case "Activated": return "A";
    case "Destroyed": return "X";
    case "Pinned": return "P";
  }
}

function getObjectCode(type: BattlefieldObjectType): string {
  switch (type) {
    case "DefensePoint": return "P";
    case "StrategicPoint": return "★";
    case "Generator": return "G";
    case "LightFortification": return "L";
    case "HeavyFortification": return "H";
  }
}
