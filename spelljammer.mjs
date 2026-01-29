/**
 * Spelljammer Ship Combat Module for Foundry VTT v13 + D&D 5e 5.2.x
 * Implements custom ship combat mechanics with crew roles and power systems.
 */

import { SpelljammerShipSheet } from "./module/sheets/SpelljammerShipSheet.mjs";
import { SpelljammerRolls } from "./module/helpers/rolls.mjs";

/* -------------------------------------------- */
/*  Module Constants                            */
/* -------------------------------------------- */

export const MODULE_ID = "spelljammer-module";

export const CREW_ROLES = {
  captain: "Captain",
  helmsman: "Helmsman",
  gunner: "Gunner",
  boatswain: "Boatswain"
};

export const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

// Direction to rotation angle mapping (for token arrows)
export const DIRECTION_ANGLES = {
  "N": 0,
  "NE": 45,
  "E": 90,
  "SE": 135,
  "S": 180,
  "SW": 225,
  "W": 270,
  "NW": 315
};

export const POWER_MODULES = {
  weaponsArray: {
    id: "weaponsArray",
    name: "Weapons Array",
    cost: 1,
    description: "+1d6 damage to all weapon attacks until the start of your next turn",
    effect: "damage",
    effectValue: "1d6"
  },
  deflectorGrid: {
    id: "deflectorGrid",
    name: "Deflector Grid",
    cost: 1,
    description: "Ship gains resistance to one damage type until the start of your next turn",
    effect: "resistance"
  },
  thrusterOverride: {
    id: "thrusterOverride",
    name: "Thruster Override",
    cost: 1,
    description: "+100 feet to the ship's maximum acceleration or deceleration this turn",
    effect: "movement",
    effectValue: 100
  },
  hullReinforcement: {
    id: "hullReinforcement",
    name: "Hull Reinforcement",
    cost: 1,
    description: "Ship gains 2d8 temporary hit points",
    effect: "tempHp",
    effectValue: "2d8"
  },
  systemRestoration: {
    id: "systemRestoration",
    name: "System Restoration",
    cost: 1,
    description: "If a weapon system or module has dropped to zero hit points, restore it to functioning at 1 hit point",
    effect: "repair"
  },
  warpCoreCharge: {
    id: "warpCoreCharge",
    name: "Warp Core Charge",
    cost: 2,
    description: "After 3 consecutive turns of charging, can initiate warp jump to escape combat",
    effect: "warp"
  }
};

export const OVERDRIVE_DC_TABLE = {
  0: 0,
  100: 0,
  200: 5,
  300: 5,
  400: 10,
  500: 10,
  600: 15,
  700: 15,
  800: 20,
  900: 20
};

/* -------------------------------------------- */
/*  Ocean Court Express - Pre-configured Ship   */
/* -------------------------------------------- */

