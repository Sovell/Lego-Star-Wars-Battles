import { Application, extend } from "@pixi/react";
import { useLayoutEffect, useRef, useState } from "react";
import {
  Container,
  type FederatedPointerEvent,
  Graphics,
  Rectangle,
  Text as PixiText,
} from "pixi.js";
import type { BattlefieldObjectType, FactionId, TerrainType } from "../types";
import { calculateSquareBoardLayout } from "./board-layout";
import { boardPositionKey } from "./board-view-model";
import { getBoardCellInteraction, type BoardCellInteraction } from "./board-interaction-model";
import type { BoardRendererProps } from "./board-renderer";

extend({
  Container,
  Graphics,
  Text: PixiText,
});

const BOARD_PADDING = 10;
const CELL_GAP = 4;

export function PixiMapBoard(props: BoardRendererProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const updateSize = () => {
      const bounds = host.getBoundingClientRect();
      const nextSize = {
        width: Math.max(1, Math.floor(bounds.width)),
        height: Math.max(1, Math.floor(bounds.height)),
      };
      setSize((current) =>
        current.width === nextSize.width && current.height === nextSize.height
          ? current
          : nextSize
      );
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    updateSize();
    let settleFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      updateSize();
      settleFrame = requestAnimationFrame(updateSize);
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(settleFrame);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      aria-label="Eksperymentalny renderer Pixi planszy"
      className="pixiMapBoard"
      ref={hostRef}
    >
      {size.width > 0 && size.height > 0 ? (
        <Application
          antialias
          backgroundColor={0x11161d}
          height={size.height}
          key={`${size.width}x${size.height}`}
          resolution={1}
          width={size.width}
        >
          <PixiBoardScene {...props} height={size.height} width={size.width} />
        </Application>
      ) : null}
    </div>
  );
}

