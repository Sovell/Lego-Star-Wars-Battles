import { useMemo, useState } from "react";
import { abilities, starterArmies, taskForces, unitTemplates } from "./data";
import {
  applyOrder,
  createBattle,
  createLog,
  drawActivation,
  endTurn,
  getArmyCost,
  getTemplate,
  getVictoryState,
  moveUnit,
  resolveAttack,
} from "./game";
import type {
  Army,
  Battle,
  CombatLogEntry,
  FactionId,
  OrderType,
  TerrainTile,
  TerrainType,
  UnitInstance,
  UnitTemplate,
} from "./types";

type AppView = "battle" | "composer";
type DraftCounts = Record<string, number>;
type PendingAdvance = {
  attackerId: string;
  attackerName: string;
  defenderName: string;
  targetPosition: {
    x: number;
    y: number;
  };
};

const orders: OrderType[] = ["Advance", "Attack", "Rally", "Overwatch"];
const composerFactions: FactionId[] = ["Republic", "Separatists"];
const terrainPresets: TerrainTile[] = [
  {
    x: 0,
    y: 0,
    terrainType: "Open",
    defenseBonus: 0,
    attackBonus: 0,
    movementCost: 1,
    blocksLineOfSight: false,
  },
  {
    x: 0,
    y: 0,
    terrainType: "LightCover",
    defenseBonus: 1,
    attackBonus: 0,
    movementCost: 1,
    blocksLineOfSight: false,
  },
  {
    x: 0,
    y: 0,
    terrainType: "HeavyCover",
    defenseBonus: 2,
    attackBonus: 0,
    movementCost: 2,
    blocksLineOfSight: false,
  },
  {
    x: 0,
    y: 0,
    terrainType: "Building",
    defenseBonus: 2,
    attackBonus: 0,
    movementCost: 2,
    blocksLineOfSight: true,
  },
  {
    x: 0,
    y: 0,
    terrainType: "DifficultTerrain",
    defenseBonus: 0,
    attackBonus: 0,
    movementCost: 2,
    blocksLineOfSight: false,
  },
];

export function App() {
  const [view, setView] = useState<AppView>("battle");
  const [battle, setBattle] = useState<Battle>(() => createBattle());
  const [logs, setLogs] = useState<CombatLogEntry[]>([
    createLog(1, "Bitwa gotowa. W worku aktywacji sa tokeny obu armii."),
  ]);
  const [activeArmyId, setActiveArmyId] = useState<string | undefined>();
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [targetUnitId, setTargetUnitId] = useState<string>("");
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<OrderType>("Advance");
  const [armyJson, setArmyJson] = useState<string>(() => JSON.stringify(starterArmies, null, 2));
  const [importError, setImportError] = useState<string>("");
  const [debugMode, setDebugMode] = useState<boolean>(false);

  function addLog(message: string) {
    setLogs((current) => [createLog(battle.turn, message), ...current].slice(0, 12));
  }

  function loadArmies(armies: Army[], logMessage: string) {
    const nextBattle = createBattle(armies);
    setBattle(nextBattle);
    setActiveArmyId(undefined);
    setSelectedUnitId("");
    setTargetUnitId("");
    setArmyJson(JSON.stringify(armies, null, 2));
    setImportError("");
    setLogs([createLog(1, logMessage)]);
  }

  function handleUnitPatch(unitId: string, patch: Partial<UnitInstance>) {
    setBattle((current) => ({
      ...current,
      armies: current.armies.map((army) => ({
        ...army,
        units: army.units.map((unit) => (unit.id === unitId ? { ...unit, ...patch } : unit)),
      })),
    }));
  }

  function handleTerrainPaint(tile: TerrainTile) {
    setBattle((current) => {
      const otherTiles = current.board.tiles.filter(
        (existingTile) => existingTile.x !== tile.x || existingTile.y !== tile.y,
      );

      return {
        ...current,
        board: {
          ...current.board,
          tiles: tile.terrainType === "Open" ? otherTiles : [...otherTiles, tile],
        },
      };
    });
  }

  return (
    <main className="app">
      <section className="commandStrip">
        <div>
          <p className="eyebrow">LEGO Star Wars Battles</p>
          <h1>{view === "battle" ? "Panel dowodzenia" : "Army Composer"}</h1>
        </div>
        <nav className="viewTabs" aria-label="Widoki aplikacji">
          <button className={view === "battle" ? "active" : ""} onClick={() => setView("battle")}>
            Battle
          </button>
          <button
            className={view === "composer" ? "active" : ""}
            onClick={() => setView("composer")}
          >
            Composer
          </button>
        </nav>
        <label className="debugToggle">
          <input
            checked={debugMode}
            type="checkbox"
            onChange={(event) => setDebugMode(event.target.checked)}
          />
          Debug
        </label>
        <div className="turnCounter">
          <span>Tura</span>
          <strong>{battle.turn}</strong>
        </div>
        <div className="phasePill">{battle.phase}</div>
      </section>

      {view === "battle" ? (
        <BattleView
          activeArmyId={activeArmyId}
          armyJson={armyJson}
          battle={battle}
          debugMode={debugMode}
          importError={importError}
          logs={logs}
          selectedOrder={selectedOrder}
          selectedUnitId={selectedUnitId}
          selectedWeaponId={selectedWeaponId}
          targetUnitId={targetUnitId}
          onActiveArmyChange={setActiveArmyId}
          onAddLog={addLog}
          onArmyJsonChange={setArmyJson}
          onBattleChange={setBattle}
          onImportError={setImportError}
          onLoadArmies={loadArmies}
          onOrderChange={setSelectedOrder}
          onSelectedUnitChange={setSelectedUnitId}
          onSelectedWeaponChange={setSelectedWeaponId}
          onTargetUnitChange={setTargetUnitId}
          onTerrainPaint={handleTerrainPaint}
          onUnitPatch={handleUnitPatch}
        />
      ) : null}

      {view === "composer" ? (
        <ArmyComposerView
          currentArmies={battle.armies}
          onLoadArmies={(armies) => {
            loadArmies(armies, "Armie z Army Composera zostaly wczytane do bitwy.");
            setView("battle");
          }}
        />
      ) : null}
    </main>
  );
}