export const OCEAN_COURT_EXPRESS = {
  name: "Ocean Court Express",
  type: "vehicle",
  img: "icons/svg/ship.svg",
  system: {
    vehicleType: "water",
    attributes: {
      ac: { flat: 16 },
      hp: { value: 100, max: 100, temp: 0 },
      capacity: {
        creature: "15 crew",
        cargo: 20
      }
    },
    traits: {
      size: "huge",
      dimensions: "60 ft. × 20 ft."
    },
    details: {
      source: "Spelljammer Ship Combat Module",
      description: {
        value: `<h2>Ocean Court Express</h2>
<p><strong>Class:</strong> Frigate (2×2)</p>
<p><strong>Crew:</strong> 5-15 (minimum 5 required)</p>
<h3>Ship Statistics</h3>
<ul>
<li><strong>Armor Class:</strong> 16</li>
<li><strong>Hull Points:</strong> 100</li>
<li><strong>Max Acceleration:</strong> 200 ft/round</li>
<li><strong>Max Deceleration:</strong> 200 ft/round</li>
</ul>
<h3>Armament</h3>
<ul>
<li><strong>2× Flower Cannons</strong> - 3d10 radiant, 300/900 ft., 90° firing arc (port/starboard)</li>
<li><strong>1× Carronade</strong> - 8d10 bludgeoning, 500/1500 ft., 45° firing arc (bow), Utilize property</li>
</ul>
<h3>Power Modules</h3>
<p>All standard power modules installed: Weapons Array, Deflector Grid, Thruster Override, Hull Reinforcement, System Restoration, and Warp Core Charge.</p>`
      }
    }
  },
  flags: {
    [MODULE_ID]: {
      initialized: true,
      shipClass: "Frigate (2×2)",
      velocity: {
        current: 0,
        direction: "N",
        maxAcceleration: 200,
        maxDeceleration: 200
      },
      crewAssignments: {
        captain: null,
        helmsman: null,
        gunners: [null, null],
        boatswain: null
      },
      crewRequirements: {
        minimum: 5,
        maximum: 15
      },
      powerModules: {
        weaponsArray: { active: false, hp: 10, maxHp: 10 },
        deflectorGrid: { active: false, hp: 10, maxHp: 10 },
        thrusterOverride: { active: false, hp: 10, maxHp: 10 },
        hullReinforcement: { active: false, hp: 10, maxHp: 10 },
        systemRestoration: { active: false, hp: 10, maxHp: 10 },
        warpCoreCharge: { active: false, hp: 10, maxHp: 10 }
      },
      warpChargeProgress: 0,
      weapons: [
        {
          name: "Flower Cannon (Port)",
          damage: "3d10",
          damageType: "radiant",
          range: "300/900",
          position: "port",
          firingArc: 90,
          properties: [],
          hp: 10,
          maxHp: 10,
          assignedGunner: null
        },
        {
          name: "Flower Cannon (Starboard)",
          damage: "3d10",
          damageType: "radiant",
          range: "300/900",
          position: "starboard",
          firingArc: 90,
          properties: [],
          hp: 10,
          maxHp: 10,
          assignedGunner: null
        },
        {
          name: "Carronade (Bow)",
          damage: "8d10",
          damageType: "bludgeoning",
          range: "500/1500",
          position: "bow",
          firingArc: 45,
          properties: ["Utilize"],
          hp: 10,
          maxHp: 10,
          assignedGunner: null
        }
      ],
      airSupply: {
        current: 30,
        max: 30
      },
      captainCommand: null,
      combat: {
        overdriveDisabled: false,
        evadeActive: false,
        jammingTarget: null
      }
    }
  }
};

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Spelljammer Ship Combat`);

  // Register module settings
  registerSettings();

  // Pre-load templates
  loadTemplates([
    `modules/${MODULE_ID}/templates/spelljammer-sheet.hbs`,
    `modules/${MODULE_ID}/templates/parts/ship-stats.hbs`,
    `modules/${MODULE_ID}/templates/parts/captain-station.hbs`,
    `modules/${MODULE_ID}/templates/parts/helmsman-station.hbs`,
    `modules/${MODULE_ID}/templates/parts/gunner-station.hbs`,
    `modules/${MODULE_ID}/templates/parts/boatswain-station.hbs`,
    `modules/${MODULE_ID}/templates/parts/crew-assignment.hbs`,
    `modules/${MODULE_ID}/templates/parts/weapons-list.hbs`
  ]);

  // Register custom sheet using legacy API
  Actors.registerSheet(MODULE_ID, SpelljammerShipSheet, {
    types: ["vehicle"],
    makeDefault: false,
    label: "Spelljammer Ship Sheet"
  });

  // Add spelljammer rolls helper to game
  game.spelljammer = {
    rolls: SpelljammerRolls,
    createOceanCourtExpress: createOceanCourtExpress,
    MODULE_ID: MODULE_ID
  };
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Spelljammer Ship Combat Ready`);

  // Populate compendium if empty (GM only)
  if (game.user.isGM) {
    populateCompendium();
  }
});

/* -------------------------------------------- */
/*  Token Velocity/Direction Display            */
/* -------------------------------------------- */

