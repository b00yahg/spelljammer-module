/**
 * Spelljammer Ship Combat Module for Foundry VTT
 * A comprehensive ship combat system for D&D 5e Spelljammer campaigns
 */

import { SpelljammerShipSheet } from "./module/sheets/SpelljammerShipSheet.mjs";
import { SpelljammerRolls } from "./module/helpers/rolls.mjs";

const MODULE_ID = "spelljammer-module";

/**
 * Default data structure for Spelljammer ships
 * This is the canonical data structure - all ships use this format
 */
function getDefaultSpelljammerData() {
  return {
    initialized: true,
    shipClass: "Frigate (2x2)",
    velocity: {
      current: 0,
      direction: "N",
      maxAcceleration: 200,
      maxDeceleration: 200
    },
    crewAssignments: {
      captain: null,
      helmsman: null,
      gunners: [null, null, null, null],
      boatswain: null
    },
    crewRequirements: {
      minimum: 5,
      maximum: 15
    },
    airSupply: {
      current: 30,
      max: 30
    },
    powerModules: {
      weaponsArray: { active: false, hp: 10, maxHp: 10 },
      deflectorGrid: { active: false, hp: 10, maxHp: 10, damageType: null },
      thrusterOverride: { active: false, hp: 10, maxHp: 10 },
      hullReinforcement: { active: false, hp: 10, maxHp: 10 },
      systemRestoration: { active: false, hp: 10, maxHp: 10 },
      warpCoreCharge: { active: false, hp: 10, maxHp: 10, chargeProgress: 0 }
    },
    weapons: [],
    combat: {
      overdriveDisabled: false,
      evadeActive: false,
      jammingTarget: null,
      captainOrderUsed: false,
      activeOrder: null
    }
  };
}

/**
 * Initialize Spelljammer data for a vehicle actor
 * Uses setFlag for each key to prevent overwriting existing data
 */
async function initializeSpelljammerData(actor) {
  const defaults = getDefaultSpelljammerData();

  // Check if already initialized
  const existingInit = actor.getFlag(MODULE_ID, "initialized");
  if (existingInit) {
    console.log(`${MODULE_ID} | Ship ${actor.name} already initialized, skipping`);
    return;
  }

  console.log(`${MODULE_ID} | Initializing Spelljammer data for ${actor.name}`);

  // Set each default value individually, preserving any existing values
  for (const [key, value] of Object.entries(defaults)) {
    const existingValue = actor.getFlag(MODULE_ID, key);
    if (existingValue === undefined) {
      await actor.setFlag(MODULE_ID, key, value);
    }
  }
}

/**
 * Register module settings
 */
