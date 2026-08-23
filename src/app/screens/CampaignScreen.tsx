import { useEffect, useMemo, useRef, useState } from "react";
import { unitTemplates } from "../../data";
import {
  beginCampaignActivationPhase,
  BASE_CONSTRUCTION_COST,
  createCampaignState,
  createStandardCampaignPlayers,
  deployCampaignReserves,
  getCampaignPlanetController,
  getCampaignIncomeBreakdown,
  processCampaignEconomy,
  queueBaseConstruction,
  queueBaseUpgrade,
  queueCampaignRecruitment,
  chooseCampaignBotAction,
  runNextCampaignBotAction,
  startNextCampaignTurn,
  type CampaignPhase,
  type CampaignBotAction,
  type CampaignEvent,
  type CampaignRoute,
  type CampaignState,
} from "../../core/campaign";
import {
  galacticHyperlanes,
  galacticPlanets,
} from "../../core/galactic-conquest/galaxy";
import { createPersistenceAdapter } from "../../core/persistence/create-persistence-adapter";
import {
  createSavedCampaign,
  type SavedCampaign,
} from "../../core/persistence/save-types";
import { useI18n } from "../../i18n";
import {
  buildCampaignMapNodes,
  getCampaignOverview,
  getSectorName,
} from "../campaign/campaign-screen-model";
import {
  applyCampaignActivationAction,
  getCampaignActivationDetails,
  getCampaignDestinationAction,
  type CampaignActivationAction,
  type CampaignActivationResult,
} from "../campaign/campaign-activation-model";
import {
  getCampaignEconomyDetails,
  getCampaignReserveDeploymentPreview,
} from "../campaign/campaign-economy-model";
import "../styles/campaign-screen.css";

type CampaignScreenProps = {
  savedCampaign?: SavedCampaign;
  onCampaignChange: (campaign: SavedCampaign | undefined) => void;
  onCampaignBattleStart: (campaign: SavedCampaign) => Promise<void>;
  onCampaignBattleResume: (campaign: SavedCampaign) => Promise<void>;
  campaignBattleReport?: string;
};