// Draw velocity and direction on vehicle tokens
Hooks.on("refreshToken", (token) => {
  if (token.actor?.type !== "vehicle") return;

  const sjData = token.actor.getFlag(MODULE_ID, "");
  if (!sjData?.initialized) return;

  // Remove existing spelljammer overlay
  const existingOverlay = token.children.find(c => c.name === "spelljammer-overlay");
  if (existingOverlay) {
    token.removeChild(existingOverlay);
  }

  // Create overlay container
  const overlay = new PIXI.Container();
  overlay.name = "spelljammer-overlay";

  const velocity = sjData.velocity?.current ?? 0;
  const direction = sjData.velocity?.direction ?? "N";

  // Only show if velocity > 0
  if (velocity > 0) {
    // Draw direction arrow
    const arrow = new PIXI.Graphics();
    const arrowSize = Math.min(token.w, token.h) * 0.3;
    const angle = (DIRECTION_ANGLES[direction] - 90) * (Math.PI / 180); // Adjust for PIXI coordinates

    arrow.beginFill(0x00ccff, 0.8);
    arrow.lineStyle(2, 0x0088aa, 1);

    // Arrow pointing in direction
    const tipX = token.w / 2 + Math.cos(angle) * arrowSize;
    const tipY = token.h / 2 + Math.sin(angle) * arrowSize;
    const baseX = token.w / 2 - Math.cos(angle) * (arrowSize * 0.3);
    const baseY = token.h / 2 - Math.sin(angle) * (arrowSize * 0.3);

    // Draw arrow head
    const perpAngle = angle + Math.PI / 2;
    const wingSize = arrowSize * 0.3;

    arrow.moveTo(tipX, tipY);
    arrow.lineTo(baseX + Math.cos(perpAngle) * wingSize, baseY + Math.sin(perpAngle) * wingSize);
    arrow.lineTo(baseX - Math.cos(perpAngle) * wingSize, baseY - Math.sin(perpAngle) * wingSize);
    arrow.lineTo(tipX, tipY);
    arrow.endFill();

    overlay.addChild(arrow);

    // Draw velocity text
    const velocityText = new PIXI.Text(`${velocity} ft`, {
      fontFamily: "Arial",
      fontSize: Math.max(12, token.w * 0.15),
      fill: 0x00ccff,
      stroke: 0x000000,
      strokeThickness: 3,
      fontWeight: "bold"
    });
    velocityText.anchor.set(0.5, 0);
    velocityText.position.set(token.w / 2, token.h + 2);
    overlay.addChild(velocityText);

    // Draw direction text
    const dirText = new PIXI.Text(direction, {
      fontFamily: "Arial",
      fontSize: Math.max(10, token.w * 0.12),
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2
    });
    dirText.anchor.set(0.5, 1);
    dirText.position.set(token.w / 2, -2);
    overlay.addChild(dirText);
  }

  token.addChild(overlay);
});

// Update token display when actor is updated
Hooks.on("updateActor", (actor, changes, options, userId) => {
  if (actor.type !== "vehicle") return;

  // Check if spelljammer flags changed
  if (changes.flags?.[MODULE_ID]) {
    // Refresh all tokens for this actor
    const tokens = actor.getActiveTokens();
    for (const token of tokens) {
      token.refresh();
    }
  }
});

/* -------------------------------------------- */
/*  Combat Automation                           */
/* -------------------------------------------- */

// Reset turn-based effects at start of turn
Hooks.on("updateCombat", async (combat, changes, options, userId) => {
  if (!game.user.isGM) return;
  if (!("turn" in changes)) return;

  const combatant = combat.combatant;
  if (!combatant?.actor || combatant.actor.type !== "vehicle") return;

  const actor = combatant.actor;
  const sjData = actor.getFlag(MODULE_ID, "");
  if (!sjData?.initialized) return;

  // Reset evade at start of turn
  if (sjData.combat?.evadeActive) {
    await actor.update({
      [`flags.${MODULE_ID}.combat.evadeActive`]: false
    });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="spelljammer-chat"><p><em>Evade maneuver has ended.</em></p></div>`
    });
  }

  // Increment warp charge if active
  if (sjData.powerModules?.warpCoreCharge?.active) {
    const newProgress = (sjData.warpChargeProgress ?? 0) + 1;
    await actor.update({
      [`flags.${MODULE_ID}.warpChargeProgress`]: newProgress
    });

    if (newProgress >= 3) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="spelljammer-chat warp-ready">
          <h3>⚡ WARP DRIVE CHARGED ⚡</h3>
          <p>The ${actor.name}'s warp core is fully charged! The ship can now initiate a warp jump to escape combat!</p>
        </div>`
      });
    } else {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="spelljammer-chat">
          <p>Warp Core charging: ${newProgress}/3 turns</p>
        </div>`
      });
    }
  }

  // Reset overdrive disabled flag
  if (sjData.combat?.overdriveDisabled) {
    await actor.update({
      [`flags.${MODULE_ID}.combat.overdriveDisabled`]: false
    });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="spelljammer-chat"><p><em>Helm systems recovered. Overdrive is available again.</em></p></div>`
    });
  }
});

