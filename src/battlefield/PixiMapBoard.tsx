import { Application, extend } from "@pixi/react";
import { useLayoutEffect, useRef, useState } from "react";
import {
  Container,
  Graphics,
  Text as PixiText,
} from "pixi.js";
import type { BattlefieldObjectType, FactionId, TerrainType } from "../types";
import { boardPositionKey } from "./board-view-model";
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
      setSize({
        width: Math.max(1, Math.floor(bounds.width)),
        height: Math.max(1, Math.floor(bounds.height)),
      });
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    return () => observer.disconnect();
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
  selectedUnitId,
  viewModel,
  width,
  onSelectedUnitChange,
}: BoardRendererProps & {
  height: number;
  width: number;
}) {
  const cellWidth = Math.max(
    1,
    (width - BOARD_PADDING * 2 - CELL_GAP * (viewModel.width - 1)) / viewModel.width,
  );
  const cellHeight = Math.max(
    1,
    (height - BOARD_PADDING * 2 - CELL_GAP * (viewModel.height - 1)) / viewModel.height,
  );
  const tokenRadius = Math.max(10, Math.min(18, Math.min(cellWidth, cellHeight) * 0.27));

  return (
    <pixiContainer x={BOARD_PADDING} y={BOARD_PADDING}>
      {viewModel.positions.map(({ x, y }) => {
        const key = boardPositionKey(x, y);
        const tile = viewModel.tilesByPosition.get(key);
        const object = viewModel.objectsByPosition.get(key);
        const territory = viewModel.territoryByPosition.get(key);
        const tokens = viewModel.unitsByPosition.get(key) ?? [];
        const cellX = x * (cellWidth + CELL_GAP);
        const cellY = y * (cellHeight + CELL_GAP);

        return (
          <pixiContainer key={key} x={cellX} y={cellY}>
            <pixiGraphics
              draw={(graphics) => {
                graphics.clear();
                graphics
                  .roundRect(0, 0, cellWidth, cellHeight, 5)
                  .fill({ color: getTerrainColor(tile?.terrainType), alpha: 1 })
                  .stroke({
                    color: getTerritoryColor(territory?.faction) ?? 0x39434f,
                    width: territory ? 3 : 1,
                    alpha: territory ? 0.95 : 0.8,
                  });
              }}
            />
            <pixiText
              text={`${x},${y}`}
              x={6}
              y={5}
              style={{
                fill: 0xaec0d3,
                fontFamily: "Arial",
                fontSize: Math.max(9, Math.min(12, cellHeight * 0.13)),
                fontWeight: "700",
              }}
            />
            {tile ? (
              <pixiText
                text={getTerrainLabel(tile.terrainType)}
                x={6}
                y={cellHeight - 17}
                style={{
                  fill: 0xd3dbe4,
                  fontFamily: "Arial",
                  fontSize: Math.max(8, Math.min(10, cellHeight * 0.11)),
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
                      .roundRect(cellWidth - 27, 5, 22, 22, 5)
                      .fill({ color: 0x171b21, alpha: 0.92 })
                      .stroke({ color: 0xece06c, width: 1.5 });
                  }}
                />
                <pixiText
                  anchor={0.5}
                  text={getObjectCode(object.type)}
                  x={cellWidth - 16}
                  y={16}
                  style={{
                    fill: object.status === "Destroyed" ? 0x7c858f : 0xfff27a,
                    fontFamily: "Arial",
                    fontSize: 13,
                    fontWeight: "800",
                  }}
                />
              </>
            ) : null}
            {tokens.map((token, index) => {
              const tokenX = cellWidth / 2 + (index - (tokens.length - 1) / 2) * (tokenRadius * 1.5);
              const tokenY = cellHeight / 2;
              const selected = token.unitId === selectedUnitId;

              return (
                <pixiContainer
                  cursor={interactionDisabled ? "default" : "pointer"}
                  eventMode={interactionDisabled ? "none" : "static"}
                  key={token.unitId}
                  onPointerTap={() => onSelectedUnitChange(token.unitId)}
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
                </pixiContainer>
              );
            })}
          </pixiContainer>
        );
      })}
    </pixiContainer>
  );
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