function BattleView({
  activeArmyId,
  armyJson,
  battle,
  debugMode,
  importError,
  logs,
  selectedOrder,
  selectedUnitId,
  selectedWeaponId,
  targetUnitId,
  onActiveArmyChange,
  onAddLog,
  onArmyJsonChange,
  onBattleChange,
  onImportError,
  onLoadArmies,
  onOrderChange,
  onSelectedUnitChange,
  onSelectedWeaponChange,
  onTargetUnitChange,
  onTerrainPaint,
  onUnitPatch,
}: {
  activeArmyId?: string;
  armyJson: string;
  battle: Battle;
  debugMode: boolean;
  importError: string;
  logs: CombatLogEntry[];
  selectedOrder: OrderType;
  selectedUnitId: string;
  selectedWeaponId: string;
  targetUnitId: string;
  onActiveArmyChange: (armyId: string | undefined) => void;
  onAddLog: (message: string) => void;
  onArmyJsonChange: (json: string) => void;
  onBattleChange: (battle: Battle) => void;
  onImportError: (error: string) => void;
  onLoadArmies: (armies: Army[], logMessage: string) => void;
  onOrderChange: (order: OrderType) => void;
  onSelectedUnitChange: (unitId: string) => void;
  onSelectedWeaponChange: (weaponId: string) => void;
  onTargetUnitChange: (unitId: string) => void;
  onTerrainPaint: (tile: TerrainTile) => void;
  onUnitPatch: (unitId: string, patch: Partial<UnitInstance>) => void;
}) {
  const [pendingAdvance, setPendingAdvance] = useState<PendingAdvance | null>(null);
  const [mapMode, setMapMode] = useState<"units" | "terrain">("units");
  const [selectedTerrain, setSelectedTerrain] = useState<TerrainType>("LightCover");
  const allUnits = useMemo(() => battle.armies.flatMap((army) => army.units), [battle.armies]);
  const selectedUnit = allUnits.find((unit) => unit.id === selectedUnitId);
  const selectedTemplate = selectedUnit ? getTemplate(selectedUnit) : undefined;
  const selectedArmy = selectedUnit
    ? battle.armies.find((army) => army.id === selectedUnit.armyId)
    : undefined;
  const selectedTerrainPreset =
    terrainPresets.find((terrain) => terrain.terrainType === selectedTerrain) ?? terrainPresets[0];
  const availableWeapons = selectedTemplate?.weapons ?? [];
  const activeWeaponId = availableWeapons.some((weapon) => weapon.id === selectedWeaponId)
    ? selectedWeaponId
    : availableWeapons[0]?.id || "";
  const availableTargets = allUnits.filter(
    (unit) => unit.armyId !== selectedUnit?.armyId && unit.status !== "Destroyed",
  );
  const unusedTokens = battle.activationBag.filter((token) => !token.used).length;

  function handleCellClick(x: number, y: number) {
    if (mapMode === "terrain") {
      onTerrainPaint({ ...selectedTerrainPreset, x, y });
      return;
    }

    if (!selectedUnit || selectedUnit.status === "Destroyed") {
      return;
    }

    if (debugMode) {
      onUnitPatch(selectedUnit.id, { position: { x, y } });
      return;
    }

    const result = moveUnit(battle, selectedUnit.id, { x, y });
    onBattleChange(result.battle);
    onActiveArmyChange(result.battle.activeActivation?.armyId);
    onAddLog(result.log);
  }

  function handleDrawActivation() {
    setPendingAdvance(null);
    const result = drawActivation(battle);
    onBattleChange(result.battle);
    onActiveArmyChange(result.token?.armyId);
    onAddLog(result.token ? result.log : "Worek aktywacji jest pusty. Czas zakonczyc ture.");
  }

  function handleOrder() {
    setPendingAdvance(null);
    const result = applyOrder(battle, selectedUnitId, selectedOrder);
    onBattleChange(result.battle);
    onActiveArmyChange(result.battle.activeActivation?.armyId);
    onAddLog(result.log);
  }

  function handleAttack() {
    const result = resolveAttack(battle, selectedUnitId, targetUnitId, activeWeaponId);
    onBattleChange(result.battle);
    onActiveArmyChange(result.battle.activeActivation?.armyId);
    onAddLog(result.log);

    if (result.result?.destroyed && result.result.defenderPosition) {
      const attacker = allUnits.find((unit) => unit.id === result.result?.attackerId);
      const defender = allUnits.find((unit) => unit.id === result.result?.defenderId);

      if (attacker && defender) {
        setPendingAdvance({
          attackerId: attacker.id,
          attackerName: getTemplate(attacker).name,
          defenderName: getTemplate(defender).name,
          targetPosition: result.result.defenderPosition,
        });
      }
    } else {
      setPendingAdvance(null);
    }

    if (result.battle.phase === "Finished") {
      onAddLog(getVictoryLog(result.battle));
    }
  }

  function handleEndTurn() {
    setPendingAdvance(null);
    const nextBattle = endTurn(battle);
    onBattleChange(nextBattle);
    onActiveArmyChange(undefined);
    onAddLog(`Tura ${battle.turn} zakonczona. Jednostki gotowe, suppression spada o 1.`);
    if (nextBattle.phase === "Finished") {
      onAddLog(getVictoryLog(nextBattle));
    }
  }

  function handleLoadArmies() {
    try {
      setPendingAdvance(null);
      const parsed = JSON.parse(armyJson) as Army[];
      if (!Array.isArray(parsed) || parsed.length < 2) {
        throw new Error("JSON musi zawierac tablice co najmniej dwoch armii.");
      }

      onLoadArmies(parsed, "Wczytano armie i przebudowano worek aktywacji.");
    } catch (error) {
      onImportError(error instanceof Error ? error.message : "Nie udalo sie wczytac armii.");
    }
  }

  function handleAdvanceAfterCombat() {
    if (!pendingAdvance) {
      return;
    }

    onUnitPatch(pendingAdvance.attackerId, { position: pendingAdvance.targetPosition });
    onAddLog(
      `${pendingAdvance.attackerName} zajmuje pozycje po ${pendingAdvance.defenderName}: ${pendingAdvance.targetPosition.x}, ${pendingAdvance.targetPosition.y}.`,
    );
    setPendingAdvance(null);
  }

  function handleHoldAfterCombat() {
    if (!pendingAdvance) {
      return;
    }

    onAddLog(`${pendingAdvance.attackerName} zostaje na swojej pozycji po starciu.`);
    setPendingAdvance(null);
  }

  return (
    <section className="commandLayout">
      <aside className="sidePanel commandPanel">
        <PanelTitle title="Mapa" detail={mapMode === "units" ? "oddzialy" : "teren"} />
        <div className="segmented mapModeSwitch">
          <button className={mapMode === "units" ? "active" : ""} onClick={() => setMapMode("units")}>
            Oddzialy
          </button>
          <button className={mapMode === "terrain" ? "active" : ""} onClick={() => setMapMode("terrain")}>
            Teren
          </button>
        </div>

        {mapMode === "units" ? (
          <>
            <select value={selectedUnitId} onChange={(event) => onSelectedUnitChange(event.target.value)}>
              <option value="">Wybierz oddzial</option>
              {allUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {getTemplate(unit).name} -{" "}
                  {unit.position ? `${unit.position.x},${unit.position.y}` : "rezerwa"}
                </option>
              ))}
            </select>
            <UnitDetails
              debugMode={debugMode}
              selectedArmy={selectedArmy}
              selectedUnit={selectedUnit}
              onUnitPatch={onUnitPatch}
            />
          </>
        ) : (
          <>
            <select
              value={selectedTerrain}
              onChange={(event) => setSelectedTerrain(event.target.value)}
            >
              {terrainPresets.map((terrain) => (
                <option key={terrain.terrainType} value={terrain.terrainType}>
                  {terrain.terrainType}
                </option>
              ))}
            </select>
            <div className="mapReadout">
              <strong>{selectedTerrainPreset.terrainType}</strong>
              <span>Obrona: +{selectedTerrainPreset.defenseBonus}</span>
              <span>Atak: +{selectedTerrainPreset.attackBonus}</span>
              <span>Koszt ruchu: {selectedTerrainPreset.movementCost}</span>
              <span>Blokuje LOS: {selectedTerrainPreset.blocksLineOfSight ? "tak" : "nie"}</span>
            </div>
          </>
        )}

        <PanelTitle title="Aktywacja" detail={`${unusedTokens}/${battle.activationBag.length}`} />
        <button className="primaryButton" onClick={handleDrawActivation}>
          Losuj aktywacje
        </button>
        <div className="tokenReadout">
          {activeArmyId
            ? `Aktywna armia: ${battle.armies.find((army) => army.id === activeArmyId)?.playerName}`
            : "Brak aktywnego tokena"}
        </div>

        <PanelTitle title="Rozkaz" detail={selectedOrder} />
        <div className="segmented">
          {orders.map((order) => (
            <button
              key={order}
              className={order === selectedOrder ? "active" : ""}
              onClick={() => onOrderChange(order)}
            >
              {order}
            </button>
          ))}
        </div>
        <button
          className="secondaryButton"
          onClick={handleOrder}
          disabled={!selectedUnitId || !activeArmyId}
        >
          Wydaj rozkaz
        </button>

        <PanelTitle title="Atak" detail="D6" />
        <select
          value={activeWeaponId}
          onChange={(event) => onSelectedWeaponChange(event.target.value)}
          disabled={!selectedUnitId}
        >
          <option value="">Wybierz bron</option>
          {availableWeapons.map((weapon) => (
            <option key={weapon.id} value={weapon.id}>
              {weapon.name} | R{weapon.range} A{weapon.attacks} D{weapon.damage}
            </option>
          ))}
        </select>
        <select value={targetUnitId} onChange={(event) => onTargetUnitChange(event.target.value)}>
          <option value="">Wybierz cel</option>
          {availableTargets.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {getTemplate(unit).name}
            </option>
          ))}
        </select>
        <button
          className="dangerButton"
          onClick={handleAttack}
          disabled={!selectedUnitId || !targetUnitId || !activeArmyId || !activeWeaponId}
        >
          Rozstrzygnij atak
        </button>
        {pendingAdvance ? (
          <div className="decisionPanel">
            <PanelTitle title="Po starciu" detail="wybor zwyciezcy" />
            <p>
              {pendingAdvance.attackerName} pokonal {pendingAdvance.defenderName}. Mozesz zajac
              opuszczone pole albo zostac na obecnej pozycji.
            </p>
            <div className="decisionActions">
              <button className="primaryButton" onClick={handleAdvanceAfterCombat}>
                Zajmij pozycje
              </button>
              <button className="secondaryButton" onClick={handleHoldAfterCombat}>
                Zostan
              </button>
            </div>
          </div>
        ) : null}
        <button className="secondaryButton" onClick={handleEndTurn}>
          Koniec tury
        </button>

        <details className="jsonDetails">
          <summary>Import armii JSON</summary>
          <textarea
            className="armyInput jsonInput"
            value={armyJson}
            spellCheck={false}
            wrap="off"
            onChange={(event) => onArmyJsonChange(event.target.value)}
          />
          {importError ? <p className="errorText">{importError}</p> : null}
          <button className="secondaryButton" onClick={handleLoadArmies}>
            Wczytaj armie
          </button>
        </details>
      </aside>

      <section className="battlefield commandMain">
        <MapBoard
          battle={battle}
          selectedUnitId={selectedUnitId}
          onCellClick={handleCellClick}
          onSelectedUnitChange={onSelectedUnitChange}
        />

        {battle.phase === "Finished" ? <BattleSummary battle={battle} /> : null}

        <details className="collapsiblePanel" open>
          <summary>Składy armii</summary>
          <div className="armiesGrid">
            {battle.armies.map((army) => (
              <ArmyColumn
                key={army.id}
                army={army}
                debugMode={debugMode}
                selectedUnitId={selectedUnitId}
                onSelect={onSelectedUnitChange}
                onPatch={onUnitPatch}
              />
            ))}
          </div>
        </details>

        <details className="logPanel collapsiblePanel" open>
          <summary>Dziennik bitwy</summary>
          <div className="logs">
            {logs.map((entry) => (
              <div className="logEntry" key={entry.id}>
                <span>T{entry.turn}</span>
                <p>{entry.message}</p>
              </div>
            ))}
          </div>
        </details>
      </section>
    </section>
  );
}