export function CampaignScreen({
  savedCampaign,
  onCampaignChange,
  onCampaignBattleStart,
  onCampaignBattleResume,
  campaignBattleReport,
}: CampaignScreenProps) {
  const { language, text } = useI18n();
  const persistence = useMemo(() => createPersistenceAdapter(), []);
  const [savedCampaigns, setSavedCampaigns] = useState<SavedCampaign[]>([]);
  const [campaignName, setCampaignName] = useState(text("Wojna o Zewnętrzne Rubieże", "Outer Rim War"));
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
  const [playerNames, setPlayerNames] = useState<string[]>(() => defaultCommanderNames(language, 2));
  const [opponentControl, setOpponentControl] = useState<"Human" | "Bot">("Bot");
  const [seed, setSeed] = useState(() => Math.floor(Date.now() / 1000) % 1_000_000);
  const [selectedPlanetId, setSelectedPlanetId] = useState<string>();
  const [selectedArmyId, setSelectedArmyId] = useState<string>();
  const [selectedEconomyPlayerId, setSelectedEconomyPlayerId] = useState<string>();
  const [pendingActivationAction, setPendingActivationAction] = useState<CampaignActivationAction>();
  const [status, setStatus] = useState("");
  const [botAutomationTick, setBotAutomationTick] = useState(0);
  const botAutomationInProgress = useRef(false);

  useEffect(() => {
    void refreshCampaigns();
  }, []);

  useEffect(() => {
    if (!savedCampaign) return;
    setSelectedPlanetId((current) =>
      savedCampaign.campaign.planets.some(({ planetId }) => planetId === current)
        ? current
        : savedCampaign.campaign.planets[0]?.planetId
    );
  }, [savedCampaign]);

  useEffect(() => {
    const players = savedCampaign?.campaign.players ?? [];
    setSelectedEconomyPlayerId((current) =>
      players.some(({ id }) => id === current) ? current : players[0]?.id
    );
  }, [savedCampaign?.campaign.id, savedCampaign?.campaign.players]);

  useEffect(() => {
    const campaign = savedCampaign?.campaign;
    if (!campaign) {
      setSelectedArmyId(undefined);
      setPendingActivationAction(undefined);
      return;
    }
    const selectableArmies = getCampaignActivationDetails(campaign, selectedArmyId).selectableArmies;
    if (!selectableArmies.some(({ id }) => id === selectedArmyId)) {
      setSelectedArmyId(undefined);
      setPendingActivationAction(undefined);
    }
  }, [savedCampaign?.campaign.activePlayerId, savedCampaign?.campaign.phase]);

  async function refreshCampaigns() {
    try {
      setSavedCampaigns(await persistence.listCampaigns());
    } catch (error) {
      setStatus(errorMessage(error, text("Nie udało się odczytać kampanii.", "Could not read campaigns.")));
    }
  }

  function changePlayerCount(count: 2 | 4) {
    setPlayerCount(count);
    setPlayerNames(defaultCommanderNames(language, count));
  }

  async function createCampaign() {
    const normalizedNames = playerNames.map((name) => name.trim());
    if (!campaignName.trim() || normalizedNames.some((name) => !name)) {
      setStatus(text("Nazwa kampanii i imiona dowódców są wymagane.", "Campaign and commander names are required."));
      return;
    }
    try {
      const campaign = createCampaignState({
        id: `campaign-${crypto.randomUUID()}`,
        name: campaignName.trim(),
        seed,
        players: createStandardCampaignPlayers(
          normalizedNames,
          normalizedNames.map((_, index) => index < playerCount / 2 ? "Human" : opponentControl),
        ),
      });
      const saved = createSavedCampaign({ campaign });
      await persistence.saveCampaign(saved);
      onCampaignChange(saved);
      setStatus(text("Kampania została utworzona i zapisana.", "Campaign created and saved."));
      await refreshCampaigns();
    } catch (error) {
      setStatus(errorMessage(error, text("Nie udało się utworzyć kampanii.", "Could not create campaign.")));
    }
  }

  async function loadCampaign(id: string) {
    try {
      const saved = await persistence.loadCampaign(id);
      if (!saved) {
        setStatus(text("Wybrany zapis już nie istnieje.", "The selected save no longer exists."));
        await refreshCampaigns();
        return;
      }
      onCampaignChange(saved);
      setStatus("");
    } catch (error) {
      setStatus(errorMessage(error, text("Nie udało się wczytać kampanii.", "Could not load campaign.")));
    }
  }

  async function deleteCampaign(id: string) {
    try {
      await persistence.deleteCampaign(id);
      if (savedCampaign?.id === id) onCampaignChange(undefined);
      await refreshCampaigns();
      setStatus(text("Zapis kampanii został usunięty.", "Campaign save deleted."));
    } catch (error) {
      setStatus(errorMessage(error, text("Nie udało się usunąć kampanii.", "Could not delete campaign.")));
    }
  }

  async function commitCampaign(campaign: CampaignState, message: string): Promise<SavedCampaign | undefined> {
    const saved = createSavedCampaign({
      campaign,
      battleIds: savedCampaign?.battleIds,
      createdAt: savedCampaign?.createdAt,
    });
    onCampaignChange(saved);
    try {
      await persistence.saveCampaign(saved);
      setStatus(message);
      await refreshCampaigns();
      return saved;
    } catch (error) {
      setStatus(errorMessage(error, text("Zmiana działa w pamięci, ale zapis się nie udał.", "The change is active in memory, but saving failed.")));
      return undefined;
    }
  }

  useEffect(() => {
    const campaign = savedCampaign?.campaign;
    if (!campaign || botAutomationInProgress.current) return;
    const step = runNextCampaignBotAction(campaign);
    if (!step) return;

    botAutomationInProgress.current = true;
    void (async () => {
      const saved = await commitCampaign(step.state, campaignBotActionMessage(step.action, text));
      if (saved && step.battleRequired) await onCampaignBattleStart(saved);
    })().finally(() => {
      botAutomationInProgress.current = false;
      setBotAutomationTick((current) => current + 1);
    });
  }, [savedCampaign, botAutomationTick]);

  if (!savedCampaign) {
    return (
      <CampaignLauncher
        campaignName={campaignName}
        playerCount={playerCount}
        playerNames={playerNames}
        savedCampaigns={savedCampaigns}
        seed={seed}
        status={status}
        onCampaignNameChange={setCampaignName}
        onCreate={createCampaign}
        onDelete={deleteCampaign}
        onLoad={loadCampaign}
        onPlayerCountChange={changePlayerCount}
        onPlayerNameChange={(index, name) => setPlayerNames((current) =>
          current.map((value, currentIndex) => currentIndex === index ? name : value)
        )}
        onSeedChange={setSeed}
        opponentControl={opponentControl}
        onOpponentControlChange={setOpponentControl}
      />
    );
  }

  const campaign = savedCampaign.campaign;
  const selectedPlanet = campaign.planets.find(({ planetId }) => planetId === selectedPlanetId)
    ?? campaign.planets[0];
  const overview = getCampaignOverview(campaign);
  const activePlayer = campaign.players.find(({ id }) => id === campaign.activePlayerId);
  const botWorkPending = Boolean(chooseCampaignBotAction(campaign));
  const activationDetails = getCampaignActivationDetails(campaign, selectedArmyId);
  const pendingPreview = pendingActivationAction
    ? safeActivationPreview(campaign, pendingActivationAction)
    : undefined;

  function selectDestination(destinationPlanetId: string) {
    if (!activationDetails.selectedArmy) return;
    try {
      setPendingActivationAction(getCampaignDestinationAction(
        campaign,
        activationDetails.selectedArmy.id,
        destinationPlanetId,
      ));
    } catch (error) {
      setStatus(errorMessage(error, text("Nie można wybrać tej trasy.", "This route cannot be selected.")));
    }
  }

  async function confirmActivationAction() {
    if (!pendingActivationAction) return;
    try {
      const result = applyCampaignActivationAction(campaign, pendingActivationAction);
      setPendingActivationAction(undefined);
      setSelectedArmyId(undefined);
      const saved = await commitCampaign(result.state, activationResultMessage(result.outcome, text));
      if (saved && result.outcome === "BattleRequired") {
        await onCampaignBattleStart(saved);
      }
    } catch (error) {
      setStatus(errorMessage(error, text("Nie udało się wykonać aktywacji.", "Could not complete activation.")));
    }
  }

  function applyEconomyAction(action: (state: CampaignState) => CampaignState, message: string) {
    try {
      void commitCampaign(action(campaign), message);
    } catch (error) {
      setStatus(errorMessage(error, text("Nie udało się wykonać operacji gospodarczej.", "Could not complete the economy operation.")));
    }
  }

  return (
    <section className="campaignScreen">
      <header className="campaignSummaryBar">
        <div>
          <p className="eyebrow">{text("Kampania galaktyczna", "Galactic campaign")}</p>
          <h2>{campaign.name}</h2>
          <p className="campaignSaveMeta">
            {text("Zapisano", "Saved")}: {new Date(savedCampaign.updatedAt).toLocaleString()}
          </p>
        </div>
        <div className="campaignRoundBadge">
          <span>{text("Tura", "Turn")}</span>
          <strong>{campaign.turn}</strong>
        </div>
        <div className={`campaignPhase campaignPhase${campaign.phase}`}>
          {localizePhase(campaign.phase, text)}
        </div>
        <button className="secondaryButton" onClick={() => void commitCampaign(
          campaign,
          text("Kampania została zapisana.", "Campaign saved."),
        )}>
          {text("Zapisz", "Save")}
        </button>
        <button className="secondaryButton" onClick={() => onCampaignChange(undefined)}>
          {text("Zmień kampanię", "Switch campaign")}
        </button>
      </header>

      {status || campaignBattleReport ? <p className="campaignStatus" role="status">{campaignBattleReport ?? status}</p> : null}

      <section className="campaignPlayerStrip">
        {campaign.players.map((player) => (
          <article
            className={`campaignPlayerCard faction${player.factionId} ${player.id === activePlayer?.id ? "isActive" : ""}`}
            key={player.id}
          >
            <span>{player.factionId === "Republic" ? text("Republika", "Republic") : text("Separatyści", "Separatists")}</span>
            <strong>{player.name}</strong>
            <small>{player.credits} {text("kredytów", "credits")}</small>
            <small>{player.control === "Bot" ? text("AI strategiczne", "Strategic AI") : text("Gracz", "Human")}</small>
          </article>
        ))}
      </section>

      <section className="campaignOverviewGrid">
        <CampaignStat label={text("Planety", "Planets")} value={overview.playablePlanets} />
        <CampaignStat label={text("Kontrolowane sektory", "Controlled sectors")} value={`${overview.controlledSectors}/${overview.totalSectors}`} />
        <CampaignStat label={text("Armie", "Armies")} value={overview.activeArmies} />
        <CampaignStat label={text("Dochód galaktyki", "Galaxy income")} value={overview.totalIncome} />
      </section>

      <section className="campaignWorkspace">
        <CampaignGalaxy
          campaign={campaign}
          selectedPlanetId={selectedPlanet?.planetId}
          selectedArmyId={activationDetails.selectedArmy?.id}
          legalRoutes={activationDetails.legalRoutes}
          pendingAction={pendingActivationAction}
          onPlanetSelect={setSelectedPlanetId}
          onRouteSelect={selectDestination}
        />
        <div className="campaignSidebar">
          <CampaignEconomyPanel
            campaign={campaign}
            selectedPlayerId={selectedEconomyPlayerId}
            onPlayerSelect={setSelectedEconomyPlayerId}
            onAction={applyEconomyAction}
          />
          {selectedPlanet ? <PlanetInspector campaign={campaign} planetId={selectedPlanet.planetId} /> : null}
          <CampaignActivationPanel
            campaign={campaign}
            activePlayerName={activePlayer?.name}
            activePlayerIsBot={activePlayer?.control === "Bot"}
            details={activationDetails}
            pendingAction={pendingActivationAction}
            pendingPreview={pendingPreview}
            onArmySelect={(armyId) => {
              setSelectedArmyId(armyId);
              setPendingActivationAction(undefined);
            }}
            onActionSelect={setPendingActivationAction}
            onCancel={() => setPendingActivationAction(undefined)}
          onConfirm={confirmActivationAction}
          />
          <CampaignHistoryPanel campaign={campaign} />
        </div>
      </section>

      {campaign.phase === "Battle" ? (
        <section className="campaignBattleResume">
          <div>
            <p className="eyebrow">{text("Oczekujący konflikt", "Pending conflict")}</p>
            <strong>{text("Bitwa kampanijna czeka na rozegranie.", "A campaign battle is ready to play.")}</strong>
          </div>
          <button className="primaryButton" onClick={() => void onCampaignBattleResume(savedCampaign)}>
            {text("Kontynuuj bitwę kampanijną", "Continue campaign battle")}
          </button>
        </section>
      ) : null}

      <footer className="campaignTurnControls">
        <div>
          <span>{text("Następny krok", "Next step")}</span>
          <strong>{nextStepLabel(campaign, text)}</strong>
        </div>
        {campaign.phase === "Income" && campaign.incomeCollectedForTurn !== campaign.turn ? (
          <button className="primaryButton" onClick={() => {
            const result = processCampaignEconomy(campaign);
            const gained = result.income.reduce((sum, entry) => sum + entry.total, 0);
            void commitCampaign(
              result.state,
              text(`Naliczono ${gained} kredytów.`, `Collected ${gained} credits.`),
            );
          }}>
            {text("Rozlicz dochód", "Collect income")}
          </button>
        ) : null}
        {campaign.phase === "Income" && campaign.incomeCollectedForTurn === campaign.turn ? (
          <button className="primaryButton" onClick={() => void commitCampaign(
            beginCampaignActivationPhase(campaign),
            text("Rozpoczęto fazę aktywacji.", "Activation phase started."),
          )} disabled={botWorkPending}>
            {botWorkPending ? text("AI wykonuje rozkazy…", "AI is issuing orders…") : text("Rozpocznij aktywacje", "Begin activations")}
          </button>
        ) : null}
        {campaign.phase === "Resolution" ? (
          <button className="primaryButton" onClick={() => void commitCampaign(
            startNextCampaignTurn(campaign),
            text("Zakończono turę. Następna tura czeka na rozliczenie dochodu.", "Turn ended. The next turn is ready for income."),
          )}>
            {text("Zakończ turę", "End turn")}
          </button>
        ) : null}
      </footer>
    </section>
  );
}

