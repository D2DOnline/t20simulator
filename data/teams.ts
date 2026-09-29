import type { BowlingStyle, MatchConfig, Phase, Player, Role, TeamConfig } from "../lib/sim/types";

type Bowl = [economy: number, strikeRate: number, style: BowlingStyle, phases: Phase[]];

function player(
  id: string,
  name: string,
  role: Role,
  strikeRate: number,
  average: number,
  bowl?: Bowl,
): Player {
  return {
    id,
    name,
    role,
    batting: { strikeRate, average },
    bowling: bowl
      ? { economy: bowl[0], strikeRate: bowl[1], style: bowl[2], phases: bowl[3] }
      : undefined,
  };
}

/** Overs are 1-based. Each bowler appears at most four times and every over is filled. */
function spell(entries: Record<string, number[]>): string[] {
  const plan = Array.from({ length: 20 }, () => "");
  for (const [id, overs] of Object.entries(entries)) {
    if (overs.length > 4) throw new Error(`${id} is scheduled for ${overs.length} overs`);
    for (const over of overs) {
      if (plan[over - 1]) throw new Error(`Over ${over} is bowled by both ${plan[over - 1]} and ${id}`);
      plan[over - 1] = id;
    }
  }
  if (plan.some((id) => !id)) throw new Error("Bowling plan is missing an over");
  return plan;
}

function team(
  id: string,
  name: string,
  shortName: string,
  averageScore: number,
  players: Player[],
  bowling: Record<string, number[]>,
): TeamConfig {
  const bowlingPlan = spell(bowling);
  const known = new Set(players.map((entry) => entry.id));
  for (const bowlerId of bowlingPlan) {
    if (!known.has(bowlerId)) throw new Error(`${name} plan uses unknown bowler ${bowlerId}`);
  }
  return { id, name, shortName, averageScore, players, bowlingPlan, targets: [] };
}

const pacePP: Phase[] = ["powerplay", "death"];
const spinMid: Phase[] = ["middle"];
const paceDeath: Phase[] = ["death", "middle"];