function BattleSummary({ battle }: { battle: Battle }) {
  const victory = getVictoryState(battle);
  const winner = battle.armies.find((army) => army.id === victory.winnerArmyId);

  return (
    <section className="battleSummary">
      <PanelTitle
        title="Podsumowanie bitwy"
        detail={winner ? `Zwyciezca: ${winner.playerName}` : "Brak zwyciezcy"}
      />
      <div className="summaryGrid">
        {battle.armies.map((army) => {
          const survivingUnits = army.units.filter((unit) => unit.status !== "Destroyed");
          const destroyedUnits = army.units.filter((unit) => unit.status === "Destroyed");
          const remainingHp = survivingUnits.reduce((total, unit) => total + unit.currentHp, 0);
          const suppression = survivingUnits.reduce((total, unit) => total + unit.suppression, 0);

          return (
            <article
              className={army.id === victory.winnerArmyId ? "summaryArmy winner" : "summaryArmy"}
              key={army.id}
            >
              <div className="summaryArmyHeader">
                <div>
                  <p className="eyebrow">{army.faction}</p>
                  <h3>{army.playerName}</h3>
                </div>
                <strong>{army.id === victory.winnerArmyId ? "Victory" : "Defeated"}</strong>
              </div>
              <div className="summaryStats">
                <span>Ocalałe: {survivingUnits.length}</span>
                <span>Straty: {destroyedUnits.length}</span>
                <span>HP: {remainingHp}</span>
                <span>Suppression: {suppression}</span>
              </div>
              <div className="summaryUnits">
                {army.units.map((unit) => (
                  <div className="summaryUnit" key={unit.id}>
                    <span>{getTemplate(unit).name}</span>
                    <small>
                      {unit.status} | HP {unit.currentHp}/{getTemplate(unit).maxHp} | SUP{" "}
                      {unit.suppression}
                    </small>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function UnitDetails({
  debugMode,
  selectedArmy,
  selectedUnit,
  onUnitPatch,
}: {
  debugMode: boolean;
  selectedArmy?: Army;
  selectedUnit?: UnitInstance;
  onUnitPatch: (unitId: string, patch: Partial<UnitInstance>) => void;
}) {
  if (!selectedUnit) {
    return (
      <div className="mapReadout">
        <span>Wybierz oddzial z listy albo kliknij token na mapie.</span>
      </div>
    );
  }

  const template = getTemplate(selectedUnit);

  return (
    <div className="mapReadout unitDetailPanel">
      <div className="unitPortrait">
        {template.imageUrl ? (
          <img
            key={template.imageUrl}
            src={template.imageUrl}
            alt={template.name}
            onLoad={(event) => {
              event.currentTarget.hidden = false;
            }}
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        ) : null}
        <div className="unitPortraitFallback">{getUnitInitials(template)}</div>
      </div>
      <div className="unitDetailHeader">
        <strong>{template.name}</strong>
        <span>{selectedArmy?.faction ?? "Unknown"} | {template.role}</span>
      </div>
      <div className="unitDetailStats">
        <span>HP {selectedUnit.currentHp}/{template.maxHp}</span>
        <span>SUP {selectedUnit.suppression}</span>
        <span>MOV {template.movement}</span>
        <span>SV {template.armorSave ? `${template.armorSave}+` : "-"}</span>
      </div>
      <span>Stan: {selectedUnit.position ? "na mapie" : "rezerwa / posilki"}</span>
      <span>
        Pole:{" "}
        {selectedUnit.position
          ? `${selectedUnit.position.x}, ${selectedUnit.position.y}`
          : "poza mapa"}
      </span>
      <div className="unitWeaponList">
        {template.weapons.map((weapon) => (
          <span key={weapon.id}>
            {weapon.name} | R{weapon.range} A{weapon.attacks} D{weapon.damage}
          </span>
        ))}
      </div>
      {debugMode ? (
        <>
          <button
            className="secondaryButton"
            disabled={!selectedUnit.position}
            onClick={() => onUnitPatch(selectedUnit.id, { position: null })}
          >
            Przenies do rezerw
          </button>
        </>
      ) : null}
    </div>
  );
}

function MapBoard({
  battle,
  selectedUnitId,
  onCellClick,
  onSelectedUnitChange,
}: {
  battle: Battle;
  selectedUnitId: string;
  onCellClick: (x: number, y: number) => void;
  onSelectedUnitChange: (unitId: string) => void;
}) {
  const units = battle.armies.flatMap((army) => army.units);

  return (
    <section
      className="mapBoard commandMapBoard"
      style={{ gridTemplateColumns: `repeat(${battle.board.width}, minmax(64px, 1fr))` }}
    >
      {Array.from({ length: battle.board.width * battle.board.height }, (_, index) => {
        const x = index % battle.board.width;
        const y = Math.floor(index / battle.board.width);
        const tile = battle.board.tiles.find((terrain) => terrain.x === x && terrain.y === y);
        const tileUnits = units.filter((unit) => unit.position?.x === x && unit.position.y === y);

        return (
          <button
            className={`mapCell ${tile?.terrainType ?? "Open"}`}
            key={`${x}-${y}`}
            onClick={() => onCellClick(x, y)}
          >
            <span className="cellCoords">
              {x},{y}
            </span>
            {tile ? <span className="terrainTag">{tile.terrainType}</span> : null}
            <div className="mapUnitStack">
              {tileUnits.map((unit) => {
                const template = getTemplate(unit);
                const army = battle.armies.find((candidate) => candidate.id === unit.armyId);

                return (
                  <span
                    className={`mapUnit ${getTokenClass(template, army?.faction)} ${
                      unit.id === selectedUnitId ? "selected" : ""
                    }`}
                    key={unit.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectedUnitChange(unit.id);
                    }}
                    title={`${template.name} | ${army?.faction ?? "Unknown"}`}
                  >
                    <span className="tokenHead">
                      <span className="tokenVisor" />
                      <span className="tokenMouth" />
                    </span>
                    <span className="tokenCode">{getUnitInitials(template)}</span>
                  </span>
                );
              })}
            </div>
          </button>
        );
      })}
    </section>
  );
}

function ArmyComposerView({
  currentArmies,
  onLoadArmies,
}: {
  currentArmies: Army[];
  onLoadArmies: (armies: Army[]) => void;
}) {
  const [leftName, setLeftName] = useState(currentArmies[0]?.playerName ?? "Gracz 1");
  const [leftFaction, setLeftFaction] = useState<FactionId>(currentArmies[0]?.faction ?? "Republic");
  const [leftCounts, setLeftCounts] = useState<DraftCounts>(() => countsFromArmy(currentArmies[0]));
  const [rightName, setRightName] = useState(currentArmies[1]?.playerName ?? "Gracz 2");
  const [rightFaction, setRightFaction] = useState<FactionId>(
    currentArmies[1]?.faction ?? "Separatists",
  );
  const [rightCounts, setRightCounts] = useState<DraftCounts>(() => countsFromArmy(currentArmies[1]));

  const armies = useMemo(
    () => [
      buildArmyFromDraft("army_player_1", leftName, leftFaction, leftCounts, 1),
      buildArmyFromDraft("army_player_2", rightName, rightFaction, rightCounts, 2),
    ],
    [leftCounts, leftFaction, leftName, rightCounts, rightFaction, rightName],
  );
  const generatedJson = JSON.stringify(armies, null, 2);

  return (
    <section className="composerLayout">
      <ComposerColumn
        counts={leftCounts}
        faction={leftFaction}
        playerName={leftName}
        sideLabel="Armia A"
        onCountsChange={setLeftCounts}
        onFactionChange={setLeftFaction}
        onPlayerNameChange={setLeftName}
      />
      <ComposerColumn
        counts={rightCounts}
        faction={rightFaction}
        playerName={rightName}
        sideLabel="Armia B"
        onCountsChange={setRightCounts}
        onFactionChange={setRightFaction}
        onPlayerNameChange={setRightName}
      />
      <aside className="composerSummary">
        <PanelTitle title="Gotowa lista" detail={`${getArmyCost(armies[0])} / ${getArmyCost(armies[1])} pkt`} />
        <ArmyPreview armies={armies} />
        <details className="jsonDetails">
          <summary>Eksport JSON</summary>
          <textarea
            className="armyInput jsonInput composerJson"
            value={generatedJson}
            readOnly
            spellCheck={false}
            wrap="off"
          />
        </details>
        <button className="primaryButton" onClick={() => onLoadArmies(armies)}>
          Wczytaj do bitwy
        </button>
      </aside>
    </section>
  );
}

function ComposerColumn({
  counts,
  faction,
  playerName,
  sideLabel,
  onCountsChange,
  onFactionChange,
  onPlayerNameChange,
}: {
  counts: DraftCounts;
  faction: FactionId;
  playerName: string;
  sideLabel: string;
  onCountsChange: (counts: DraftCounts) => void;
  onFactionChange: (faction: FactionId) => void;
  onPlayerNameChange: (name: string) => void;
}) {
  const templates = unitTemplates.filter((template) => template.faction === faction);
  const factionTaskForces = taskForces.filter((taskForce) => taskForce.faction === faction);
  const cost =
    templates.reduce((total, template) => total + (counts[template.id] ?? 0) * template.cost, 0) +
    factionTaskForces.reduce((total, taskForce) => total + (counts[taskForce.id] ?? 0) * taskForce.cost, 0);

  function setCount(templateId: string, count: number) {
    onCountsChange({
      ...counts,
      [templateId]: Math.max(0, count),
    });
  }

  return (
    <section className="composerColumn">
      <div className="armyHeader">
        <div>
          <p className="eyebrow">{sideLabel}</p>
          <h2>{playerName}</h2>
        </div>
        <strong>{cost} pkt</strong>
      </div>
      <div className="composerControls">
        <label>
          Gracz
          <input value={playerName} onChange={(event) => onPlayerNameChange(event.target.value)} />
        </label>
        <label>
          Frakcja
          <select value={faction} onChange={(event) => onFactionChange(event.target.value)}>
            {composerFactions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="templateList">
        {factionTaskForces.map((taskForce) => {
          const bonus = abilities.find((ability) => ability.id === taskForce.bonusAbility);
          const unitNames = taskForce.unitIds
            .map((templateId) => unitTemplates.find((template) => template.id === templateId)?.name)
            .filter(Boolean)
            .join(" + ");

          return (
            <article className="templateRow taskForceRow" key={taskForce.id}>
              <div>
                <p className="category">TASK FORCE</p>
                <h3>{taskForce.name}</h3>
                <p className="templateMeta">
                  {taskForce.cost} pkt | {unitNames}
                </p>
                {bonus ? <p className="templateMeta">Bonus: {bonus.name}</p> : null}
              </div>
              <div className="stepper">
                <button onClick={() => setCount(taskForce.id, (counts[taskForce.id] ?? 0) - 1)}>-</button>
                <input
                  min="0"
                  type="number"
                  value={counts[taskForce.id] ?? 0}
                  onChange={(event) => setCount(taskForce.id, Number(event.target.value))}
                />
                <button onClick={() => setCount(taskForce.id, (counts[taskForce.id] ?? 0) + 1)}>+</button>
              </div>
            </article>
          );
        })}
        {templates.map((template) => (
          <article className="templateRow" key={template.id}>
            <div>
              <p className="category">{template.category} | {template.role}</p>
              <h3>{template.name}</h3>
              <p className="templateMeta">
                {template.cost} pkt | HP {template.maxHp} | MOV {template.movement} | MOR {template.morale}
              </p>
            </div>
            <div className="stepper">
              <button onClick={() => setCount(template.id, (counts[template.id] ?? 0) - 1)}>-</button>
              <input
                min="0"
                type="number"
                value={counts[template.id] ?? 0}
                onChange={(event) => setCount(template.id, Number(event.target.value))}
              />
              <button onClick={() => setCount(template.id, (counts[template.id] ?? 0) + 1)}>+</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MapView({
  battle,
  debugMode,
  selectedUnitId,
  onActiveArmyChange,
  onAddLog,
  onBattleChange,
  onSelectedUnitChange,
  onTerrainPaint,
  onUnitPatch,
}: {
  battle: Battle;
  debugMode: boolean;
  selectedUnitId: string;
  onActiveArmyChange: (armyId: string | undefined) => void;
  onAddLog: (message: string) => void;
  onBattleChange: (battle: Battle) => void;
  onSelectedUnitChange: (unitId: string) => void;
  onTerrainPaint: (tile: TerrainTile) => void;
  onUnitPatch: (unitId: string, patch: Partial<UnitInstance>) => void;
}) {
  const [mapMode, setMapMode] = useState<"units" | "terrain">("units");
  const [selectedTerrain, setSelectedTerrain] = useState<TerrainType>("LightCover");
  const units = battle.armies.flatMap((army) => army.units);
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId);
  const selectedTerrainPreset =
    terrainPresets.find((terrain) => terrain.terrainType === selectedTerrain) ?? terrainPresets[0];

  function handleCellClick(x: number, y: number) {
    if (mapMode === "terrain") {
      onTerrainPaint({ ...selectedTerrainPreset, x, y });
      return;
    }

    if (!selectedUnit || selectedUnit.status === "Destroyed") {
      return;
    }

    if (debugMode) {
      onUnitPatch(selectedUnit.id, { position: { x, y } });
      return;
    }

    const result = moveUnit(battle, selectedUnit.id, { x, y });
    onBattleChange(result.battle);
    onActiveArmyChange(result.battle.activeActivation?.armyId);
    onAddLog(result.log);
  }

  return (
    <section className="mapLayout">
      <aside className="sidePanel mapSide">
        <PanelTitle title="Tryb mapy" detail={`${battle.board.width}x${battle.board.height}`} />
        <div className="segmented mapModeSwitch">
          <button className={mapMode === "units" ? "active" : ""} onClick={() => setMapMode("units")}>
            Oddzialy
          </button>
          <button className={mapMode === "terrain" ? "active" : ""} onClick={() => setMapMode("terrain")}>
            Teren
          </button>
        </div>

        {mapMode === "units" ? (
          <>
            <PanelTitle title="Oddzialy" detail={`${units.filter((unit) => unit.position).length}/${units.length}`} />
            <select value={selectedUnitId} onChange={(event) => onSelectedUnitChange(event.target.value)}>
              <option value="">Wybierz oddzial</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {getTemplate(unit).name} -{" "}
                  {unit.position ? `${unit.position.x},${unit.position.y}` : "rezerwa"}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <PanelTitle title="Typ terenu" detail={selectedTerrain} />
            <select
              value={selectedTerrain}
              onChange={(event) => setSelectedTerrain(event.target.value)}
            >
              {terrainPresets.map((terrain) => (
                <option key={terrain.terrainType} value={terrain.terrainType}>
                  {terrain.terrainType}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="mapReadout">
          {mapMode === "terrain" ? (
            <>
              <strong>{selectedTerrainPreset.terrainType}</strong>
              <span>Obrona: +{selectedTerrainPreset.defenseBonus}</span>
              <span>Atak: +{selectedTerrainPreset.attackBonus}</span>
              <span>Koszt ruchu: {selectedTerrainPreset.movementCost}</span>
              <span>Blokuje LOS: {selectedTerrainPreset.blocksLineOfSight ? "tak" : "nie"}</span>
            </>
          ) : selectedUnit ? (
            <>
              <strong>{getTemplate(selectedUnit).name}</strong>
              <span>Stan: {selectedUnit.position ? "na mapie" : "rezerwa / posilki"}</span>
              <span>
                Pole:{" "}
                {selectedUnit.position
                  ? `${selectedUnit.position.x}, ${selectedUnit.position.y}`
                  : "poza mapa"}
              </span>
              <span>Ruch: {getTemplate(selectedUnit).movement}</span>
              <span>
                Zasieg: {getTemplate(selectedUnit).weapons.map((weapon) => weapon.range).join(", ")}
              </span>
              {selectedUnit.position ? (
                <button
                  className="secondaryButton"
                  disabled={!debugMode}
                  onClick={() => onUnitPatch(selectedUnit.id, { position: null })}
                >
                  Przenies do rezerw
                </button>
              ) : null}
            </>
          ) : (
            <span>Wybierz oddzial, potem kliknij pole mapy.</span>
          )}
        </div>

        {mapMode === "units" ? (
          <div className="reserveList">
            <PanelTitle title="Rezerwy" detail={`${units.filter((unit) => !unit.position).length}`} />
            {units
              .filter((unit) => !unit.position)
              .map((unit) => (
                <button
                  className={unit.id === selectedUnitId ? "reserveUnit active" : "reserveUnit"}
                  key={unit.id}
                  onClick={() => onSelectedUnitChange(unit.id)}
                >
                  <span>{getTemplate(unit).name}</span>
                  <small>{battle.armies.find((army) => army.id === unit.armyId)?.faction}</small>
                </button>
              ))}
          </div>
        ) : null}
      </aside>
      <section className="mapBoard" style={{ gridTemplateColumns: `repeat(${battle.board.width}, minmax(56px, 1fr))` }}>
        {Array.from({ length: battle.board.width * battle.board.height }, (_, index) => {
          const x = index % battle.board.width;
          const y = Math.floor(index / battle.board.width);
          const tile = battle.board.tiles.find((terrain) => terrain.x === x && terrain.y === y);
          const tileUnits = units.filter(
            (unit) => unit.position?.x === x && unit.position.y === y,
          );

          return (
            <button
              className={`mapCell ${tile?.terrainType ?? "Open"}`}
              key={`${x}-${y}`}
              onClick={() => handleCellClick(x, y)}
            >
              <span className="cellCoords">
                {x},{y}
              </span>
              {tile ? <span className="terrainTag">{tile.terrainType}</span> : null}
              <div className="mapUnitStack">
                {tileUnits.map((unit) => {
                  const template = getTemplate(unit);
                  const army = battle.armies.find((candidate) => candidate.id === unit.armyId);

                  return (
                    <span
                      className={`mapUnit ${getTokenClass(template, army?.faction)} ${
                        unit.id === selectedUnitId ? "selected" : ""
                      }`}
                      key={unit.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectedUnitChange(unit.id);
                      }}
                      title={`${template.name} | ${army?.faction ?? "Unknown"}`}
                    >
                      <span className="tokenHead">
                        <span className="tokenVisor" />
                        <span className="tokenMouth" />
                      </span>
                      <span className="tokenCode">{getUnitInitials(template)}</span>
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })}
      </section>
    </section>
  );
}

function ArmyColumn({
  army,
  debugMode,
  selectedUnitId,
  onSelect,
  onPatch,
}: {
  army: Army;
  debugMode: boolean;
  selectedUnitId: string;
  onSelect: (unitId: string) => void;
  onPatch: (unitId: string, patch: Partial<UnitInstance>) => void;
}) {
  return (
    <section className={`armyColumn ${army.faction.toLowerCase().replaceAll(" ", "-")}`}>
      <div className="armyHeader">
        <div>
          <p className="eyebrow">{army.faction}</p>
          <h2>{army.playerName}</h2>
        </div>
        <strong>{getArmyCost(army)} pkt</strong>
      </div>

      <div className="unitList">
        {army.units.map((unit) => (
          <UnitCard
            key={unit.id}
            debugMode={debugMode}
            unit={unit}
            selected={unit.id === selectedUnitId}
            onSelect={() => onSelect(unit.id)}
            onPatch={onPatch}
          />
        ))}
      </div>
    </section>
  );
}

function UnitCard({
  debugMode,
  unit,
  selected,
  onSelect,
  onPatch,
}: {
  debugMode: boolean;
  unit: UnitInstance;
  selected: boolean;
  onSelect: () => void;
  onPatch: (unitId: string, patch: Partial<UnitInstance>) => void;
}) {
  const template = getTemplate(unit);
  const unitAbilities = abilities.filter((ability) => template.abilities.includes(ability.id));

  return (
    <article className={`unitCard ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="unitTopline">
        <div>
          <p className="category">{template.category} | {template.role}</p>
          <h3>{template.name}</h3>
        </div>
        <span className={`status ${unit.status.toLowerCase()}`}>{unit.status}</span>
      </div>

      <div className="statGrid">
        <Stat label="MOV" value={template.movement} />
        <Stat label="HP" value={template.maxHp} />
        <Stat label="MOR" value={template.morale} />
        <Stat label="CMD" value={template.command} />
        <Stat label="WPN" value={template.weapons.length} />
      </div>

      {debugMode ? (
        <div className="trackRow">
          <label>
            HP
            <input
              type="number"
              min="0"
              max={template.maxHp}
              value={unit.currentHp}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onPatch(unit.id, { currentHp: Number(event.target.value) })}
            />
          </label>
          <label>
            Suppression
            <input
              type="number"
              min="0"
              value={unit.suppression}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onPatch(unit.id, { suppression: Number(event.target.value) })}
            />
          </label>
        </div>
      ) : (
        <div className="readOnlyTracks">
          <span>HP {unit.currentHp}/{template.maxHp}</span>
          <span>Suppression {unit.suppression}</span>
        </div>
      )}

      <div className="abilityList">
        {template.weapons.map((weapon) => (
          <span
            title={`Range ${weapon.range}, attacks ${weapon.attacks}, damage ${weapon.damage}`}
            key={weapon.id}
          >
            {weapon.name}
          </span>
        ))}
        {unitAbilities.map((ability) => (
          <span title={ability.description} key={ability.id}>
            {ability.name}
            {ability.type === "active" && ability.cooldown ? ` CD${ability.cooldown}` : ""}
          </span>
        ))}
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PanelTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="panelTitle">
      <h2>{title}</h2>
      <span>{detail}</span>
    </div>
  );
}

function ArmyPreview({ armies }: { armies: Army[] }) {
  return (
    <div className="armyPreviewList">
      {armies.map((army) => (
        <section className="armyPreview" key={army.id}>
          <div className="armyPreviewHeader">
            <div>
              <p className="eyebrow">{army.faction}</p>
              <h3>{army.playerName}</h3>
            </div>
            <strong>{getArmyCost(army)} pkt</strong>
          </div>
          {army.units.length > 0 ? (
            <div className="armyPreviewUnits">
              {army.units.map((unit) => {
                const template = getTemplate(unit);

                return (
                  <div className="armyPreviewUnit" key={unit.id}>
                    <span>{template.name}</span>
                    <small>
                      {template.role} | HP {template.maxHp} | MOV {template.movement}
                    </small>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="emptyPreview">Brak jednostek.</p>
          )}
        </section>
      ))}
    </div>
  );
}

function countsFromArmy(army?: Army): DraftCounts {
  if (!army) {
    return {};
  }

  const taskForceSelectionIds = new Set(army.taskForces?.map((selection) => selection.id) ?? []);
  const counts = army.units.reduce<DraftCounts>((draftCounts, unit) => {
    if (!unit.sourceTaskForceId || !taskForceSelectionIds.has(unit.sourceTaskForceId)) {
      draftCounts[unit.templateId] = (draftCounts[unit.templateId] ?? 0) + 1;
    }

    return draftCounts;
  }, {});

  for (const selection of army.taskForces ?? []) {
    counts[selection.taskForceId] = (counts[selection.taskForceId] ?? 0) + 1;
  }

  return counts;
}

function buildArmyFromDraft(
  armyId: string,
  playerName: string,
  faction: FactionId,
  counts: DraftCounts,
  sideIndex: number,
): Army {
  let unitIndex = 1;
  const taskForceSelections = taskForces
    .filter((taskForce) => taskForce.faction === faction)
    .flatMap((taskForce) =>
      Array.from({ length: counts[taskForce.id] ?? 0 }, (_, taskForceIndex) => ({
        id: `${armyId}_${taskForce.id}_${taskForceIndex + 1}`,
        taskForceId: taskForce.id,
      })),
    );
  const taskForceUnits = taskForceSelections.flatMap((selection) => {
    const taskForce = taskForces.find((candidate) => candidate.id === selection.taskForceId);

    return (taskForce?.unitIds ?? []).map((templateId) => {
      const template = unitTemplates.find((candidate) => candidate.id === templateId);
      if (!template) {
        throw new Error(`Missing task force template: ${templateId}`);
      }

      const unit = createUnitInstance(armyId, template, unitIndex, selection.id);
      unitIndex += 1;
      return unit;
    });
  });
  const standaloneUnits = unitTemplates
    .filter((template) => template.faction === faction)
    .flatMap((template) =>
      Array.from({ length: counts[template.id] ?? 0 }, () => {
        const unit = createUnitInstance(armyId, template, unitIndex);
        unitIndex += 1;
        return unit;
      }),
    );

  return {
    id: armyId,
    playerName: playerName.trim() || `Gracz ${sideIndex}`,
    faction,
    taskForces: taskForceSelections,
    units: [...taskForceUnits, ...standaloneUnits],
  };
}

function createUnitInstance(
  armyId: string,
  template: UnitTemplate,
  unitIndex: number,
  sourceTaskForceId?: string,
): UnitInstance {
  return {
    id: `${armyId}_${template.id}_${unitIndex}`,
    templateId: template.id,
    armyId,
    sourceTaskForceId,
    currentHp: template.maxHp,
    suppression: 0,
    abilityCooldowns: {},
    activeEffects: [],
    movedThisTurn: false,
    position: null,
    status: "Ready",
    hidden: false,
  };
}

function getUnitInitials(template: UnitTemplate): string {
  return template.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function getTokenClass(template: UnitTemplate, faction?: FactionId): string {
  const factionClass =
    faction === "Republic"
      ? "tokenRepublic"
      : faction === "Separatists"
        ? "tokenSeparatists"
        : "tokenNeutral";
  const bodyClass = template.keywords.includes("SuperBattleDroid")
    ? "tokenSuperBattleDroid"
    : template.abilities.includes("shield_generators") || template.keywords.includes("Shielded")
      ? "tokenDroideka"
    : template.keywords.includes("Droid")
      ? "tokenDroid"
      : template.keywords.includes("Vehicle")
        ? "tokenVehicle"
        : "tokenHelmet";

  return `${factionClass} ${bodyClass} tokenRole${template.role}`;
}

function getVictoryLog(battle: Battle): string {
  const victory = getVictoryState(battle);
  const winner = battle.armies.find((army) => army.id === victory.winnerArmyId);

  return winner
    ? `Bitwa zakonczona. Zwycieza ${winner.playerName} (${winner.faction}).`
    : "Bitwa zakonczona. Na polu walki nie zostala zadna armia.";
}
