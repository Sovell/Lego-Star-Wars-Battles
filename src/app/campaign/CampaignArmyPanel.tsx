import { useEffect, useState } from "react";
import { unitTemplates } from "../../data";
import { deployCampaignReserves, type CampaignState } from "../../core/campaign";
import { useI18n } from "../../i18n";
import { getCampaignReserveDeploymentPreview } from "./campaign-economy-model";

export function CampaignArmyPanel({
  campaign,
  playerId,
  selectedArmyId,
  onArmySelect,
  onAction,
}: {
  campaign: CampaignState;
  playerId: string;
  selectedArmyId?: string;
  onArmySelect: (armyId: string) => void;
  onAction: (action: (state: CampaignState) => CampaignState, message: string) => void;
}) {
  const { text } = useI18n();
  const player = campaign.players.find(({ id }) => id === playerId);
  const bases = campaign.bases.filter(({ ownerPlayerId }) => ownerPlayerId === playerId);
  const armies = campaign.armies.filter(({ ownerPlayerId }) => ownerPlayerId === playerId);
  const [planetId, setPlanetId] = useState<string>();
  const [targetArmyId, setTargetArmyId] = useState<string>();
  const [unitIds, setUnitIds] = useState<string[]>([]);
  const [heroIds, setHeroIds] = useState<string[]>([]);
  const [newArmyName, setNewArmyName] = useState("");

  useEffect(() => {
    setPlanetId((current) => bases.some(({ planetId: id }) => id === current) ? current : bases[0]?.planetId);
  }, [bases]);

  useEffect(() => {
    setTargetArmyId(undefined);
    setUnitIds([]);
    setHeroIds([]);
  }, [planetId]);

  if (!player || player.control === "Bot") return null;
  const deployment = planetId
    ? getCampaignReserveDeploymentPreview(campaign, playerId, planetId, unitIds, heroIds, targetArmyId)
    : undefined;
  const economyOpen = campaign.phase === "Income" && campaign.incomeCollectedForTurn === campaign.turn;
  const canDeploy = Boolean(economyOpen && deployment?.canDeploy);

  return <aside className="campaignArmyPanel">
    <div className="campaignPanelHeading">
      <div><p className="eyebrow">{text("Siły ekspedycyjne", "Expeditionary forces")}</p><h3>{text("Moje armie", "My armies")}</h3></div>
      <span>{armies.length}</span>
    </div>
    <div className="campaignArmyCommandList">
      {armies.map((army) => <button className={army.id === selectedArmyId ? "isSelected" : ""} key={army.id} onClick={() => onArmySelect(army.id)}>
        <strong>{army.name}</strong><small>{planetLabel(army.planetId)} · {army.units.length} {text("jednostek", "units")} · {army.heroIds.length} {text("bohaterów", "heroes")}</small>
      </button>)}
      {armies.length === 0 ? <p className="campaignEconomyHint">{text("Brak aktywnych armii.", "No active armies.")}</p> : null}
    </div>

    <section className="campaignArmyDeployment">
      <div><h4>{text("Rezerwy i nowe armie", "Reserves and new armies")}</h4><p>{economyOpen ? text("Przydziel rezerwy albo sformuj nową armię przy własnej bazie.", "Assign reserves or form a new army at one of your bases.") : text("Przydział rezerw jest dostępny po rozliczeniu dochodu.", "Reserve deployment is available after income is collected.")}</p></div>
      {bases.length === 0 ? <p className="campaignEconomyHint">{text("Najpierw przejmij planetę i zbuduj bazę.", "Capture a planet and build a base first.")}</p> : null}
      {bases.length > 0 ? <label className="campaignEconomySelect">{text("Baza", "Base")}
        <select value={planetId ?? ""} onChange={(event) => setPlanetId(event.target.value || undefined)}>{bases.map((base) => <option key={base.id} value={base.planetId}>{planetLabel(base.planetId)} · L{base.level}</option>)}</select>
      </label> : null}
      {deployment ? <>
        <label className="campaignEconomySelect">{text("Przydział", "Assignment")}
          <select value={targetArmyId ?? ""} onChange={(event) => setTargetArmyId(event.target.value || undefined)}><option value="">{text("Nowa armia", "New army")}</option>{deployment.armies.map((army) => <option key={army.id} value={army.id}>{army.name}</option>)}</select>
        </label>
        {!targetArmyId ? <label className="campaignEconomySelect">{text("Nazwa armii", "Army name")}<input value={newArmyName} onChange={(event) => setNewArmyName(event.target.value)} placeholder={text("opcjonalnie", "optional")} /></label> : null}
        <div className="campaignReserveList">
          {deployment.reserves.map((reserve) => <label key={reserve.id}><input type="checkbox" checked={unitIds.includes(reserve.id)} onChange={(event) => setUnitIds((current) => event.target.checked ? [...current, reserve.id] : current.filter((id) => id !== reserve.id))} />{templateName(reserve.templateId)}</label>)}
          {deployment.heroes.map((hero) => <label key={hero.heroId}><input type="checkbox" checked={heroIds.includes(hero.heroId)} onChange={(event) => setHeroIds((current) => event.target.checked ? [...current, hero.heroId] : current.filter((id) => id !== hero.heroId))} />{templateName(hero.heroId)} · {text("bohater", "hero")}</label>)}
          {deployment.reserves.length + deployment.heroes.length === 0 ? <p className="campaignEconomyHint">{text("Ta baza nie ma jeszcze rezerw.", "This base has no reserves yet.")}</p> : null}
        </div>
        <p className="campaignArmyCapacity">{text(`Punkty: ${deployment.pointCost}/${deployment.pointLimit} · Bohaterowie: ${deployment.heroCount}/${deployment.heroLimit}`, `Points: ${deployment.pointCost}/${deployment.pointLimit} · Heroes: ${deployment.heroCount}/${deployment.heroLimit}`)}</p>
        <button className="primaryButton" disabled={!canDeploy} onClick={() => {
          if (!window.confirm(text("Przydzielić wybrane rezerwy?", "Assign the selected reserves?"))) return;
          onAction((state) => deployCampaignReserves(state, { playerId, planetId: planetId!, unitIds, heroIds, armyId: targetArmyId, armyName: newArmyName }), text("Rezerwy zostały przydzielone do armii.", "Reserves were assigned to the army."));
        }}>{targetArmyId ? text("Wzmocnij armię", "Reinforce army") : text("Utwórz armię", "Create army")}</button>
      </> : null}
    </section>
  </aside>;
}

function templateName(templateId: string) { return unitTemplates.find(({ id }) => id === templateId)?.name ?? templateId; }
function planetLabel(planetId: string) { return planetId.charAt(0).toUpperCase() + planetId.slice(1); }
