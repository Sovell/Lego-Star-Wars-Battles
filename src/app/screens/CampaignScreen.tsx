import { useEffect, useMemo, useState } from "react";
import {
  beginCampaignActivationPhase,
  createCampaignState,
  createStandardCampaignPlayers,
  getCampaignPlanetController,
  processCampaignEconomy,
  type CampaignPhase,
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
import "../styles/campaign-screen.css";

type CampaignScreenProps = {
  savedCampaign?: SavedCampaign;
  onCampaignChange: (campaign: SavedCampaign | undefined) => void;
};

export function CampaignScreen({ savedCampaign, onCampaignChange }: CampaignScreenProps) {
  const { language, text } = useI18n();
  const persistence = useMemo(() => createPersistenceAdapter(), []);
  const [savedCampaigns, setSavedCampaigns] = useState<SavedCampaign[]>([]);
  const [campaignName, setCampaignName] = useState(text("Wojna o Zewnętrzne Rubieże", "Outer Rim War"));
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
  const [playerNames, setPlayerNames] = useState<string[]>(() => defaultCommanderNames(language, 2));
  const [seed, setSeed] = useState(() => Math.floor(Date.now() / 1000) % 1_000_000);
  const [selectedPlanetId, setSelectedPlanetId] = useState<string>();
  const [status, setStatus] = useState("");

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
        players: createStandardCampaignPlayers(normalizedNames),
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

  async function commitCampaign(campaign: CampaignState, message: string) {
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
    } catch (error) {
      setStatus(errorMessage(error, text("Zmiana działa w pamięci, ale zapis się nie udał.", "The change is active in memory, but saving failed.")));
    }
  }

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
      />
    );
  }

  const campaign = savedCampaign.campaign;
  const selectedPlanet = campaign.planets.find(({ planetId }) => planetId === selectedPlanetId)
    ?? campaign.planets[0];
  const overview = getCampaignOverview(campaign);
  const activePlayer = campaign.players.find(({ id }) => id === campaign.activePlayerId);

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

      {status ? <p className="campaignStatus" role="status">{status}</p> : null}

      <section className="campaignPlayerStrip">
        {campaign.players.map((player) => (
          <article
            className={`campaignPlayerCard faction${player.factionId} ${player.id === activePlayer?.id ? "isActive" : ""}`}
            key={player.id}
          >
            <span>{player.factionId === "Republic" ? text("Republika", "Republic") : text("Separatyści", "Separatists")}</span>
            <strong>{player.name}</strong>
            <small>{player.credits} {text("kredytów", "credits")}</small>
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
          onPlanetSelect={setSelectedPlanetId}
        />
        {selectedPlanet ? <PlanetInspector campaign={campaign} planetId={selectedPlanet.planetId} /> : null}
      </section>

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
          )}>
            {text("Rozpocznij aktywacje", "Begin activations")}
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

function CampaignGalaxy({ campaign, selectedPlanetId, onPlanetSelect }: {
  campaign: CampaignState;
  selectedPlanetId?: string;
  onPlanetSelect: (planetId: string) => void;
}) {
  const { text } = useI18n();
  const nodes = buildCampaignMapNodes(campaign);
  const positionById = new Map(nodes.map((node) => [node.id, node]));
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
            return <line key={lane.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
          })}
        </svg>
        {nodes.map((node) => (
          <button
            aria-label={node.playable ? node.name : `${node.name} — ${text("niedostępna", "unavailable")}`}
            className={`campaignPlanetNode controller${node.controller} ${selectedPlanetId === node.id ? "isSelected" : ""} ${node.playable ? "" : "isLocked"}`}
            disabled={!node.playable}
            key={node.id}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            onClick={() => onPlanetSelect(node.id)}
          >
            <span className="campaignPlanetOrb">
              {node.playable ? node.sectorControllers.map((controller, index) => (
                <i className={`sectorPip controller${controller}`} key={index} />
              )) : <i className="planetLock">×</i>}
            </span>
            <strong>{node.name}</strong>
            {node.armyCount > 0 ? <small className="planetArmyBadge">{node.armyCount}A</small> : null}
            {node.baseLevel ? <small className="planetBaseBadge">B{node.baseLevel}</small> : null}
          </button>
        ))}
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