function PixiBoardScene({
  height,
  interactionDisabled,
  interactionModel,
  selectedUnitId,
  viewModel,
  width,
  onCellClick,
  onSelectedUnitChange,
}: BoardRendererProps & {
  height: number;
  width: number;
}) {
  const [hoveredCellKey, setHoveredCellKey] = useState<string>();
  const {
    cellSize,
    x: boardX,
    y: boardY,
  } = calculateSquareBoardLayout({
    columns: viewModel.width,
    gap: CELL_GAP,
    height,
    padding: BOARD_PADDING,
    rows: viewModel.height,
    width,
  });
  const tokenRadius = Math.max(10, Math.min(18, cellSize * 0.27));

  return (
    <pixiContainer x={boardX} y={boardY}>
      {viewModel.positions.map(({ x, y }) => {
        const key = boardPositionKey(x, y);
        const tile = viewModel.tilesByPosition.get(key);
        const object = viewModel.objectsByPosition.get(key);
        const territory = viewModel.territoryByPosition.get(key);
        const tokens = viewModel.unitsByPosition.get(key) ?? [];
        const cellX = x * (cellSize + CELL_GAP);
        const cellY = y * (cellSize + CELL_GAP);
        const hovered = hoveredCellKey === key && !interactionDisabled;
        const cellInteraction = getBoardCellInteraction(interactionModel, x, y);

        return (
          <pixiContainer
            cursor={interactionDisabled ? "default" : "crosshair"}
            eventMode={interactionDisabled ? "none" : "static"}
            hitArea={new Rectangle(0, 0, cellSize, cellSize)}
            key={key}
            onPointerOut={() => setHoveredCellKey((current) => current === key ? undefined : current)}
            onPointerOver={() => setHoveredCellKey(key)}
            onPointerDown={() => onCellClick(x, y)}
            x={cellX}
            y={cellY}
          >
            <pixiGraphics
              draw={(graphics) => {
                graphics.clear();
                graphics
                  .roundRect(0, 0, cellSize, cellSize, 5)
                  .fill({ color: getTerrainColor(tile?.terrainType), alpha: 1 })
                  .stroke({
                    color: hovered
                      ? getInteractionColor(cellInteraction)
                      : cellInteraction === "invalid"
                        ? getTerritoryColor(territory?.faction) ?? 0x39434f
                        : getInteractionColor(
                            cellInteraction,
                            getTerritoryColor(territory?.faction) ?? 0x39434f,
                          ),
                    width: hovered
                      ? 3
                      : cellInteraction !== "default" && cellInteraction !== "invalid"
                        ? 3
                        : territory
                          ? 3
                          : 1,
                    alpha: hovered || territory ? 0.95 : 0.8,
                  });
                if (cellInteraction !== "default") {
                  graphics
                    .roundRect(2, 2, cellSize - 4, cellSize - 4, 4)
                    .fill({
                      color: cellInteraction === "invalid"
                        ? 0x10151c
                        : getInteractionColor(cellInteraction),
                      alpha: cellInteraction === "invalid" ? 0.24 : 0.16,
                    });
                }
                if (hovered) {
                  graphics
                    .roundRect(2, 2, cellSize - 4, cellSize - 4, 4)
                    .fill({ color: getInteractionColor(cellInteraction), alpha: 0.12 });
                }
              }}
            />
            <pixiText
              text={`${x},${y}`}
              x={6}
              y={5}
              style={{
                fill: 0xaec0d3,
                fontFamily: "Arial",
                fontSize: Math.max(9, Math.min(12, cellSize * 0.13)),
                fontWeight: "700",
              }}
            />
            {tile ? (
              <pixiText
                text={getTerrainLabel(tile.terrainType)}
                x={6}
                y={cellSize - 17}
                style={{
                  fill: 0xd3dbe4,
                  fontFamily: "Arial",
                  fontSize: Math.max(8, Math.min(10, cellSize * 0.11)),
                  fontWeight: "600",
                }}
              />
            ) : null}
            {object ? (
              <>
                <pixiGraphics
                  draw={(graphics) => {
                    graphics.clear();
                    graphics
                      .roundRect(cellSize - 49, 5, 44, 22, 5)
                      .fill({ color: 0x171b21, alpha: 0.92 })
                      .stroke({ color: 0xece06c, width: 1.5 });
                  }}
                />
                <pixiText
                  anchor={0.5}
                  text={`${getObjectCode(object.type)} ${object.currentHp}/${object.maxHp}`}
                  x={cellSize - 27}
                  y={16}
                  style={{
                    fill: object.status === "Destroyed" ? 0x7c858f : 0xfff27a,
                    fontFamily: "Arial",
                    fontSize: Math.max(7, Math.min(9, cellSize * 0.1)),
                    fontWeight: "800",
                  }}
                />
              </>
            ) : null}
            {tokens.map((token, index) => {
              const tokenX = cellSize / 2 + (index - (tokens.length - 1) / 2) * (tokenRadius * 1.5);
              const tokenY = cellSize / 2;
              const selected = token.unitId === selectedUnitId;

              return (
                <pixiContainer
                  cursor={interactionDisabled ? "default" : "pointer"}
                  eventMode={interactionDisabled ? "none" : "static"}
                  key={token.unitId}
                  onPointerDown={(event: FederatedPointerEvent) => {
                    event.stopPropagation();
                    onSelectedUnitChange(token.unitId);
                  }}
                  x={tokenX}
                  y={tokenY}
                >
                  <pixiGraphics
                    draw={(graphics) => {
                      graphics.clear();
                      graphics
                        .circle(0, 0, tokenRadius)
                        .fill({
                          color: getFactionColor(token.faction),
                          alpha: token.unit.status === "Destroyed" ? 0.42 : 1,
                        })
                        .stroke({
                          color: selected ? 0xffef67 : 0xd9e2eb,
                          width: selected ? 4 : 2,
                        });
                    }}
                  />
                  <pixiText
                    anchor={0.5}
                    text={token.initials}
                    style={{
                      fill: 0xffffff,
                      fontFamily: "Arial",
                      fontSize: Math.max(8, tokenRadius * 0.58),
                      fontWeight: "800",
                    }}
                  />
                  <pixiGraphics
                    draw={(graphics) => {
                      const barWidth = tokenRadius * 2.15;
                      const barY = tokenRadius + 3;
                      graphics.clear();
                      graphics
                        .roundRect(-barWidth / 2, barY, barWidth, 5, 2)
                        .fill({ color: 0x10151c, alpha: 0.96 })
                        .stroke({ color: 0xd9e2eb, width: 0.7, alpha: 0.8 });
                      graphics
                        .roundRect(
                          -barWidth / 2 + 1,
                          barY + 1,
                          Math.max(0, (barWidth - 2) * token.healthRatio),
                          3,
                          1,
                        )
                        .fill({ color: getHealthColor(token.healthState), alpha: 1 });
                      graphics
                        .circle(tokenRadius * 0.72, -tokenRadius * 0.72, 5.5)
                        .fill({ color: getStatusColor(token.status), alpha: 1 })
                        .stroke({ color: 0xf3f6fa, width: 1 });
                    }}
                  />
                  <pixiText
                    anchor={0.5}
                    text={getStatusCode(token.status)}
                    x={tokenRadius * 0.72}
                    y={-tokenRadius * 0.72}
                    style={{
                      fill: 0xffffff,
                      fontFamily: "Arial",
                      fontSize: 6.5,
                      fontWeight: "800",
                    }}
                  />
                  <pixiText
                    anchor={0.5}
                    text={`${token.currentHp}/${token.maxHp}`}
                    y={tokenRadius + 12}
                    style={{
                      fill: 0xe9f0f7,
                      fontFamily: "Arial",
                      fontSize: Math.max(6.5, Math.min(8, cellSize * 0.08)),
                      fontWeight: "700",
                    }}
                  />
                </pixiContainer>
              );
            })}
          </pixiContainer>
        );
      })}
    </pixiContainer>
  );
}

function getHealthColor(healthState: "healthy" | "warning" | "critical"): number {
  if (healthState === "critical") return 0xff626d;
  if (healthState === "warning") return 0xf2c94c;
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

function getInteractionColor(
  interaction: BoardCellInteraction,
  fallback?: number,
): number {
  switch (interaction) {
    case "legal": return 0x55d98a;
    case "reserve": return 0x4da3ff;
    case "target": return 0xff626d;
    case "invalid": return 0x8d4248;
    case "selected": return 0xc77dff;
    default: return fallback ?? 0xffef67;
  }
}

function getTerrainColor(terrainType?: TerrainType): number {
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
    case "LightCover": return "LIGHT";
    case "HeavyCover": return "HEAVY";
    case "Building": return "BUILDING";
    case "DifficultTerrain": return "DIFFICULT";
    default: return terrainType.toUpperCase();
  }
}

function getFactionColor(faction?: FactionId): number {
  if (faction === "Republic") {
    return 0x347dcc;
  }
  if (faction === "Separatists") {
    return 0xa83f4a;
  }
  return 0x6b7480;
}

function getTerritoryColor(faction?: FactionId): number | undefined {
  if (faction === "Republic") {
    return 0x4191ff;
  }
  if (faction === "Separatists") {
    return 0xe74c5a;
  }
  return undefined;
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