// Auto-apply token rotation based on direction
Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
  if (actor.type !== "vehicle") return;

  const newDirection = changes.flags?.[MODULE_ID]?.velocity?.direction;
  if (!newDirection) return;

  // Update all tokens for this actor to face the new direction
  const tokens = actor.getActiveTokens();
  const rotation = DIRECTION_ANGLES[newDirection] ?? 0;

  for (const token of tokens) {
    token.document.update({ rotation });
  }
});

/* -------------------------------------------- */
/*  Compendium Population                       */
/* -------------------------------------------- */

async function populateCompendium() {
  const packName = `${MODULE_ID}.spelljammer-ships`;
  const pack = game.packs.get(packName);

  if (!pack) {
    console.log(`${MODULE_ID} | Compendium pack not found`);
    return;
  }

  // Check if pack is empty
  const index = await pack.getIndex();
  if (index.size > 0) {
    console.log(`${MODULE_ID} | Compendium already populated`);
    return;
  }

  // Unlock the pack for editing
  await pack.configure({ locked: false });

  // Create Ocean Court Express
  try {
    const actor = await Actor.create(OCEAN_COURT_EXPRESS, { pack: packName });
    console.log(`${MODULE_ID} | Created Ocean Court Express in compendium`);

    ui.notifications.info("Spelljammer Ships compendium populated with Ocean Court Express!");
  } catch (err) {
    console.error(`${MODULE_ID} | Error creating compendium entry:`, err);
  }

  // Re-lock the pack
  await pack.configure({ locked: true });
}

/**
 * Create a new Ocean Court Express actor in the world
 */
export async function createOceanCourtExpress() {
  const actor = await Actor.create(OCEAN_COURT_EXPRESS);
  ui.notifications.info(`Created ${actor.name}!`);
  actor.sheet.render(true);
  return actor;
}

/* -------------------------------------------- */
/*  Socket Handling for Multiplayer             */
/* -------------------------------------------- */

Hooks.once("ready", () => {
  game.socket.on(`module.${MODULE_ID}`, handleSocketMessage);
});

function handleSocketMessage(data) {
  switch (data.type) {
    case "updateCrewRole":
      handleCrewRoleUpdate(data);
      break;
    case "updatePowerModule":
      handlePowerModuleUpdate(data);
      break;
    case "refreshSheet":
      handleSheetRefresh(data);
      break;
    case "syncVelocity":
      handleVelocitySync(data);
      break;
  }
}

async function handleCrewRoleUpdate(data) {
  const actor = game.actors.get(data.actorId);
  if (!actor) return;

  // Only the GM processes updates
  if (!game.user.isGM) return;

  await actor.update({
    [`flags.${MODULE_ID}.crewAssignments.${data.role}`]: data.characterId
  });
}

async function handlePowerModuleUpdate(data) {
  const actor = game.actors.get(data.actorId);
  if (!actor) return;

  if (!game.user.isGM) return;

  await actor.update({
    [`flags.${MODULE_ID}.powerModules.${data.moduleId}.active`]: data.active
  });
}

function handleSheetRefresh(data) {
  const actor = game.actors.get(data.actorId);
  if (!actor) return;

  // Re-render any open sheets for this actor
  Object.values(ui.windows).forEach(app => {
    if (app.actor?.id === data.actorId) {
      app.render(false);
    }
  });
}

async function handleVelocitySync(data) {
  const actor = game.actors.get(data.actorId);
  if (!actor || !game.user.isGM) return;

  await actor.update({
    [`flags.${MODULE_ID}.velocity`]: data.velocity
  });
}

/* -------------------------------------------- */
/*  Settings Registration                       */
/* -------------------------------------------- */