export const TEAMS: TeamConfig[] = [
  team("india", "India", "IND", 176, [
    player("ind-rohit", "Rohit Sharma", "batter", 142, 32),
    player("ind-gill", "Shubman Gill", "batter", 148, 38),
    player("ind-kohli", "Virat Kohli", "batter", 139, 53),
    player("ind-sky", "Suryakumar Yadav", "batter", 172, 40),
    player("ind-pant", "Rishabh Pant", "wicketkeeper", 155, 30),
    player("ind-hardik", "Hardik Pandya", "allrounder", 148, 29, [8.3, 22, "pace", paceDeath]),
    player("ind-jadeja", "Ravindra Jadeja", "allrounder", 128, 26, [7.1, 24, "spin", spinMid]),
    player("ind-axar", "Axar Patel", "allrounder", 140, 23, [7.3, 26, "spin", spinMid]),
    player("ind-bumrah", "Jasprit Bumrah", "bowler", 78, 8, [6.6, 15.5, "pace", pacePP]),
    player("ind-kuldeep", "Kuldeep Yadav", "bowler", 72, 9, [7.6, 16.5, "spin", spinMid]),
    player("ind-arshdeep", "Arshdeep Singh", "bowler", 92, 10, [8.1, 17, "pace", pacePP]),
  ], {
    "ind-bumrah": [1, 3, 16, 18],
    "ind-arshdeep": [2, 4, 17, 20],
    "ind-hardik": [5, 10, 13, 19],
    "ind-jadeja": [6, 8, 12, 15],
    "ind-kuldeep": [7, 9, 11, 14],
  }),
  team("australia", "Australia", "AUS", 172, [
    player("aus-head", "Travis Head", "batter", 168, 36),
    player("aus-warner", "David Warner", "batter", 142, 33),
    player("aus-marsh", "Mitchell Marsh", "allrounder", 140, 31, [8.6, 24, "pace", paceDeath]),
    player("aus-maxwell", "Glenn Maxwell", "allrounder", 156, 28, [8.1, 22, "spin", spinMid]),
    player("aus-david", "Tim David", "batter", 165, 25),
    player("aus-wade", "Matthew Wade", "wicketkeeper", 134, 24),
    player("aus-stoinis", "Marcus Stoinis", "allrounder", 146, 27, [8.8, 26, "pace", ["middle"]]),
    player("aus-cummins", "Pat Cummins", "bowler", 118, 14, [7.3, 18, "pace", pacePP]),
    player("aus-starc", "Mitchell Starc", "bowler", 128, 12, [7.8, 16, "pace", pacePP]),
    player("aus-zampa", "Adam Zampa", "bowler", 70, 8, [7.0, 17, "spin", spinMid]),
    player("aus-hazlewood", "Josh Hazlewood", "bowler", 64, 7, [7.4, 18, "pace", ["powerplay", "middle"]]),
  ], {
    "aus-starc": [1, 3, 16, 18],
    "aus-hazlewood": [2, 4, 17, 20],
    "aus-cummins": [5, 11, 15, 19],
    "aus-stoinis": [6, 10],
    "aus-zampa": [7, 9, 12, 14],
    "aus-maxwell": [8, 13],
  }),
  team("england", "England", "ENG", 178, [
    player("eng-buttler", "Jos Buttler", "wicketkeeper", 148, 34),
    player("eng-salt", "Phil Salt", "batter", 166, 32),
    player("eng-bairstow", "Jonny Bairstow", "batter", 144, 30),
    player("eng-brook", "Harry Brook", "batter", 152, 36),
    player("eng-livingstone", "Liam Livingstone", "allrounder", 150, 26, [8.4, 22, "spin", spinMid]),
    player("eng-moeen", "Moeen Ali", "allrounder", 140, 24, [7.6, 24, "spin", spinMid]),
    player("eng-curran", "Sam Curran", "allrounder", 138, 22, [8.5, 20, "pace", paceDeath]),
    player("eng-archer", "Jofra Archer", "bowler", 110, 12, [7.5, 16, "pace", pacePP]),
    player("eng-rashid", "Adil Rashid", "bowler", 96, 12, [7.2, 17, "spin", spinMid]),
    player("eng-wood", "Mark Wood", "bowler", 88, 9, [8.2, 16.5, "pace", pacePP]),
    player("eng-topley", "Reece Topley", "bowler", 74, 8, [8.0, 18, "pace", ["powerplay"]]),
  ], {
    "eng-archer": [1, 3, 16, 18],
    "eng-wood": [2, 4, 17, 20],
    "eng-topley": [5, 19],
    "eng-curran": [6, 10, 13, 15],
    "eng-rashid": [7, 9, 12, 14],
    "eng-livingstone": [8, 11],
  }),
  team("pakistan", "Pakistan", "PAK", 166, [
    player("pak-rizwan", "Mohammad Rizwan", "wicketkeeper", 128, 48),
    player("pak-babar", "Babar Azam", "batter", 130, 42),
    player("pak-fakhar", "Fakhar Zaman", "batter", 144, 24),
    player("pak-usman", "Usman Khan", "batter", 150, 28),
    player("pak-iftikhar", "Iftikhar Ahmed", "allrounder", 142, 24, [8.2, 26, "spin", ["middle"]]),
    player("pak-shadab", "Shadab Khan", "allrounder", 136, 20, [7.8, 20, "spin", spinMid]),
    player("pak-nawaz", "Mohammad Nawaz", "allrounder", 132, 18, [7.5, 22, "spin", spinMid]),
    player("pak-shaheen", "Shaheen Afridi", "bowler", 90, 9, [7.6, 16, "pace", pacePP]),
    player("pak-naseem", "Naseem Shah", "bowler", 86, 8, [7.9, 18, "pace", pacePP]),
    player("pak-rauf", "Haris Rauf", "bowler", 100, 10, [8.0, 17, "pace", paceDeath]),
    player("pak-haris", "Mohammad Haris", "batter", 148, 22),
  ], {
    "pak-shaheen": [1, 3, 16, 18],
    "pak-naseem": [2, 4, 17, 20],
    "pak-rauf": [5, 10, 15, 19],
    "pak-shadab": [6, 8, 12, 14],
    "pak-nawaz": [7, 9, 11, 13],
  }),
  team("south-africa", "South Africa", "SA", 170, [
    player("sa-de-kock", "Quinton de Kock", "wicketkeeper", 140, 38),
    player("sa-bavuma", "Temba Bavuma", "batter", 122, 28),
    player("sa-markram", "Aiden Markram", "allrounder", 146, 32, [8.0, 28, "spin", spinMid]),
    player("sa-miller", "David Miller", "batter", 142, 36),
    player("sa-klaasen", "Heinrich Klaasen", "batter", 164, 34),
    player("sa-stubbs", "Tristan Stubbs", "batter", 150, 30),
    player("sa-jansen", "Marco Jansen", "allrounder", 130, 16, [7.8, 18, "pace", pacePP]),
    player("sa-maharaj", "Keshav Maharaj", "bowler", 86, 10, [6.9, 22, "spin", spinMid]),
    player("sa-rabada", "Kagiso Rabada", "bowler", 100, 12, [7.5, 16, "pace", pacePP]),
    player("sa-nortje", "Anrich Nortje", "bowler", 92, 9, [7.7, 15.5, "pace", paceDeath]),
    player("sa-ngidi", "Lungi Ngidi", "bowler", 80, 8, [8.2, 18, "pace", pacePP]),
  ], {
    "sa-rabada": [1, 3, 16, 18],
    "sa-ngidi": [2, 4, 17, 20],
    "sa-jansen": [5, 10, 15, 19],
    "sa-maharaj": [6, 8, 12, 14],
    "sa-nortje": [7, 9, 11, 13],
  }),
  team("new-zealand", "New Zealand", "NZ", 168, [
    player("nz-conway", "Devon Conway", "wicketkeeper", 132, 36),
    player("nz-allen", "Finn Allen", "batter", 170, 26),
    player("nz-williamson", "Kane Williamson", "batter", 124, 34),
    player("nz-mitchell", "Daryl Mitchell", "batter", 142, 38),
    player("nz-phillips", "Glenn Phillips", "allrounder", 150, 30, [8.4, 24, "spin", ["middle"]]),
    player("nz-chapman", "Mark Chapman", "batter", 140, 26),
    player("nz-santner", "Mitchell Santner", "allrounder", 126, 18, [7.2, 22, "spin", spinMid]),
    player("nz-southee", "Tim Southee", "bowler", 118, 12, [8.4, 18, "pace", pacePP]),
    player("nz-boult", "Trent Boult", "bowler", 110, 14, [7.6, 16, "pace", pacePP]),
    player("nz-ferguson", "Lockie Ferguson", "bowler", 96, 10, [8.0, 16.5, "pace", paceDeath]),
    player("nz-sodhi", "Ish Sodhi", "bowler", 84, 9, [7.8, 18, "spin", spinMid]),
  ], {
    "nz-boult": [1, 3, 16, 18],
    "nz-southee": [2, 4, 17, 20],
    "nz-ferguson": [5, 10, 15, 19],
    "nz-santner": [6, 8, 12, 14],
    "nz-sodhi": [7, 9, 11, 13],
  }),
  team("west-indies", "West Indies", "WI", 174, [
    player("wi-pooran", "Nicholas Pooran", "wicketkeeper", 158, 32),
    player("wi-king", "Brandon King", "batter", 136, 26),
    player("wi-charles", "Johnson Charles", "batter", 140, 22),
    player("wi-hetmyer", "Shimron Hetmyer", "batter", 148, 28),
    player("wi-powell", "Rovman Powell", "batter", 152, 26),
    player("wi-russell", "Andre Russell", "allrounder", 168, 24, [9.2, 18, "pace", paceDeath]),
    player("wi-holder", "Jason Holder", "allrounder", 132, 20, [7.8, 20, "pace", pacePP]),
    player("wi-mayers", "Kyle Mayers", "allrounder", 138, 22, [8.6, 26, "pace", ["middle"]]),
    player("wi-narine", "Sunil Narine", "bowler", 140, 16, [6.4, 20, "spin", spinMid]),
    player("wi-hosein", "Akeal Hosein", "bowler", 90, 10, [6.8, 22, "spin", spinMid]),
    player("wi-joseph", "Alzarri Joseph", "bowler", 100, 11, [8.0, 17, "pace", pacePP]),
  ], {
    "wi-joseph": [1, 3, 16, 18],
    "wi-holder": [2, 4, 17, 20],
    "wi-russell": [5, 10, 15, 19],
    "wi-narine": [6, 8, 12, 14],
    "wi-hosein": [7, 9, 11, 13],
  }),
];

export function cloneTeam(teamConfig: TeamConfig): TeamConfig {
  return structuredClone(teamConfig);
}

export function defaultConfig(seed = 1): MatchConfig {
  return {
    teamA: cloneTeam(TEAMS[0]),
    teamB: cloneTeam(TEAMS[1]),
    battingFirst: "A",
    seed,
    allowHighWicketTargets: false,
  };
}
