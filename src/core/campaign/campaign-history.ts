import type { CampaignEvent, CampaignState } from "./campaign-types";

const HISTORY_LIMIT = 160;

export function appendCampaignEvent(
  state: CampaignState,
  event: Omit<CampaignEvent, "id" | "turn" | "phase"> & Partial<Pick<CampaignEvent, "turn" | "phase">>,
): CampaignState {
  const history = state.history ?? [];
  const turn = event.turn ?? state.turn;
  const phase = event.phase ?? state.phase;
  const previousSerial = Number(history.at(-1)?.id.split(":").at(-1)) || 0;
  const nextEvent: CampaignEvent = {
    ...event,
    id: `${state.id}:event:${turn}:${previousSerial + 1}`,
    turn,
    phase,
  };
  return { ...state, history: [...history, nextEvent].slice(-HISTORY_LIMIT) };
}
