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

  // Register custom sheet
  Actors.registerSheet(MODULE_ID, SpelljammerShipSheet, {
    types: ["vehicle"],
    makeDefault: false,
    label: "Spelljammer Ship Sheet"
  });

  // Add spelljammer rolls helper to game
  game.spelljammer = {
    rolls: SpelljammerRolls
  };
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Spelljammer Ship Combat Ready`);
});

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