function CampaignLauncher({
  campaignName,
  playerCount,
  playerNames,
  savedCampaigns,
  seed,
  status,
  onCampaignNameChange,
  onCreate,
  onDelete,
  onLoad,
  onPlayerCountChange,
  onPlayerNameChange,
  onSeedChange,
  opponentControl,
  onOpponentControlChange,
}: {
  campaignName: string;
  playerCount: 2 | 4;
  playerNames: string[];
  savedCampaigns: SavedCampaign[];
  seed: number;
  status: string;
  onCampaignNameChange: (name: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onLoad: (id: string) => void;
  onPlayerCountChange: (count: 2 | 4) => void;
  onPlayerNameChange: (index: number, name: string) => void;
  onSeedChange: (seed: number) => void;
  opponentControl: "Human" | "Bot";
  onOpponentControlChange: (control: "Human" | "Bot") => void;
}) {
  const { text } = useI18n();
  return (
    <section className="campaignLauncher">
      <div className="campaignLauncherIntro">
        <p className="eyebrow">GALACTIC CONQUEST</p>
        <h2>{text("Rozpocznij wojnę o galaktykę", "Begin the war for the galaxy")}</h2>
        <p>{text(
          "Dowódcy prowadzą armie przez hiperlinie, zdobywają sektory i rozwijają bazy. Każde bronione terytorium może rozpocząć pełną bitwę taktyczną.",
          "Commanders move armies through hyperlanes, capture sectors, and develop bases. Every defended territory can trigger a full tactical battle.",
        )}</p>
      </div>
      <div className="campaignLauncherGrid">
        <section className="campaignSetupCard">
          <div className="campaignSectionHeading">
            <span>01</span>
            <div>
              <p className="eyebrow">{text("Nowa kampania", "New campaign")}</p>
              <h3>{text("Konfiguracja dowódców", "Commander setup")}</h3>
            </div>
          </div>
          <label>
            {text("Nazwa kampanii", "Campaign name")}
            <input value={campaignName} onChange={(event) => onCampaignNameChange(event.target.value)} />
          </label>
          <div className="campaignModeToggle">
            <button className={playerCount === 2 ? "active" : ""} onClick={() => onPlayerCountChange(2)}>1 vs 1</button>
            <button className={playerCount === 4 ? "active" : ""} onClick={() => onPlayerCountChange(4)}>2 vs 2</button>
          </div>
          <div className="campaignCommanderGrid">
            {playerNames.map((name, index) => (
              <label className={index < playerCount / 2 ? "republicField" : "separatistField"} key={index}>
                {index < playerCount / 2 ? text("Dowódca Republiki", "Republic commander") : text("Dowódca Separatystów", "Separatist commander")}
                <input value={name} onChange={(event) => onPlayerNameChange(index, event.target.value)} />
              </label>
            ))}
          </div>
          <label>
            {text("Ziarno galaktyki", "Galaxy seed")}
            <input type="number" value={seed} onChange={(event) => onSeedChange(Number(event.target.value))} />
          </label>
          <label>
            {text("Kontrola Separatystów w bitwach", "Separatist tactical control")}
            <select value={opponentControl} onChange={(event) => onOpponentControlChange(event.target.value as "Human" | "Bot")}>
              <option value="Bot">{text("AI", "AI")}</option>
              <option value="Human">{text("Człowiek (hot-seat)", "Human (hot-seat)")}</option>
            </select>
          </label>
          <button className="primaryButton" onClick={onCreate}>{text("Utwórz kampanię", "Create campaign")}</button>
        </section>

        <section className="campaignSavesCard">
          <div className="campaignSectionHeading">
            <span>02</span>
            <div>
              <p className="eyebrow">{text("Archiwum", "Archive")}</p>
              <h3>{text("Zapisane kampanie", "Saved campaigns")}</h3>
            </div>
          </div>
          <div className="campaignSaveList">
            {savedCampaigns.map((saved) => (
              <article className="campaignSaveRow" key={saved.id}>
                <div>
                  <strong>{saved.name}</strong>
                  <small>
                    {text("Tura", "Turn")} {saved.campaign.turn} · {localizePhase(saved.campaign.phase, text)} · {saved.campaign.players.length} {text("graczy", "players")}
                  </small>
                </div>
                <button className="secondaryButton" onClick={() => onLoad(saved.id)}>{text("Wczytaj", "Load")}</button>
                <button className="dangerButton" onClick={() => onDelete(saved.id)}>{text("Usuń", "Delete")}</button>
              </article>
            ))}
            {savedCampaigns.length === 0 ? (
              <p className="campaignEmptyState">{text("Nie ma jeszcze zapisanych kampanii.", "There are no saved campaigns yet.")}</p>
            ) : null}
          </div>
        </section>
      </div>
      {status ? <p className="campaignStatus" role="status">{status}</p> : null}
    </section>
  );
}

function CampaignGalaxy({
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
  const nodes = buildCampaignMapNodes(campaign);
  const positionById = new Map(nodes.map((node) => [node.id, node]));
  const routeByDestination = new Map(legalRoutes.map((route) => [route.destinationPlanetId, route]));
  const highlightedLinks = new Set(
    legalRoutes.flatMap(({ planetIds }) => planetIds.slice(1).map((planetId, index) =>
      routeKey(planetIds[index], planetId)
    )),
  );
  const selectedRoute = pendingAction && "destinationPlanetId" in pendingAction
    ? routeByDestination.get(pendingAction.destinationPlanetId)
    : undefined;
  const selectedLinks = new Set(selectedRoute?.planetIds.slice(1).map((planetId, index) =>
    routeKey(selectedRoute.planetIds[index], planetId)
  ));
  return (
    <section className="campaignGalaxyPanel">
      <div className="campaignPanelHeading">
        <div>
          <p className="eyebrow">{text("Teatr działań", "Theater of operations")}</p>
          <h3>{text("Mapa galaktyczna", "Galactic map")}</h3>
        </div>
        <div className="campaignLegend">
          <span className="legendRepublic">{text("Republika", "Republic")}</span>
          <span className="legendSeparatists">{text("Separatyści", "Separatists")}</span>
          <span className="legendNeutral">{text("Neutralne", "Neutral")}</span>
        </div>
      </div>
      <div className="campaignGalaxy" aria-label={text("Strategiczna mapa galaktyki", "Strategic galaxy map")}>
        <svg className="campaignHyperlanes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {galacticHyperlanes.map((lane) => {
            const from = positionById.get(lane.fromPlanetId)!;
            const to = positionById.get(lane.toPlanetId)!;
            const key = routeKey(lane.fromPlanetId, lane.toPlanetId);
            return <line
              className={`${highlightedLinks.has(key) ? "isLegalRoute" : ""} ${selectedLinks.has(key) ? "isSelectedRoute" : ""}`}
              key={lane.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
            />;
          })}
        </svg>
        {nodes.map((node) => {
          const route = routeByDestination.get(node.id);
          const armyIsHere = selectedArmyId && campaign.armies.some((army) =>
            army.id === selectedArmyId && army.planetId === node.id
          );
          return (
            <button
              aria-label={node.playable ? node.name : `${node.name} — ${text("niedostępna", "unavailable")}`}
              className={`campaignPlanetNode controller${node.controller} ${selectedPlanetId === node.id ? "isSelected" : ""} ${route ? "isRouteTarget" : ""} ${armyIsHere ? "isArmyOrigin" : ""} ${node.playable ? "" : "isLocked"}`}
              disabled={!node.playable}
              key={node.id}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              onClick={() => {
                onPlanetSelect(node.id);
                if (route) onRouteSelect(node.id);
              }}
            >
              <span className="campaignPlanetOrb">
                {node.playable ? node.sectorControllers.map((controller, index) => (
                  <i className={`sectorPip controller${controller}`} key={index} />
                )) : <i className="planetLock">×</i>}
              </span>
              <strong>{node.name}</strong>
              {route ? <small className="campaignRouteBadge">{route.movementCost} MP{route.encounter ? " !" : ""}</small> : null}
              {node.armyCount > 0 ? <small className="planetArmyBadge">{node.armyCount}A</small> : null}
              {node.baseLevel ? <small className="planetBaseBadge">B{node.baseLevel}</small> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CampaignEconomyPanel({
  campaign,
  selectedPlayerId,
  onPlayerSelect,
  onAction,
}: {
  campaign: CampaignState;
  selectedPlayerId?: string;
  onPlayerSelect: (playerId: string) => void;
  onAction: (action: (state: CampaignState) => CampaignState, message: string) => void;
}) {
  const { text } = useI18n();
  const details = getCampaignEconomyDetails(campaign, selectedPlayerId ?? "");
  const [recruitBaseId, setRecruitBaseId] = useState<string>();
  const [recruitTemplateId, setRecruitTemplateId] = useState<string>();
  const [deployPlanetId, setDeployPlanetId] = useState<string>();
  const [deployArmyId, setDeployArmyId] = useState<string>();
  const [selectedReserveIds, setSelectedReserveIds] = useState<string[]>([]);
  const [selectedHeroIds, setSelectedHeroIds] = useState<string[]>([]);
  const [newArmyName, setNewArmyName] = useState("");

  useEffect(() => {
    if (!details.economyOpen) return;
    setRecruitBaseId((current) => details.bases.some(({ id }) => id === current)
      ? current
      : details.bases[0]?.id);
    setRecruitTemplateId((current) => details.recruitmentOptions.some(({ templateId }) => templateId === current)
      ? current
      : details.recruitmentOptions[0]?.templateId);
    setDeployPlanetId((current) => details.bases.some(({ planetId }) => planetId === current)
      ? current
      : details.bases[0]?.planetId);
  }, [details.economyOpen, details.bases, details.recruitmentOptions]);

  if (!details.economyOpen || !details.player) return null;

  const player = details.player;
  const incomeForecast = getCampaignIncomeBreakdown(campaign, player.id);
  const isBotPlayer = player.control === "Bot";
  if (isBotPlayer) {
    return (
      <aside className="campaignEconomyPanel campaignBotPanel">
        <p className="eyebrow">{text("Gospodarka AI", "AI economy")}</p>
        <h3>{player.name}</h3>
        <p className="campaignEconomyHint">{text(
          "Ten dowódca samodzielnie zarządza bazami, rekrutacją i rezerwami po rozliczeniu dochodu.",
          "This commander manages bases, recruitment, and reserves automatically after income is collected.",
        )}</p>
      </aside>
    );
  }
  const recruitBase = details.bases.find(({ id }) => id === recruitBaseId);
  const recruitTemplate = details.recruitmentOptions.find(({ templateId }) => templateId === recruitTemplateId);
  const canRecruit = Boolean(recruitBase && recruitTemplate &&
    recruitBase.level >= recruitTemplate.requiredBaseLevel &&
    recruitTemplate.heroAvailable && player.credits >= recruitTemplate.cost);
  const deployment = deployPlanetId
    ? getCampaignReserveDeploymentPreview(
      campaign,
      player.id,
      deployPlanetId,
      selectedReserveIds,
      selectedHeroIds,
      deployArmyId,
    )
    : undefined;

  return (
    <aside className="campaignEconomyPanel">
      <div className="campaignPanelHeading">
        <div>
          <p className="eyebrow">{text("Dochód i rozwój", "Income and development")}</p>
          <h3>{text("Zarządzanie kampanią", "Campaign management")}</h3>
        </div>
        <strong>{player.credits} CR</strong>
      </div>
      <p className="campaignEconomyHint">{text(`Prognoza dochodu: ${incomeForecast.total} CR/turę.`, `Income forecast: ${incomeForecast.total} CR/turn.`)}</p>

      <label className="campaignEconomySelect">
        {text("Dowódca", "Commander")}
        <select value={player.id} onChange={(event) => onPlayerSelect(event.target.value)}>
          {campaign.players.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
        </select>
      </label>

      <section className="campaignEconomySection">
        <h4>{text("Kontrolowane planety i bazy", "Controlled planets and bases")}</h4>
        {details.controlledPlanets.length === 0 ? <p className="campaignEconomyHint">{text("Brak planety w pełni kontrolowanej przez tego dowódcę.", "This commander has no fully controlled planet.")}</p> : null}
        {details.controlledPlanets.map((planet) => {
          const base = details.bases.find(({ planetId }) => planetId === planet.planetId);
          const construction = details.constructionQueue.find(({ planetId }) => planetId === planet.planetId);
          const upgradeCost = base && base.level < 3
            ? BASE_CONSTRUCTION_COST[(base.level + 1) as 1 | 2 | 3]
            : undefined;
          const planetName = galacticPlanets.find(({ id }) => id === planet.planetId)?.name ?? planet.planetId;
          return (
            <article className="campaignEconomyRow" key={planet.planetId}>
              <div>
                <strong>{planetName}</strong>
                <small>{base ? text(`Baza, poziom ${base.level}`, `Base, level ${base.level}`) : text("Brak bazy", "No base")}</small>
                {construction ? <small>{text(`Budowa: L${construction.targetLevel}, tura ${construction.completesOnTurn}`, `Construction: L${construction.targetLevel}, turn ${construction.completesOnTurn}`)}</small> : null}
              </div>
              {!base ? <button
                className="secondaryButton"
                disabled={Boolean(construction) || player.credits < 20}
                onClick={() => confirmCampaignAction(text("Wydać 20 CR na budowę bazy?", "Spend 20 CR to build this base?")) && onAction(
                  (state) => queueBaseConstruction(state, player.id, planet.planetId),
                  text(`Zlecono budowę bazy na ${planetName}.`, `Base construction ordered on ${planetName}.`),
                )}
              >{text("Buduj · 20", "Build · 20")}</button> : null}
              {base && base.level < 3 ? <button
                className="secondaryButton"
                disabled={Boolean(construction) || player.credits < (upgradeCost ?? 0)}
                onClick={() => confirmCampaignAction(text(`Wydać ${upgradeCost} CR na ulepszenie bazy?`, `Spend ${upgradeCost} CR to upgrade this base?`)) && onAction(
                  (state) => queueBaseUpgrade(state, player.id, base.id),
                  text(`Zlecono ulepszenie bazy na ${planetName}.`, `Base upgrade ordered on ${planetName}.`),
                )}
              >{text(`Ulepsz · ${upgradeCost}`, `Upgrade · ${upgradeCost}`)}</button> : null}
            </article>
          );
        })}
      </section>

      <section className="campaignEconomySection">
        <h4>{text("Kolejki", "Queues")}</h4>
        {details.constructionQueue.length + details.recruitmentQueue.length === 0 ? <p className="campaignEconomyHint">{text("Brak aktywnych zleceń.", "No active orders.")}</p> : null}
        {details.constructionQueue.map((order) => <p className="campaignQueueRow" key={order.id}>{order.kind === "BuildBase" ? text("Budowa bazy", "Base construction") : text("Ulepszenie bazy", "Base upgrade")} · {order.cost} CR · {order.planetId} · {text("tura", "turn")} {order.completesOnTurn}</p>)}
        {details.recruitmentQueue.map((order) => <p className="campaignQueueRow" key={order.id}>{unitTemplates.find(({ id }) => id === order.templateId)?.name ?? order.templateId} ×{order.quantity} · {order.cost} CR · {order.planetId} · {text("tura", "turn")} {order.completesOnTurn}</p>)}
      </section>

      <section className="campaignEconomySection">
        <h4>{text("Rekrutacja do rezerw", "Recruit reserves")}</h4>
        <label className="campaignEconomySelect">
          {text("Baza", "Base")}
          <select value={recruitBaseId ?? ""} onChange={(event) => setRecruitBaseId(event.target.value || undefined)}>
            <option value="">{text("Wybierz bazę", "Select a base")}</option>
            {details.bases.map((base) => <option key={base.id} value={base.id}>{base.planetId} · L{base.level}</option>)}
          </select>
        </label>
        <label className="campaignEconomySelect">
          {text("Jednostka", "Unit")}
          <select value={recruitTemplateId ?? ""} onChange={(event) => setRecruitTemplateId(event.target.value || undefined)}>
            <option value="">{text("Wybierz jednostkę", "Select a unit")}</option>
            {details.recruitmentOptions.map((option) => <option key={option.templateId} value={option.templateId} disabled={!option.heroAvailable}>{option.name} · {option.cost} CR · L{option.requiredBaseLevel}{option.isHero ? " · Hero" : ""}{!option.heroAvailable ? ` · ${text("niedostępny", "unavailable")}` : ""}</option>)}
          </select>
        </label>
        {recruitTemplate ? <p className="campaignEconomyHint">{text(`Wymaga bazy poziomu ${recruitTemplate.requiredBaseLevel}.`, `Requires a level ${recruitTemplate.requiredBaseLevel} base.`)}</p> : null}
        <button
          className="secondaryButton"
          disabled={!canRecruit || !recruitBase || !recruitTemplate}
          onClick={() => recruitBase && recruitTemplate && confirmCampaignAction(text(`Wydać ${recruitTemplate.cost} CR na rekrutację?`, `Spend ${recruitTemplate.cost} CR on recruitment?`)) && onAction(
            (state) => queueCampaignRecruitment(state, player.id, recruitBase.id, recruitTemplate.templateId),
            text(`Dodano ${recruitTemplate.name} do kolejki rekrutacji.`, `${recruitTemplate.name} added to the recruitment queue.`),
          )}
        >{text("Dodaj do kolejki", "Add to queue")}</button>
      </section>

      <section className="campaignEconomySection">
        <h4>{text("Rezerwy i armie", "Reserves and armies")}</h4>
        <label className="campaignEconomySelect">
          {text("Planeta z bazą", "Planet with base")}
          <select value={deployPlanetId ?? ""} onChange={(event) => {
            setDeployPlanetId(event.target.value || undefined);
            setDeployArmyId(undefined);
            setSelectedReserveIds([]);
            setSelectedHeroIds([]);
          }}>
            <option value="">{text("Wybierz planetę", "Select a planet")}</option>
            {details.bases.map((base) => <option key={base.id} value={base.planetId}>{base.planetId} · L{base.level}</option>)}
          </select>
        </label>
        {deployment ? <>
          <label className="campaignEconomySelect">
            {text("Cel", "Target")}
            <select value={deployArmyId ?? ""} onChange={(event) => setDeployArmyId(event.target.value || undefined)}>
              <option value="">{text("Nowa armia", "New army")}</option>
              {deployment.armies.map((army) => <option key={army.id} value={army.id}>{army.name}</option>)}
            </select>
          </label>
          {!deployArmyId ? <label className="campaignEconomySelect">{text("Nazwa nowej armii", "New army name")}<input value={newArmyName} onChange={(event) => setNewArmyName(event.target.value)} placeholder={text("opcjonalnie", "optional")} /></label> : null}
          <div className="campaignReserveList">
            {deployment.reserves.map((reserve) => <label key={reserve.id}><input type="checkbox" checked={selectedReserveIds.includes(reserve.id)} onChange={(event) => setSelectedReserveIds((current) => event.target.checked ? [...current, reserve.id] : current.filter((id) => id !== reserve.id))} />{unitTemplates.find(({ id }) => id === reserve.templateId)?.name ?? reserve.templateId}</label>)}
            {deployment.heroes.map((hero) => <label key={hero.heroId}><input type="checkbox" checked={selectedHeroIds.includes(hero.heroId)} onChange={(event) => setSelectedHeroIds((current) => event.target.checked ? [...current, hero.heroId] : current.filter((id) => id !== hero.heroId))} />{unitTemplates.find(({ id }) => id === hero.heroId)?.name ?? hero.heroId} · {text("bohater", "hero")}</label>)}
            {deployment.reserves.length + deployment.heroes.length === 0 ? <p className="campaignEconomyHint">{text("Nie ma rezerw na tej planecie.", "There are no reserves on this planet.")}</p> : null}
          </div>
          <p className="campaignEconomyHint">{text(`Punkty armii: ${deployment.pointCost}/${deployment.pointLimit}. Bohaterowie: ${deployment.heroCount}/${deployment.heroLimit}.`, `Army points: ${deployment.pointCost}/${deployment.pointLimit}. Heroes: ${deployment.heroCount}/${deployment.heroLimit}.`)}</p>
          <button
            className="secondaryButton"
            disabled={!deployment.canDeploy}
            onClick={() => confirmCampaignAction(text("Przydzielić wybrane rezerwy do armii?", "Assign selected reserves to an army?")) && onAction(
              (state) => deployCampaignReserves(state, {
                playerId: player.id,
                planetId: deployPlanetId!,
                unitIds: selectedReserveIds,
                heroIds: selectedHeroIds,
                armyId: deployArmyId,
                armyName: newArmyName,
              }),
              text("Rezerwy zostały przydzielone do armii.", "Reserves assigned to the army."),
            )}
          >{deployArmyId ? text("Wzmocnij armię", "Reinforce army") : text("Utwórz armię", "Create army")}</button>
        </> : null}
      </section>
    </aside>
  );
}

function CampaignHistoryPanel({ campaign }: { campaign: CampaignState }) {
  const { text } = useI18n();
  const events = [...(campaign.history ?? [])].reverse().slice(0, 12);
  return (
    <aside className="campaignHistoryPanel">
      <div className="campaignPanelHeading">
        <div>
          <p className="eyebrow">{text("Dziennik kampanii", "Campaign history")}</p>
          <h3>{text("Ostatnie wydarzenia", "Recent events")}</h3>
        </div>
        <span>{campaign.history?.length ?? 0}</span>
      </div>
      {events.length === 0 ? <p className="campaignEconomyHint">{text("Brak zapisanych wydarzeń.", "No events recorded yet.")}</p> : null}
      <ol className="campaignHistoryList">
        {events.map((event) => <li key={event.id}>
          <small>{text("Tura", "Turn")} {event.turn}</small>
          <span>{campaignEventLabel(event, text)}</span>
        </li>)}
      </ol>
    </aside>
  );
}

function CampaignActivationPanel({
  campaign,
  activePlayerName,
  activePlayerIsBot,
  details,
  pendingAction,
  pendingPreview,
  onArmySelect,
  onActionSelect,
  onCancel,
  onConfirm,
}: {
  campaign: CampaignState;
  activePlayerName?: string;
  activePlayerIsBot: boolean;
  details: ReturnType<typeof getCampaignActivationDetails>;
  pendingAction?: CampaignActivationAction;
  pendingPreview?: CampaignActivationResult;
  onArmySelect: (armyId: string) => void;
  onActionSelect: (action: CampaignActivationAction) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { text } = useI18n();
  if (campaign.phase !== "Activation" && campaign.phase !== "Resolution") return null;
  if (campaign.phase === "Activation" && activePlayerIsBot) {
    return (
      <aside className="campaignActivationPanel campaignBotPanel">
        <p className="eyebrow">{text("Dowódca AI", "AI commander")}</p>
        <h3>{activePlayerName}</h3>
        <p>{text(
          "Strategiczne AI samodzielnie wybiera armię i wykonuje rozkaz. Kontrola wróci do Ciebie po decyzji bota albo rozpoczęciu bitwy.",
          "Strategic AI is selecting an army and issuing an order. Control returns after its decision or when a battle begins.",
        )}</p>
      </aside>
    );
  }
  if (campaign.phase === "Resolution") {
    return (
      <aside className="campaignActivationPanel campaignResolutionPanel">
        <p className="eyebrow">{text("Podsumowanie tury", "Turn summary")}</p>
        <h3>{text("Wszystkie armie zakończyły aktywacje", "All armies have completed activations")}</h3>
        <p>{text(
          `${campaign.armies.filter(({ activatedThisTurn }) => activatedThisTurn).length}/${campaign.armies.length} armii wykorzystało turę. Zakończ turę, aby wrócić do dochodu.`,
          `${campaign.armies.filter(({ activatedThisTurn }) => activatedThisTurn).length}/${campaign.armies.length} armies acted. End the turn to return to income.`,
        )}</p>
      </aside>
    );
  }
  return (
    <aside className="campaignActivationPanel">
      <div className="campaignPanelHeading">
        <div>
          <p className="eyebrow">{text("Aktywacja", "Activation")}</p>
          <h3>{activePlayerName ?? text("Wybierz armię", "Select an army")}</h3>
        </div>
        <span>{details.selectableArmies.length} {text("gotowe", "ready")}</span>
      </div>
      <div className="campaignActivationArmyList">
        {campaign.armies.map((army) => {
          const isSelectable = details.selectableArmies.some(({ id }) => id === army.id);
          const owner = campaign.players.find(({ id }) => id === army.ownerPlayerId);
          return (
            <button
              className={`campaignActivationArmy faction${army.factionId} ${details.selectedArmy?.id === army.id ? "isSelected" : ""}`}
              disabled={!isSelectable}
              key={army.id}
              onClick={() => onArmySelect(army.id)}
            >
              <strong>{army.name}</strong>
              <small>{owner?.name} · {army.activatedThisTurn ? text("wykorzystana", "activated") : text("gotowa", "ready")}</small>
            </button>
          );
        })}
      </div>
      {details.selectedArmy ? (
        <div className="campaignSelectedArmy">
          <div>
            <p className="eyebrow">{text("Wybrana armia", "Selected army")}</p>
            <h3>{details.selectedArmy.name}</h3>
            <p>{text("Planeta", "Planet")}: {planetName(details.selectedArmy.planetId)} · {getSectorName(details.selectedArmy.planetId, details.selectedArmy.sectorId)}</p>
          </div>
          <div className="campaignArmyMetrics">
            <span>{details.selectedArmy.units.length} {text("jednostek", "units")}</span>
            <span>{details.selectedArmy.heroIds.length} {text("bohaterów", "heroes")}</span>
            <span>{details.selectedArmyPointCost}/{campaign.rules.armyPointLimit} pkt</span>
            <span>{details.selectedArmy.movementPointsRemaining} MP</span>
          </div>
          <p className="campaignArmyComposition">
            {text("Skład", "Composition")}: {details.selectedArmy.units.map(({ templateId }) => unitName(templateId)).join(", ")}
          </p>
          <p className="campaignArmyComposition">
            {text("Bohaterowie", "Heroes")}: {details.selectedArmy.heroIds.length > 0
              ? details.selectedArmy.heroIds.map(unitName).join(", ")
              : text("brak", "none")}
          </p>
          <p className="campaignActivationHint">{text(
            "Kliknij podświetloną planetę, aby wybrać legalną trasę. Trasy z ! prowadzą do spotkania z wrogiem.",
            "Click a highlighted planet to select a legal route. Routes marked ! lead to an enemy encounter.",
          )}</p>
          {details.legalSectorTargets.length > 0 ? (
            <div className="campaignSectorActions">
              <span>{text("Atak na obecnej planecie", "Attack on current planet")}</span>
              {details.legalSectorTargets.map((sector) => (
                <button
                  className="secondaryButton"
                  key={sector.sectorId}
                  onClick={() => onActionSelect({
                    kind: "SectorAssault",
                    armyId: details.selectedArmy!.id,
                    sectorId: sector.sectorId,
                  })}
                >
                  {text("Atakuj", "Attack")} {getSectorName(sector.planetId, sector.sectorId)}
                </button>
              ))}
            </div>
          ) : null}
          <button
            className="secondaryButton"
            onClick={() => onActionSelect({ kind: "Finish", armyId: details.selectedArmy!.id })}
          >
            {text("Zakończ aktywację bez ruchu", "Finish activation without moving")}
          </button>
        </div>
      ) : <p className="campaignActivationHint">{text("Wybierz armię aktywnego dowódcy.", "Select an army of the active commander.")}</p>}
      {pendingAction && pendingPreview ? (
        <ActivationConfirmation
          campaign={campaign}
          action={pendingAction}
          outcome={pendingPreview.outcome}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      ) : null}
    </aside>
  );
}

function ActivationConfirmation({
  campaign,
  action,
  outcome,
  onCancel,
  onConfirm,
}: {
  campaign: CampaignState;
  action: CampaignActivationAction;
  outcome: CampaignActivationResult["outcome"];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { text } = useI18n();
  const army = campaign.armies.find(({ id }) => id === action.armyId)!;
  const route = "destinationPlanetId" in action
    ? getCampaignActivationDetails(campaign, action.armyId).legalRoutes.find((candidate) =>
      candidate.destinationPlanetId === action.destinationPlanetId
    )
    : undefined;
  const target = action.kind === "SectorAssault"
    ? getSectorName(army.planetId, action.sectorId)
    : "destinationPlanetId" in action
      ? planetName(action.destinationPlanetId)
      : text("bez ruchu", "no movement");
  return (
    <section className="campaignActionConfirmation">
      <p className="eyebrow">{text("Potwierdź działanie", "Confirm action")}</p>
      <strong>{army.name}</strong>
      <p>{activationActionLabel(action, text)}: {target}</p>
      {route ? <p>{text("Koszt", "Cost")}: {route.movementCost} MP · {route.planetIds.map(planetName).join(" → ")}</p> : null}
      {route?.encounter ? <p>{text("Spotkanie", "Encounter")}: {localizeEncounter(route.encounter, text)}</p> : null}
      <p>{outcome === "CapturedWithoutBattle"
        ? text("Sektor zostanie zajęty bez bitwy.", "The sector will be captured without a battle.")
        : outcome === "BattleRequired"
          ? text("Powstanie bitwa taktyczna.", "A tactical battle will begin.")
          : outcome === "Moved"
            ? text("Armia wykona ruch i przekaże inicjatywę kolejnemu dowódcy.", "The army will move and pass initiative to the next commander.")
          : text("Armia zakończy aktywację.", "The army will finish its activation.")}</p>
      <div className="campaignConfirmationActions">
        <button className="secondaryButton" onClick={onCancel}>{text("Wróć", "Back")}</button>
        <button className="primaryButton" onClick={onConfirm}>{text("Potwierdź", "Confirm")}</button>
      </div>
    </section>
  );
}

function PlanetInspector({ campaign, planetId }: { campaign: CampaignState; planetId: string }) {
  const { text } = useI18n();
  const planet = campaign.planets.find((candidate) => candidate.planetId === planetId)!;
  const definition = galacticPlanets.find(({ id }) => id === planetId)!;
  const controller = getCampaignPlanetController(campaign, planetId);
  const armies = campaign.armies.filter((army) => army.planetId === planetId);
  const base = campaign.bases.find((candidate) => candidate.planetId === planetId);
  return (
    <aside className="campaignPlanetInspector">
      <div className="planetInspectorHero">
        <p className="eyebrow">{definition.region}</p>
        <h2>{definition.name}</h2>
        <span className={`planetController controller${controller}`}>{localizeController(controller, text)}</span>
      </div>
      <div className="planetInspectorStats">
        <CampaignStat label={text("Dochód", "Income")} value={planet.sectors.reduce((sum, sector) => sum + sector.income, 0)} />
        <CampaignStat label={text("Armie", "Armies")} value={armies.length} />
        <CampaignStat label={text("Baza", "Base")} value={base ? `L${base.level}` : "—"} />
      </div>
      <section className="campaignSectorList">
        <div className="campaignPanelHeading">
          <h3>{text("Sektory planety", "Planet sectors")}</h3>
          <span>{planet.sectors.length}/3</span>
        </div>
        {planet.sectors.map((sector) => {
          const player = campaign.players.find(({ id }) => id === sector.controllerPlayerId);
          return (
            <article className={`campaignSectorRow controller${sector.ownerFactionId}`} key={sector.sectorId}>
              <i />
              <div>
                <strong>{getSectorName(planetId, sector.sectorId)}</strong>
                <small>{localizeRole(sector.role, text)} · {localizeController(sector.ownerFactionId, text)}</small>
                {player ? <small>{text("Dowódca", "Commander")}: {player.name}</small> : null}
              </div>
              <div className="sectorValues">
                <span>+{sector.income} C</span>
                <span>F{sector.fortificationLevel}</span>
              </div>
            </article>
          );
        })}
      </section>
      <section className="campaignArmyList">
        <h3>{text("Siły w systemie", "Forces in system")}</h3>
        {armies.map((army) => (
          <article key={army.id}>
            <div>
              <strong>{army.name}</strong>
              <small>{army.units.length} {text("jednostek", "units")} · {army.heroIds.length} {text("bohaterów", "heroes")}</small>
            </div>
            <span className={`armyFactionMark faction${army.factionId}`} />
          </article>
        ))}
        {armies.length === 0 ? <p>{text("Brak armii w tym systemie.", "No armies in this system.")}</p> : null}
      </section>
    </aside>
  );
}

function CampaignStat({ label, value }: { label: string; value: string | number }) {
  return <div className="campaignStat"><span>{label}</span><strong>{value}</strong></div>;
}

function localizePhase(phase: CampaignPhase, text: (pl: string, en: string) => string): string {
  const labels: Record<CampaignPhase, [string, string]> = {
    Income: ["Dochód", "Income"],
    Activation: ["Aktywacje", "Activation"],
    Battle: ["Bitwa", "Battle"],
    Resolution: ["Rozstrzygnięcie", "Resolution"],
    Finished: ["Zakończona", "Finished"],
  };
  return text(...labels[phase]);
}

function localizeController(controller: string, text: (pl: string, en: string) => string): string {
  if (controller === "Republic") return text("Republika", "Republic");
  if (controller === "Separatists") return text("Separatyści", "Separatists");
  if (controller === "Contested") return text("Sporny", "Contested");
  return text("Neutralny", "Neutral");
}

function localizeRole(role: string, text: (pl: string, en: string) => string): string {
  if (role === "Command") return text("Dowodzenie", "Command");
  if (role === "Landing") return text("Desant", "Landing");
  return text("Infrastruktura", "Infrastructure");
}

function nextStepLabel(campaign: CampaignState, text: (pl: string, en: string) => string): string {
  if (campaign.phase === "Income" && campaign.incomeCollectedForTurn !== campaign.turn) {
    return text("Rozlicz dochód, budowy i powroty bohaterów", "Resolve income, construction, and returning heroes");
  }
  if (campaign.phase === "Income") return text("Rozpocznij naprzemienne aktywacje", "Begin alternating activations");
  if (campaign.phase === "Activation") {
    const player = campaign.players.find(({ id }) => id === campaign.activePlayerId);
    return player
      ? text(`Aktywacja armii: ${player.name}`, `Army activation: ${player.name}`)
      : text("Wybierz armię", "Select an army");
  }
  if (campaign.phase === "Battle") return text("Rozegraj oczekującą bitwę", "Play the pending battle");
  if (campaign.phase === "Resolution") return text("Zakończ turę strategiczną", "End the strategic turn");
  return text("Kampania została rozstrzygnięta", "The campaign has been decided");
}

function safeActivationPreview(
  campaign: CampaignState,
  action: CampaignActivationAction,
): CampaignActivationResult | undefined {
  try {
    return applyCampaignActivationAction(campaign, action);
  } catch {
    return undefined;
  }
}

function routeKey(leftPlanetId: string, rightPlanetId: string): string {
  return [leftPlanetId, rightPlanetId].sort().join(":");
}

function planetName(planetId: string): string {
  return galacticPlanets.find(({ id }) => id === planetId)?.name ?? planetId;
}

function unitName(templateId: string): string {
  return unitTemplates.find(({ id }) => id === templateId)?.name ?? templateId;
}

function activationActionLabel(
  action: CampaignActivationAction,
  text: (pl: string, en: string) => string,
): string {
  if (action.kind === "Move") return text("Ruch", "Move");
  if (action.kind === "Invasion") return text("Inwazja", "Invasion");
  if (action.kind === "SectorAssault") return text("Atak sektora", "Sector assault");
  return text("Zakończenie aktywacji", "Finish activation");
}

function activationResultMessage(
  outcome: CampaignActivationResult["outcome"],
  text: (pl: string, en: string) => string,
): string {
  if (outcome === "Moved") return text("Armia wykonała ruch; inicjatywa przechodzi dalej.", "Army moved; initiative passes on.");
  if (outcome === "Finished") return text("Armia zakończyła aktywację.", "Army activation finished.");
  if (outcome === "CapturedWithoutBattle") return text("Sektor zdobyty bez bitwy.", "Sector captured without a battle.");
  return text("Powstał konflikt: bitwa taktyczna wymaga rozegrania.", "Conflict created: a tactical battle must be played.");
}

function campaignBotActionMessage(
  action: CampaignBotAction,
  text: (pl: string, en: string) => string,
): string {
  if (action.kind === "BuildBase") return text(`AI rozpoczyna budowę bazy na ${planetName(action.planetId)}.`, `AI begins base construction on ${planetName(action.planetId)}.`);
  if (action.kind === "UpgradeBase") return text("AI ulepsza bazę.", "AI upgrades a base.");
  if (action.kind === "Recruit") return text(`AI rekrutuje ${unitName(action.templateId)}.`, `AI recruits ${unitName(action.templateId)}.`);
  if (action.kind === "DeployReserves") return text("AI przydziela rezerwy do armii.", "AI assigns reserves to an army.");
  if (action.kind === "SectorAssault") return text("AI atakuje sektor.", "AI assaults a sector.");
  if (action.kind === "Invasion") return text(`AI rozpoczyna inwazję na ${planetName(action.planetId)}.`, `AI invades ${planetName(action.planetId)}.`);
  if (action.kind === "Move") return text(`AI przemieszcza armię do ${planetName(action.planetId)}.`, `AI moves an army to ${planetName(action.planetId)}.`);
  return text("AI kończy aktywację armii.", "AI finishes an army activation.");
}

function campaignEventLabel(
  event: CampaignEvent,
  text: (pl: string, en: string) => string,
): string {
  const player = event.playerId ? event.playerId.replace("player-", "P") : "";
  if (event.type === "CampaignStarted") return text("Rozpoczęto kampanię.", "Campaign started.");
  if (event.type === "TurnStarted") return text("Rozpoczęto nową turę.", "A new turn started.");
  if (event.type === "TurnEnded") return text("Podsumowanie tury: wszystkie aktywacje zakończone.", "Turn summary: all activations completed.");
  if (event.type === "IncomeCollected") return text(`${player} otrzymuje ${event.amount ?? 0} CR dochodu.`, `${player} receives ${event.amount ?? 0} CR income.`);
  if (event.type === "BaseConstructionQueued") return text(`Zlecono budowę bazy na ${planetName(event.planetId ?? "")}; ukończenie: tura ${event.completesOnTurn}.`, `Base construction ordered on ${planetName(event.planetId ?? "")}; completes turn ${event.completesOnTurn}.`);
  if (event.type === "BaseUpgradeQueued") return text(`Zlecono ulepszenie bazy na ${planetName(event.planetId ?? "")}; ukończenie: tura ${event.completesOnTurn}.`, `Base upgrade ordered on ${planetName(event.planetId ?? "")}; completes turn ${event.completesOnTurn}.`);
  if (event.type === "RecruitmentQueued") return text(`Zlecono rekrutację: ${unitName(event.templateId ?? "")} (${event.amount ?? 0} CR), tura ${event.completesOnTurn}.`, `Recruitment ordered: ${unitName(event.templateId ?? "")} (${event.amount ?? 0} CR), turn ${event.completesOnTurn}.`);
  if (event.type === "ReservesDeployed") return text(`Przydzielono ${event.amount ?? 0} rezerw do armii.`, `${event.amount ?? 0} reserves assigned to an army.`);
  if (event.type === "ArmyMoved") return text(`Armia przemieściła się na ${planetName(event.planetId ?? "")} (${event.amount ?? 0} MP).`, `An army moved to ${planetName(event.planetId ?? "")} (${event.amount ?? 0} MP).`);
  if (event.type === "ArmyActivationFinished") return text("Armia zakończyła aktywację.", "An army finished activation.");
  if (event.type === "SectorCaptured") return text(`Zdobyto sektor na ${planetName(event.planetId ?? "")}.`, `A sector was captured on ${planetName(event.planetId ?? "")}.`);
  if (event.type === "BattleStarted") return text(`Rozpoczęto konflikt na ${planetName(event.planetId ?? "")}.`, `A conflict began on ${planetName(event.planetId ?? "")}.`);
  const heroes = event.heroIds?.length
    ? text(` Bohaterowie: ${event.heroIds.map(unitName).join(", ")}.`, ` Heroes: ${event.heroIds.map(unitName).join(", ")}.`)
    : "";
  return text(`Bitwa rozstrzygnięta: ${localizeController(event.winnerFactionId ?? "Neutral", text)} zwycięża; straty: ${event.destroyedUnitCount ?? 0}.${heroes}`, `Battle resolved: ${localizeController(event.winnerFactionId ?? "Neutral", text)} wins; losses: ${event.destroyedUnitCount ?? 0}.${heroes}`);
}

function confirmCampaignAction(message: string): boolean {
  return typeof window === "undefined" || window.confirm(message);
}

function localizeEncounter(
  encounter: NonNullable<CampaignRoute["encounter"]>,
  text: (pl: string, en: string) => string,
): string {
  if (encounter === "EnemyArmy") return text("wroga armia", "enemy army");
  if (encounter === "EnemyBase") return text("wroga baza", "enemy base");
  return text("wroga armia i baza", "enemy army and base");
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function defaultCommanderNames(language: "pl" | "en", count: 2 | 4): string[] {
  if (language === "en") {
    return count === 2
      ? ["Republic Commander", "Separatist General"]
      : ["Republic Commander I", "Republic Commander II", "Separatist General I", "Separatist General II"];
  }
  return count === 2
    ? ["Dowódca Republiki", "Generał Separatystów"]
    : ["Dowódca Republiki I", "Dowódca Republiki II", "Generał Separatystów I", "Generał Separatystów II"];
}
