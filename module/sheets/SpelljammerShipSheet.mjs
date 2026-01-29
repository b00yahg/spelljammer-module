/**
 * Spelljammer Ship Sheet - Custom vehicle sheet for Foundry VTT v13
 * Uses ApplicationV2 / DocumentSheetV2 framework
 */

const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = dnd5e.applications.actor;

import {
  MODULE_ID,
  CREW_ROLES,
  DIRECTIONS,
  POWER_MODULES,
  OVERDRIVE_DC_TABLE,
  getDefaultSpelljammerData,
  initializeSpelljammerData,
  COLLISION_DAMAGE
} from "../../spelljammer.mjs";
import { SpelljammerRolls } from "../helpers/rolls.mjs";

export class SpelljammerShipSheet extends ActorSheetV2 {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["dnd5e2", "sheet", "actor", "vehicle", "spelljammer-ship"],
    position: { width: 900, height: 800 },
    window: {
      resizable: true
    },
    actions: {
      // Crew management
      assignCrew: SpelljammerShipSheet.#onAssignCrew,
      removeCrew: SpelljammerShipSheet.#onRemoveCrew,
      // Power modules
      toggleModule: SpelljammerShipSheet.#onToggleModule,
      // Captain actions
      selectCommand: SpelljammerShipSheet.#onSelectCommand,
      rollGrapple: SpelljammerShipSheet.#onRollGrapple,
      useToMe: SpelljammerShipSheet.#onUseToMe,
      rollInitiative: SpelljammerShipSheet.#onRollInitiative,
      // Helmsman actions
      rollOverdrive: SpelljammerShipSheet.#onRollOverdrive,
      rollEmergencyBrake: SpelljammerShipSheet.#onRollEmergencyBrake,
      useEvade: SpelljammerShipSheet.#onUseEvade,
      useJamming: SpelljammerShipSheet.#onUseJamming,
      updateVelocity: SpelljammerShipSheet.#onUpdateVelocity,
      // Gunner actions
      rollWeaponAttack: SpelljammerShipSheet.#onRollWeaponAttack,
      assignWeaponGunner: SpelljammerShipSheet.#onAssignWeaponGunner,
      addWeapon: SpelljammerShipSheet.#onAddWeapon,
      deleteWeapon: SpelljammerShipSheet.#onDeleteWeapon,
      // Boatswain actions
      rollArcaneOverclock: SpelljammerShipSheet.#onRollArcaneOverclock,
      rollHullReinforcement: SpelljammerShipSheet.#onRollHullReinforcement,
      useEmergencyHotfix: SpelljammerShipSheet.#onUseEmergencyHotfix,
      // General
      rollCollisionDamage: SpelljammerShipSheet.#onRollCollisionDamage,
      openCharacterSheet: SpelljammerShipSheet.#onOpenCharacterSheet
    },
    form: {
      submitOnChange: true
    }
  };

  /** @override */
  static PARTS = {
    header: {
      template: `modules/${MODULE_ID}/templates/parts/ship-stats.hbs`
    },
    tabs: {
      template: "templates/generic/tab-navigation.hbs"
    },
    bridge: {
      template: `modules/${MODULE_ID}/templates/spelljammer-sheet.hbs`,
      scrollable: [".sheet-body"]
    }
  };

  /** @override */
  static TABS = {
    bridge: {
      id: "bridge",
      group: "primary",
      label: "Bridge Stations"
    },
    crew: {
      id: "crew",
      group: "primary",
      label: "Crew & Cargo"
    }
  };

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * Get the spelljammer-specific flags for this actor
   */
  get spelljammerData() {
    return this.actor.getFlag(MODULE_ID, "") ?? getDefaultSpelljammerData();
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Ensure spelljammer data is initialized
    await initializeSpelljammerData(this.actor);

    const sjData = this.spelljammerData;

    // Add spelljammer-specific context
    context.spelljammer = {
      ...sjData,
      // Computed values
      directions: DIRECTIONS,
      powerModuleDefinitions: POWER_MODULES,
      crewRoles: CREW_ROLES,
      // Power module state with definitions
      powerModulesWithDefs: this._getPowerModulesWithDefinitions(sjData),
      // Crew assignments resolved to actors
      resolvedCrew: await this._resolveCrewAssignments(sjData.crewAssignments),
      // Available characters for assignment
      availableCharacters: this._getAvailableCharacters(),
      // Total power charges used
      usedPowerCharges: this._calculateUsedPowerCharges(sjData.powerModules),
      // Boatswain's max charges
      maxPowerCharges: this._getBoatswainProficiency(sjData.crewAssignments?.boatswain),
      // Overdrive DC based on current speed
      overdriveDC: this._getOverdriveDC(sjData.velocity?.current ?? 0),
      // Weapons with gunner stats
      weaponsWithStats: this._getWeaponsWithStats(sjData),
      // Is user controlling a crew member?
      userCrewRole: this._getUserCrewRole(sjData.crewAssignments),
      // Module settings
      useY2KTheme: game.settings.get(MODULE_ID, "useY2KTheme"),
      // Collision damage table
      collisionDamage: COLLISION_DAMAGE
    };

    // Add tab configuration
    context.tabs = this._getTabs();

    return context;
  }

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    if ( this.document.limited ) return;
    options.parts = ["header", "tabs", "bridge"];
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Get power modules combined with their definitions
   */
  _getPowerModulesWithDefinitions(sjData) {
    return Object.entries(POWER_MODULES).map(([id, def]) => {
      const state = sjData.powerModules?.[id] ?? { active: false, hp: 10, maxHp: 10 };
      return {
        ...def,
        ...state,
        id,
        disabled: state.hp <= 0
      };
    });
  }

  /**
   * Resolve crew assignment IDs to actual actor data
   */
  async _resolveCrewAssignments(assignments) {
    const resolved = {
      captain: null,
      helmsman: null,
      gunners: [],
      boatswain: null
    };

    if (!assignments) return resolved;

    // Resolve single-role assignments
    for (const role of ["captain", "helmsman", "boatswain"]) {
      if (assignments[role]) {
        const actor = game.actors.get(assignments[role]);
        if (actor) {
          resolved[role] = {
            id: actor.id,
            name: actor.name,
            img: actor.img,
            proficiency: actor.system.attributes?.prof ?? 2,
            dexMod: actor.system.abilities?.dex?.mod ?? 0,
            chaMod: actor.system.abilities?.cha?.mod ?? 0,
            wisMod: actor.system.abilities?.wis?.mod ?? 0
          };
        }
      }
    }

    // Resolve gunners (array)
    if (Array.isArray(assignments.gunners)) {
      for (const gunnerId of assignments.gunners) {
        const actor = game.actors.get(gunnerId);
        if (actor) {
          resolved.gunners.push({
            id: actor.id,
            name: actor.name,
            img: actor.img,
            proficiency: actor.system.attributes?.prof ?? 2,
            dexMod: actor.system.abilities?.dex?.mod ?? 0
          });
        }
      }
    }

    return resolved;
  }

  /**
   * Get list of available player characters for crew assignment
   */
  _getAvailableCharacters() {
    return game.actors.filter(a =>
      a.type === "character" &&
      a.hasPlayerOwner
    ).map(a => ({
      id: a.id,
      name: a.name,
      img: a.img
    }));
  }

  /**
   * Calculate total power charges used
   */
  _calculateUsedPowerCharges(powerModules) {
    if (!powerModules) return 0;
    return Object.entries(powerModules).reduce((total, [id, state]) => {
      if (state.active && state.hp > 0) {
        return total + (POWER_MODULES[id]?.cost ?? 1);
      }
      return total;
    }, 0);
  }

  /**
   * Get the boatswain's proficiency bonus (for power charges)
   */
  _getBoatswainProficiency(boatswainId) {
    if (!boatswainId) return 2; // Default
    const actor = game.actors.get(boatswainId);
    return actor?.system.attributes?.prof ?? 2;
  }

  /**
   * Get the overdrive DC based on current speed
   */
  _getOverdriveDC(currentSpeed) {
    const bracket = Math.floor(currentSpeed / 100) * 100;
    return OVERDRIVE_DC_TABLE[Math.min(bracket, 900)] ?? 20;
  }

  /**
   * Get weapons with computed attack/damage based on assigned gunner
   */
  _getWeaponsWithStats(sjData) {
    const weapons = sjData.weapons ?? [];
    return weapons.map((weapon, index) => {
      let attackBonus = 0;
      let gunnerName = "Unassigned";

      if (weapon.assignedGunner !== null && sjData.crewAssignments?.gunners) {
        const gunnerId = sjData.crewAssignments.gunners[weapon.assignedGunner];
        if (gunnerId) {
          const gunner = game.actors.get(gunnerId);
          if (gunner) {
            const dexMod = gunner.system.abilities?.dex?.mod ?? 0;
            const prof = gunner.system.attributes?.prof ?? 2;
            attackBonus = dexMod + prof;
            gunnerName = gunner.name;
          }
        }
      }

      return {
        ...weapon,
        index,
        attackBonus,
        attackBonusFormatted: attackBonus >= 0 ? `+${attackBonus}` : `${attackBonus}`,
        gunnerName
      };
    });
  }

  /**
   * Determine if the current user controls any crew role
   */
  _getUserCrewRole(assignments) {
    if (!assignments) return null;

    const userCharacters = game.actors.filter(a =>
      a.type === "character" && a.isOwner
    ).map(a => a.id);

    // Check each role
    if (userCharacters.includes(assignments.captain)) return "captain";
    if (userCharacters.includes(assignments.helmsman)) return "helmsman";
    if (userCharacters.includes(assignments.boatswain)) return "boatswain";
    if (assignments.gunners?.some(id => userCharacters.includes(id))) return "gunner";

    return null;
  }

  /**
   * Get tabs configuration
   */
  _getTabs() {
    return {
      bridge: {
        id: "bridge",
        group: "primary",
        icon: "fa-solid fa-ship",
        label: "Bridge",
        active: true,
        cssClass: "active"
      },
      crew: {
        id: "crew",
        group: "primary",
        icon: "fa-solid fa-users",
        label: "Crew & Cargo",
        active: false,
        cssClass: ""
      }
    };
  }

  /* -------------------------------------------- */
  /*  Form Handling                               */
  /* -------------------------------------------- */

  /** @override */
  async _processFormData(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);

    // Handle spelljammer-specific updates
    if (data.spelljammer) {
      await this.actor.update({
        [`flags.${MODULE_ID}`]: foundry.utils.mergeObject(
          this.spelljammerData,
          data.spelljammer,
          { recursive: true }
        )
      });
    }

    return super._processFormData(event, form, formData);
  }

  /* -------------------------------------------- */
  /*  Action Handlers - Crew Management           */
  /* -------------------------------------------- */

  /**
   * Handle assigning a character to a crew role
   */
  static async #onAssignCrew(event, target) {
    const role = target.dataset.role;
    const characterId = target.value;

    if (!role) return;

    const assignments = foundry.utils.deepClone(this.spelljammerData.crewAssignments ?? {});

    if (role === "gunner") {
      // Gunners are an array
      const gunnerIndex = parseInt(target.dataset.gunnerIndex ?? 0);
      if (!Array.isArray(assignments.gunners)) assignments.gunners = [];

      // Expand array if needed
      while (assignments.gunners.length <= gunnerIndex) {
        assignments.gunners.push(null);
      }
      assignments.gunners[gunnerIndex] = characterId || null;
    } else {
      assignments[role] = characterId || null;
    }

    await this.actor.update({
      [`flags.${MODULE_ID}.crewAssignments`]: assignments
    });

    // Emit socket for multiplayer sync
    game.socket.emit(`module.${MODULE_ID}`, {
      type: "refreshSheet",
      actorId: this.actor.id
    });
  }

  /**
   * Handle removing a character from a crew role
   */
  static async #onRemoveCrew(event, target) {
    const role = target.dataset.role;
    if (!role) return;

    const assignments = foundry.utils.deepClone(this.spelljammerData.crewAssignments ?? {});

    if (role === "gunner") {
      const gunnerIndex = parseInt(target.dataset.gunnerIndex ?? 0);
      if (Array.isArray(assignments.gunners) && assignments.gunners[gunnerIndex]) {
        assignments.gunners[gunnerIndex] = null;
      }
    } else {
      assignments[role] = null;
    }

    await this.actor.update({
      [`flags.${MODULE_ID}.crewAssignments`]: assignments
    });

    game.socket.emit(`module.${MODULE_ID}`, {
      type: "refreshSheet",
      actorId: this.actor.id
    });
  }

  /* -------------------------------------------- */
  /*  Action Handlers - Power Modules             */
  /* -------------------------------------------- */

  /**
   * Handle toggling a power module on/off
   */
  static async #onToggleModule(event, target) {
    const moduleId = target.dataset.moduleId;
    if (!moduleId || !POWER_MODULES[moduleId]) return;

    const sjData = this.spelljammerData;
    const moduleState = sjData.powerModules?.[moduleId] ?? { active: false, hp: 10 };
    const moduleDef = POWER_MODULES[moduleId];

    // Check if module is disabled (0 HP)
    if (moduleState.hp <= 0) {
      ui.notifications.warn("This module is damaged and cannot be activated!");
      return;
    }

    // If activating, check power charge availability
    if (!moduleState.active) {
      const usedCharges = this._calculateUsedPowerCharges(sjData.powerModules);
      const maxCharges = this._getBoatswainProficiency(sjData.crewAssignments?.boatswain);

      if (usedCharges + moduleDef.cost > maxCharges) {
        ui.notifications.warn("Not enough power charges available!");
        return;
      }
    }

    // Toggle the module
    await this.actor.update({
      [`flags.${MODULE_ID}.powerModules.${moduleId}.active`]: !moduleState.active
    });

    // If activating Hull Reinforcement, roll for temp HP
    if (!moduleState.active && moduleId === "hullReinforcement") {
      await SpelljammerRolls.rollHullReinforcement(this.actor);
    }

    game.socket.emit(`module.${MODULE_ID}`, {
      type: "refreshSheet",
      actorId: this.actor.id
    });
  }

  /* -------------------------------------------- */
  /*  Action Handlers - Captain                   */
  /* -------------------------------------------- */

  /**
   * Handle selecting captain's command
   */
  static async #onSelectCommand(event, target) {
    const command = target.dataset.command;
    if (!command) return;

    await this.actor.update({
      [`flags.${MODULE_ID}.captainCommand`]: command
    });

    // Announce to chat
    const commandDescriptions = {
      gunner: "Offensive Order: A Gunner may make an additional weapon attack!",
      boatswain: "Engineering Order: The Boatswain may allocate one additional power charge!",
      helmsman: "Tactical Order: The Helmsman gains advantage on Overdrive and Emergency Brake checks!"
    };

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="spelljammer-chat captain-command">
        <h3>Captain's Command</h3>
        <p>${commandDescriptions[command]}</p>
      </div>`
    });
  }

  /**
   * Handle grapple roll
   */
  static async #onRollGrapple(event, target) {
    await SpelljammerRolls.rollGrapple(this.actor, this.spelljammerData);
  }

  /**
   * Handle "To Me, Ocean Court" ability
   */
  static async #onUseToMe(event, target) {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="spelljammer-chat captain-ability">
        <h3>To Me, Ocean Court!</h3>
        <p>The Captain calls for a boarding/defense party. All crew members who have not yet taken their turn are teleported to the Captain's position.</p>
        <p><em>Crew members joining this party leave their bridge roles and can act as their normal characters.</em></p>
      </div>`
    });
  }

  /**
   * Handle rolling ship initiative
   */
  static async #onRollInitiative(event, target) {
    await SpelljammerRolls.rollShipInitiative(this.actor, this.spelljammerData);
  }

  /* -------------------------------------------- */
  /*  Action Handlers - Helmsman                  */
  /* -------------------------------------------- */

  /**
   * Handle overdrive roll
   */
  static async #onRollOverdrive(event, target) {
    await SpelljammerRolls.rollOverdrive(this.actor, this.spelljammerData);
  }

  /**
   * Handle emergency brake roll
   */
  static async #onRollEmergencyBrake(event, target) {
    await SpelljammerRolls.rollEmergencyBrake(this.actor, this.spelljammerData);
  }

  /**
   * Handle using Evade maneuver
   */
  static async #onUseEvade(event, target) {
    const sjData = this.spelljammerData;
    const helmsman = sjData.crewAssignments?.helmsman;
    if (!helmsman) {
      ui.notifications.warn("No Helmsman assigned!");
      return;
    }

    const helmsmanActor = game.actors.get(helmsman);
    const prof = helmsmanActor?.system.attributes?.prof ?? 2;

    await this.actor.update({
      [`flags.${MODULE_ID}.combat.evadeActive`]: true
    });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="spelljammer-chat helmsman-ability">
        <h3>Maneuver - Evade</h3>
        <p><strong>${helmsmanActor?.name ?? "The Helmsman"}</strong> expends a 1st-level spell slot to enhance defensive capabilities.</p>
        <p>Until the start of their next turn, add <strong>+${prof}</strong> to either:</p>
        <ul>
          <li>The ship's AC against incoming attacks, OR</li>
          <li>Any Wisdom (Vehicle) checks to avoid collisions</li>
        </ul>
        <p><em>This bonus increases by +2 for each spell level above 1st.</em></p>
      </div>`
    });
  }

  /**
   * Handle using Jamming maneuver
   */
  static async #onUseJamming(event, target) {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="spelljammer-chat helmsman-ability">
        <h3>Maneuver - Jamming</h3>
        <p>By expending a 3rd-level spell slot, the Helmsman attunes the ship's magical signature to match a target vessel within 5 feet.</p>
        <p>For the next minute, this ship automatically matches the target's speed, acceleration, and deceleration without needing Overdrive or Emergency Brake checks.</p>
      </div>`
    });
  }

  /**
   * Handle velocity updates
   */
  static async #onUpdateVelocity(event, target) {
    const field = target.dataset.field;
    const value = target.value;

    if (field === "direction") {
      await this.actor.update({
        [`flags.${MODULE_ID}.velocity.direction`]: value
      });
    } else if (field === "current") {
      await this.actor.update({
        [`flags.${MODULE_ID}.velocity.current`]: parseInt(value) || 0
      });
    }
  }

  /* -------------------------------------------- */
  /*  Action Handlers - Gunner                    */
  /* -------------------------------------------- */

  /**
   * Handle weapon attack roll
   */
  static async #onRollWeaponAttack(event, target) {
    const weaponIndex = parseInt(target.dataset.weaponIndex);
    await SpelljammerRolls.rollWeaponAttack(this.actor, this.spelljammerData, weaponIndex);
  }

  /**
   * Handle assigning a gunner to a weapon
   */
  static async #onAssignWeaponGunner(event, target) {
    const weaponIndex = parseInt(target.dataset.weaponIndex);
    const gunnerIndex = target.value === "" ? null : parseInt(target.value);

    const weapons = foundry.utils.deepClone(this.spelljammerData.weapons ?? []);
    if (weapons[weaponIndex]) {
      weapons[weaponIndex].assignedGunner = gunnerIndex;
      await this.actor.update({
        [`flags.${MODULE_ID}.weapons`]: weapons
      });
    }
  }

  /**
   * Handle adding a new weapon
   */
  static async #onAddWeapon(event, target) {
    const weapons = foundry.utils.deepClone(this.spelljammerData.weapons ?? []);
    weapons.push({
      name: "New Weapon",
      damage: "2d10",
      damageType: "bludgeoning",
      range: "300/900",
      position: "broadside",
      firingArc: 90,
      properties: [],
      hp: 10,
      maxHp: 10,
      assignedGunner: null
    });

    await this.actor.update({
      [`flags.${MODULE_ID}.weapons`]: weapons
    });
  }

  /**
   * Handle deleting a weapon
   */
  static async #onDeleteWeapon(event, target) {
    const weaponIndex = parseInt(target.dataset.weaponIndex);
    const weapons = foundry.utils.deepClone(this.spelljammerData.weapons ?? []);

    if (weapons[weaponIndex]) {
      weapons.splice(weaponIndex, 1);
      await this.actor.update({
        [`flags.${MODULE_ID}.weapons`]: weapons
      });
    }
  }

  /* -------------------------------------------- */
  /*  Action Handlers - Boatswain                 */
  /* -------------------------------------------- */

  /**
   * Handle Arcane Overclock
   */
  static async #onRollArcaneOverclock(event, target) {
    const buttons = {};
    for (let i = 1; i <= 9; i++) {
      buttons[`level${i}`] = {
        label: `${i}${i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th'} Level (+${i} charges)`,
        callback: () => i
      };
    }

    const spellLevel = await Dialog.wait({
      title: "Arcane Overclock",
      content: "<p>Select a spell slot level to expend:</p>",
      buttons,
      default: "level1"
    });

    if (spellLevel) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="spelljammer-chat boatswain-ability">
          <h3>Arcane Overclock</h3>
          <p>The Boatswain expends a <strong>${spellLevel}${spellLevel === 1 ? 'st' : spellLevel === 2 ? 'nd' : spellLevel === 3 ? 'rd' : 'th'}-level</strong> spell slot!</p>
          <p>Gained <strong>+${spellLevel}</strong> additional power charges for this turn only.</p>
        </div>`
      });
    }
  }

  /**
   * Handle Hull Reinforcement roll
   */
  static async #onRollHullReinforcement(event, target) {
    await SpelljammerRolls.rollHullReinforcement(this.actor);
  }

  /**
   * Handle Emergency Hotfix
   */
  static async #onUseEmergencyHotfix(event, target) {
    const currentHp = this.actor.system.attributes?.hp?.value ?? 0;
    const maxHp = this.actor.system.attributes?.hp?.max ?? 1;

    if (currentHp > maxHp / 2) {
      ui.notifications.warn("Emergency Hotfix can only be used when the ship is below half HP!");
      return;
    }

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="spelljammer-chat boatswain-ability">
        <h3>Emergency Hotfix</h3>
        <p>The ship has dropped below half hull points! The Boatswain uses their reaction to immediately reallocate 1 power charge.</p>
        <p><em>Toggle a power module off and another on without spending an action.</em></p>
      </div>`
    });
  }

  /* -------------------------------------------- */
  /*  Action Handlers - General                   */
  /* -------------------------------------------- */

  /**
   * Handle collision damage roll
   */
  static async #onRollCollisionDamage(event, target) {
    const size = target.dataset.size ?? "2x2";
    const damageFormula = COLLISION_DAMAGE[size] ?? "3d10";

    const roll = await new Roll(damageFormula).evaluate();

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<div class="spelljammer-chat collision">
        <h3>Collision Damage</h3>
        <p>Ship size: ${size}</p>
      </div>`
    });
  }

  /**
   * Handle opening a crew member's character sheet
   */
  static async #onOpenCharacterSheet(event, target) {
    const actorId = target.dataset.actorId;
    if (!actorId) return;

    const actor = game.actors.get(actorId);
    if (actor) {
      actor.sheet.render(true);
    }
  }
}