function registerSettings() {
  game.settings.register(MODULE_ID, "defaultVelocity", {
    name: "Default Starting Velocity",
    hint: "The default starting velocity for ships entering combat (in feet per round)",
    scope: "world",
    config: true,
    type: Number,
    default: 0
  });

  game.settings.register(MODULE_ID, "useY2KTheme", {
    name: "Use Y2K Theme",
    hint: "Enable the retro Y2K-inspired visual theme",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "showTokenOverlay", {
    name: "Show Token Velocity Overlay",
    hint: "Display velocity and direction indicators on ship tokens",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "autoRotateTokens", {
    name: "Auto-Rotate Tokens",
    hint: "Automatically rotate ship tokens to face their current direction",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

Hooks.once("init", () => {
  Handlebars.registerHelper("sjc-eq", function(a, b) {
    return a === b;
  });

  Handlebars.registerHelper("sjc-includes", function(arr, val) {
    if (!Array.isArray(arr)) return false;
    return arr.includes(val);
  });

  Handlebars.registerHelper("sjc-getModuleCost", function(moduleId) {
    return POWER_MODULES[moduleId]?.cost ?? 1;
  });

  Handlebars.registerHelper("sjc-formatModifier", function(value) {
    const num = parseInt(value) || 0;
    return num >= 0 ? `+${num}` : `${num}`;
  });

  Handlebars.registerHelper("sjc-getOverdriveDC", function(speed) {
    const speedNum = parseInt(speed) || 0;
    // Round down to nearest 100
    const bracket = Math.floor(speedNum / 100) * 100;
    return OVERDRIVE_DC_TABLE[Math.min(bracket, 900)] ?? 20;
  });

  Handlebars.registerHelper("sjc-multiply", function(a, b) {
    return (parseFloat(a) || 0) * (parseFloat(b) || 0);
  });

  // Math helper for arithmetic operations
  Handlebars.registerHelper("math", function(a, operator, b) {
    a = parseFloat(a) || 0;
    b = parseFloat(b) || 0;
    switch (operator) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/": return b !== 0 ? a / b : 0;
      case "%": return a % b;
      default: return a;
    }
  });

  // Comparison helpers
  Handlebars.registerHelper("lte", function(a, b) {
    return parseFloat(a) <= parseFloat(b);
  });

  Handlebars.registerHelper("gte", function(a, b) {
    return parseFloat(a) >= parseFloat(b);
  });

  Handlebars.registerHelper("lt", function(a, b) {
    return parseFloat(a) < parseFloat(b);
  });

  Handlebars.registerHelper("gt", function(a, b) {
    return parseFloat(a) > parseFloat(b);
  });

  // Array helper to create arrays in templates
  Handlebars.registerHelper("array", function(...args) {
    // Remove the Handlebars options object from the end
    return args.slice(0, -1);
  });
});

/* -------------------------------------------- */
/*  Data Model Extensions                       */
/* -------------------------------------------- */

/**
 * Get the default spelljammer data structure for a vehicle actor
 */
export function getDefaultSpelljammerData() {
  return {
    // Movement
    velocity: {
      current: 0,
      direction: "N",
      maxAcceleration: 200,
      maxDeceleration: 200
    },
    // Crew assignments (character actor IDs)
    crewAssignments: {
      captain: null,
      helmsman: null,
      gunners: [],
      boatswain: null
    },
    // Power module states
    powerModules: Object.keys(POWER_MODULES).reduce((acc, key) => {
      acc[key] = { active: false, hp: 10, maxHp: 10 };
      return acc;
    }, {}),
    // Warp core charging progress
    warpChargeProgress: 0,
    // Ship weapons
    weapons: [],
    // Air supply
    airSupply: {
      current: 30,
      max: 30
    },
    // Captain's command for this combat
    captainCommand: null,
    // Tracking for turn-based effects
    combat: {
      overdriveDisabled: false,
      evadeActive: false,
      jammingTarget: null
    }
  };
}

/**
 * Ensure a vehicle actor has spelljammer flags initialized
 */
export async function initializeSpelljammerData(actor) {
  const existingData = actor.getFlag(MODULE_ID, "initialized");
  if (existingData) return;

  const defaults = getDefaultSpelljammerData();
  await actor.update({
    [`flags.${MODULE_ID}`]: {
      ...defaults,
      initialized: true
    }
  });
}

/* -------------------------------------------- */
/*  Collision Damage Tables                     */
/* -------------------------------------------- */

export const COLLISION_DAMAGE = {
  "0.5x0.5": "1d10", // Fighter
  "1x1": "2d10",     // Sloop/Schooner
  "2x2": "3d10",     // Frigate
  "3x3": "4d10",     // Heavy Frigate
  "4x4": "5d10"      // Ship of the Line
};
