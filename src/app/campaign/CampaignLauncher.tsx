import type { SavedCampaign } from "../../core/persistence/save-types";
import type { CampaignPhase } from "../../core/campaign";
import { useI18n } from "../../i18n";

export type CampaignLauncherProps = {
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
};

export function CampaignLauncher(props: CampaignLauncherProps) {
  const { text } = useI18n();
  return (
    <section className="campaignLauncher">
      <div className="campaignLauncherIntro">
        <p className="eyebrow">GALACTIC CONQUEST</p>
        <h2>{text("Rozpocznij wojnę o galaktykę", "Begin the war for the galaxy")}</h2>
        <p>{text("Dowódcy prowadzą armie przez hiperlinie, zdobywają sektory i rozwijają bazy. Każde bronione terytorium może rozpocząć pełną bitwę taktyczną.", "Commanders move armies through hyperlanes, capture sectors, and develop bases. Every defended territory can trigger a full tactical battle.")}</p>
      </div>
      <div className="campaignLauncherGrid">
        <section className="campaignSetupCard">
          <div className="campaignSectionHeading"><span>01</span><div><p className="eyebrow">{text("Nowa kampania", "New campaign")}</p><h3>{text("Konfiguracja dowódców", "Commander setup")}</h3></div></div>
          <label>{text("Nazwa kampanii", "Campaign name")}<input value={props.campaignName} onChange={(event) => props.onCampaignNameChange(event.target.value)} /></label>
          <div className="campaignModeToggle">
            <button className={props.playerCount === 2 ? "active" : ""} onClick={() => props.onPlayerCountChange(2)}>1 vs 1</button>
            <button className={props.playerCount === 4 ? "active" : ""} onClick={() => props.onPlayerCountChange(4)}>2 vs 2</button>
          </div>
          <div className="campaignCommanderGrid">
            {props.playerNames.map((name, index) => <label className={index < props.playerCount / 2 ? "republicField" : "separatistField"} key={index}>
              {index < props.playerCount / 2 ? text("Dowódca Republiki", "Republic commander") : text("Dowódca Separatystów", "Separatist commander")}
              <input value={name} onChange={(event) => props.onPlayerNameChange(index, event.target.value)} />
            </label>)}
          </div>
          <label>{text("Ziarno galaktyki", "Galaxy seed")}<input type="number" value={props.seed} onChange={(event) => props.onSeedChange(Number(event.target.value))} /></label>
          <label>{text("Kontrola Separatystów w bitwach", "Separatist tactical control")}
            <select value={props.opponentControl} onChange={(event) => props.onOpponentControlChange(event.target.value as "Human" | "Bot")}>
              <option value="Bot">{text("AI", "AI")}</option><option value="Human">{text("Człowiek (hot-seat)", "Human (hot-seat)")}</option>
            </select>
          </label>
          <button className="primaryButton" onClick={props.onCreate}>{text("Utwórz kampanię", "Create campaign")}</button>
        </section>
        <section className="campaignSavesCard">
          <div className="campaignSectionHeading"><span>02</span><div><p className="eyebrow">{text("Archiwum", "Archive")}</p><h3>{text("Zapisane kampanie", "Saved campaigns")}</h3></div></div>
          <div className="campaignSaveList">
            {props.savedCampaigns.map((saved) => <article className="campaignSaveRow" key={saved.id}><div><strong>{saved.name}</strong><small>{text("Tura", "Turn")} {saved.campaign.turn} · {localizePhase(saved.campaign.phase, text)} · {saved.campaign.players.length} {text("graczy", "players")}</small></div><button className="secondaryButton" onClick={() => props.onLoad(saved.id)}>{text("Wczytaj", "Load")}</button><button className="dangerButton" onClick={() => props.onDelete(saved.id)}>{text("Usuń", "Delete")}</button></article>)}
            {props.savedCampaigns.length === 0 ? <p className="campaignEmptyState">{text("Nie ma jeszcze zapisanych kampanii.", "There are no saved campaigns yet.")}</p> : null}
          </div>
        </section>
      </div>
      {props.status ? <p className="campaignStatus" role="status">{props.status}</p> : null}
    </section>
  );
}

function localizePhase(phase: CampaignPhase, text: (pl: string, en: string) => string): string {
  const labels: Record<CampaignPhase, [string, string]> = {
    Income: ["Dochód", "Income"], Activation: ["Aktywacje", "Activation"], Battle: ["Bitwa", "Battle"], Resolution: ["Rozstrzygnięcie", "Resolution"], Finished: ["Zakończona", "Finished"],
  };
  return text(...labels[phase]);
}