function registerSettings() {
  game.settings.register(MODULE_ID, "defaultVelocity", {
    name: "SPELLJAMMER.Settings.DefaultVelocity",
    hint: "SPELLJAMMER.Settings.DefaultVelocityHint",
    scope: "world",
    config: true,
    type: Number,
    default: 0
  });

  game.settings.register(MODULE_ID, "y2kTheme", {
    name: "SPELLJAMMER.Settings.Y2KTheme",
    hint: "SPELLJAMMER.Settings.Y2KThemeHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "tokenOverlay", {
    name: "SPELLJAMMER.Settings.TokenOverlay",
    hint: "SPELLJAMMER.Settings.TokenOverlayHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}

/**
 * Register Handlebars helpers for templates
 */
function registerHandlebarsHelpers() {
  // Equality check
  Handlebars.registerHelper("sjEq", (a, b) => a === b);

  // Not equal check
  Handlebars.registerHelper("sjNeq", (a, b) => a !== b);

  // Array includes check
  Handlebars.registerHelper("sjIncludes", (arr, value) => {
    if (!Array.isArray(arr)) return false;
    return arr.includes(value);
  });

  // Format modifier with + or -
  Handlebars.registerHelper("sjFormatMod", (value) => {
    const num = parseInt(value) || 0;
    return num >= 0 ? `+${num}` : `${num}`;
  });

  // Math operations
  Handlebars.registerHelper("sjAdd", (a, b) => (parseInt(a) || 0) + (parseInt(b) || 0));
  Handlebars.registerHelper("sjSub", (a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
  Handlebars.registerHelper("sjMul", (a, b) => (parseInt(a) || 0) * (parseInt(b) || 0));
  Handlebars.registerHelper("sjDiv", (a, b) => Math.floor((parseInt(a) || 0) / (parseInt(b) || 1)));

  // Comparisons
  Handlebars.registerHelper("sjLt", (a, b) => a < b);
  Handlebars.registerHelper("sjLte", (a, b) => a <= b);
  Handlebars.registerHelper("sjGt", (a, b) => a > b);
  Handlebars.registerHelper("sjGte", (a, b) => a >= b);

  // Array creation
  Handlebars.registerHelper("sjArray", (...args) => {
    args.pop(); // Remove Handlebars options object
    return args;
  });

  // Get array element by index
  Handlebars.registerHelper("sjIndex", (arr, index) => {
    if (!Array.isArray(arr)) return null;
    return arr[index];
  });

  // Get actor by ID
  Handlebars.registerHelper("sjGetActor", (actorId) => {
    if (!actorId) return null;
    return game.actors.get(actorId);
  });

  // Times helper for iteration
  Handlebars.registerHelper("sjTimes", function(n, options) {
    let result = "";
    for (let i = 0; i < n; i++) {
      result += options.fn({ index: i, first: i === 0, last: i === n - 1 });
    }
    return result;
  });
}

/**
 * Preload Handlebars templates
 */
async function preloadTemplates() {
  const templatePaths = [
    `modules/${MODULE_ID}/templates/spelljammer-sheet.hbs`,
    `modules/${MODULE_ID}/templates/parts/crew-assignment.hbs`,
    `modules/${MODULE_ID}/templates/parts/captain-station.hbs`,
    `modules/${MODULE_ID}/templates/parts/helmsman-station.hbs`,
    `modules/${MODULE_ID}/templates/parts/gunner-station.hbs`,
    `modules/${MODULE_ID}/templates/parts/boatswain-station.hbs`,
    `modules/${MODULE_ID}/templates/parts/weapons-panel.hbs`,
    `modules/${MODULE_ID}/templates/parts/velocity-panel.hbs`
  ];

  return loadTemplates(templatePaths);
}

/**
 * Create the Ocean Court Express ship
 */
async function createOceanCourtExpress(options = {}) {
  const actorData = {
    name: options.name || "Ocean Court Express",
    type: "vehicle",
    img: options.img || "icons/svg/ship.svg",
    system: {
      attributes: {
        ac: { flat: 16 },
        hp: { value: 100, max: 100, temp: 0 }
      },
      traits: {
        size: "huge",
        dimensions: "60 ft. x 20 ft."
      },
      cargo: {
        crew: { current: 0, min: 5, max: 15 },
        passengers: { current: 0, max: 10 },
        cargo: 20
      }
    },
    flags: {
      [MODULE_ID]: {
        ...getDefaultSpelljammerData(),
        shipClass: "Frigate (2x2)",
        velocity: {
          current: 0,
          direction: "N",
          maxAcceleration: 200,
          maxDeceleration: 200
        },
        crewRequirements: {
          minimum: 5,
          maximum: 15
        },
        weapons: [
          {
            id: foundry.utils.randomID(),
            name: "Flower Cannon (Port)",
            damage: "3d10",
            damageType: "radiant",
            range: { normal: 300, long: 900 },
            position: "port",
            firingArc: 90,
            hp: 10,
            maxHp: 10,
            specialProperties: [],
            assignedGunner: null
          },
          {
            id: foundry.utils.randomID(),
            name: "Flower Cannon (Starboard)",
            damage: "3d10",
            damageType: "radiant",
            range: { normal: 300, long: 900 },
            position: "starboard",
            firingArc: 90,
            hp: 10,
            maxHp: 10,
            specialProperties: [],
            assignedGunner: null
          },
          {
            id: foundry.utils.randomID(),
            name: "Carronade (Bow)",
            damage: "8d10",
            damageType: "bludgeoning",
            range: { normal: 500, long: 1500 },
            position: "bow",
            firingArc: 45,
            hp: 10,
            maxHp: 10,
            specialProperties: ["Utilize"],
            assignedGunner: null
          }
        ]
      }
    }
  };

  const actor = await Actor.create(actorData);
  ui.notifications.info(`Created ship: ${actor.name}`);
  return actor;
}

/**
 * Create a Mosquito single-pilot ship
 */
async function createMosquito(options = {}) {
  const actorData = {
    name: options.name || "Mosquito",
    type: "vehicle",
    img: options.img || "icons/svg/ship.svg",
    system: {
      attributes: {
        ac: { flat: 14 },
        hp: { value: 30, max: 30, temp: 0 }
      },
      traits: {
        size: "large",
        dimensions: "15 ft. x 10 ft."
      },
      cargo: {
        crew: { current: 0, min: 1, max: 1 },
        passengers: { current: 0, max: 0 },
        cargo: 1
      }
    },
    flags: {
      [MODULE_ID]: {
        ...getDefaultSpelljammerData(),
        shipClass: "Fighter (0.5x0.5)",
        velocity: {
          current: 0,
          direction: "N",
          maxAcceleration: 400,
          maxDeceleration: 400
        },
        crewRequirements: {
          minimum: 1,
          maximum: 1
        },
        crewAssignments: {
          captain: null,
          helmsman: null,
          gunners: [null],
          boatswain: null
        },
        airSupply: {
          current: 1,
          max: 1
        },
        weapons: [
          {
            id: foundry.utils.randomID(),
            name: "Light Ballista",
            damage: "2d10",
            damageType: "piercing",
            range: { normal: 200, long: 600 },
            position: "bow",
            firingArc: 45,
            hp: 10,
            maxHp: 10,
            specialProperties: [],
            assignedGunner: null
          }
        ],
        // Single pilot mode - one person does everything
        singlePilot: true
      }
    }
  };

  const actor = await Actor.create(actorData);
  ui.notifications.info(`Created ship: ${actor.name}`);
  return actor;
}

/**
 * Draw velocity overlay on tokens
 */
function drawVelocityOverlay(token, velocityData) {
  if (!game.settings.get(MODULE_ID, "tokenOverlay")) return;
  if (!velocityData) return;

  // Remove existing overlay
  const existingOverlay = token.children.find(c => c.name === "velocityOverlay");
  if (existingOverlay) {
    token.removeChild(existingOverlay);
  }

  // Create new overlay
  const container = new PIXI.Container();
  container.name = "velocityOverlay";

  const text = new PIXI.Text(`${velocityData.current} ft ${velocityData.direction}`, {
    fontFamily: "Exo 2, sans-serif",
    fontSize: 14,
    fill: 0x00ccff,
    stroke: 0x000000,
    strokeThickness: 3
  });

  text.anchor.set(0.5, 0);
  text.position.set(token.w / 2, token.h + 5);

  container.addChild(text);
  token.addChild(container);
}

/**
 * Socket handler for multiplayer synchronization
 */
function setupSocketHandlers() {
  game.socket.on(`module.${MODULE_ID}`, (data) => {
    console.log(`${MODULE_ID} | Socket received:`, data.type);

    switch (data.type) {
      case "refreshSheet":
        // Refresh a ship sheet for all clients
        const actor = game.actors.get(data.actorId);
        if (actor) {
          actor.sheet?.render(false);
        }
        break;

      case "crewUpdate":
        // Handle crew assignment updates
        const ship = game.actors.get(data.actorId);
        if (ship) {
          ship.sheet?.render(false);
        }
        break;
    }
  });
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Module initialization
 */
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Spelljammer Ship Combat module`);

  // Register settings
  registerSettings();

  // Register Handlebars helpers
  registerHandlebarsHelpers();

  // Register the ship sheet
  Actors.registerSheet(MODULE_ID, SpelljammerShipSheet, {
    types: ["vehicle"],
    makeDefault: false,
    label: "SPELLJAMMER.SheetTitle"
  });

  // Make module API available globally
  game.spelljammer = {
    MODULE_ID,
    createOceanCourtExpress,
    createMosquito,
    populateCompendium,
    getDefaultSpelljammerData,
    rolls: SpelljammerRolls
  };
});

/**
 * Module ready
 */
Hooks.once("ready", async () => {
  console.log(`${MODULE_ID} | Module ready`);

  // Preload templates
  await preloadTemplates();

  // Setup socket handlers
  setupSocketHandlers();

  // Welcome message for GMs
  if (game.user.isGM) {
    console.log(`${MODULE_ID} | Spelljammer Ship Combat module loaded.`);
    console.log(`${MODULE_ID} | Commands: game.spelljammer.createOceanCourtExpress() | game.spelljammer.createMosquito() | game.spelljammer.populateCompendium()`);

    // Check if compendium needs population
    await checkAndPopulateCompendium();
  }
});

/**
 * Check and populate the ships compendium if empty
 */
async function checkAndPopulateCompendium() {
  const packId = `${MODULE_ID}.spelljammer-ships`;
  const pack = game.packs.get(packId);

  if (!pack) {
    console.log(`${MODULE_ID} | Ships compendium not found, creating ships in world instead.`);
    return;
  }

  // Check if pack has any entries
  const index = await pack.getIndex();
  if (index.size === 0) {
    console.log(`${MODULE_ID} | Ships compendium is empty. Run game.spelljammer.populateCompendium() to add ships.`);

    // Show notification to GM
    ui.notifications.info("Spelljammer Ships: Run game.spelljammer.populateCompendium() in console to add ships to compendium, or use game.spelljammer.createOceanCourtExpress() to create directly.");
  }
}

/**
 * Populate the compendium with default ships
 */
async function populateCompendium() {
  if (!game.user.isGM) {
    ui.notifications.error("Only GMs can populate the compendium.");
    return;
  }

  const packId = `${MODULE_ID}.spelljammer-ships`;
  let pack = game.packs.get(packId);

  // Create ships in world first, then import to compendium
  ui.notifications.info("Creating ships for compendium...");

  // Create Ocean Court Express
  const oce = await createOceanCourtExpress({ name: "Ocean Court Express" });

  // Create Mosquito
  const mosquito = await createMosquito({ name: "Mosquito Fighter" });

  if (pack) {
    // Try to import to compendium
    try {
      await pack.importDocument(oce);
      await pack.importDocument(mosquito);
      ui.notifications.info("Ships added to compendium! You can now delete the world copies if desired.");
    } catch (e) {
      console.error(`${MODULE_ID} | Error importing to compendium:`, e);
      ui.notifications.warn("Couldn't add to compendium, but ships are available in your world.");
    }
  } else {
    ui.notifications.info("Ships created in your world! Drag them to a compendium to save.");
  }

  return { oceanCourtExpress: oce, mosquito };
}

/**
 * Hook into token rendering to add velocity overlay
 */
Hooks.on("refreshToken", (token) => {
  const actor = token.actor;
  if (!actor || actor.type !== "vehicle") return;

  const velocityData = actor.getFlag(MODULE_ID, "velocity");
  if (velocityData) {
    drawVelocityOverlay(token, velocityData);
  }
});

/**
 * Hook into actor updates for real-time sync
 */
Hooks.on("updateActor", (actor, changes, options, userId) => {
  // Check if this is a vehicle with spelljammer data
  if (actor.type !== "vehicle") return;

  // Check if flags were updated
  if (changes.flags?.[MODULE_ID]) {
    console.log(`${MODULE_ID} | Actor ${actor.name} flags updated`);

    // Emit socket event for other clients
    if (game.user.id === userId) {
      game.socket.emit(`module.${MODULE_ID}`, {
        type: "crewUpdate",
        actorId: actor.id
      });
    }
  }
});

// Export for use in other modules
export { MODULE_ID, getDefaultSpelljammerData, initializeSpelljammerData };
