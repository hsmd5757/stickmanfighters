// Character registry. Future characters register here with their own
// config, display text and ability summary. Only RealStickman exists now.
import { REALSTICKMAN, validateCharacter } from "./character/config.js";

export const CHARACTERS = {
  realstickman: {
    id: "realstickman",
    name: "REALSTICKMAN",
    config: validateCharacter(REALSTICKMAN),
    description: "A close-range fighter built around direct strikes, area attacks, rapid punches, and a directional finisher.",
    abilities: [
      "M1: BASIC PUNCH",
      "F: BLOCK",
      "1: GROUND SLAM",
      "2: FORWARD BURST",
      "3: RAPID PUNCH BARRAGE",
      "4: PHANTOM STRIKE",
    ],
  },
};

export const DEFAULT_CHARACTER = "realstickman";
