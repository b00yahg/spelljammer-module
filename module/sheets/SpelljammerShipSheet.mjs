/**
 * Spelljammer Ship Sheet - Custom vehicle sheet for Foundry VTT v13
 * Uses legacy ActorSheet for maximum compatibility
 */

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

export class SpelljammerShipSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["dnd5e", "sheet", "actor", "vehicle", "spelljammer-ship"],
      template: `modules/${MODULE_ID}/templates/spelljammer-sheet.hbs`,
      width: 900,
      height: 800,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "bridge" }],
      scrollY: [".sheet-body"],
      resizable: true
    });
  }

  /** @override */
  get template() {
    return `modules/${MODULE_ID}/templates/spelljammer-sheet.hbs`;
  }

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
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @override */
  async getData(options = {}) {
    const context = await super.getData(options);

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

    // Standard actor data
    context.actor = this.actor;
    context.system = this.actor.system;
    context.flags = this.actor.flags;

    return context;
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

  /* -------------------------------------------- */
  /*  Event Listeners                             */
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Crew assignment
    html.find('.crew-select').change(this._onAssignCrew.bind(this));
    html.find('.remove-crew').click(this._onRemoveCrew.bind(this));

    // Power modules
    html.find('.power-module').click(this._onToggleModule.bind(this));

    // Captain actions
    html.find('.command-option input').change(this._onSelectCommand.bind(this));
    html.find('[data-action="rollGrapple"]').click(this._onRollGrapple.bind(this));
    html.find('[data-action="useToMe"]').click(this._onUseToMe.bind(this));
    html.find('[data-action="rollInitiative"]').click(this._onRollInitiative.bind(this));

    // Helmsman actions
    html.find('[data-action="rollOverdrive"]').click(this._onRollOverdrive.bind(this));
    html.find('[data-action="rollEmergencyBrake"]').click(this._onRollEmergencyBrake.bind(this));
    html.find('[data-action="useEvade"]').click(this._onUseEvade.bind(this));
    html.find('[data-action="useJamming"]').click(this._onUseJamming.bind(this));

    // Gunner actions
    html.find('[data-action="rollWeaponAttack"]').click(this._onRollWeaponAttack.bind(this));
    html.find('[data-action="addWeapon"]').click(this._onAddWeapon.bind(this));
    html.find('[data-action="deleteWeapon"]').click(this._onDeleteWeapon.bind(this));
    html.find('.gunner-select').change(this._onAssignWeaponGunner.bind(this));

    // Boatswain actions
    html.find('[data-action="rollArcaneOverclock"]').click(this._onRollArcaneOverclock.bind(this));
    html.find('[data-action="useEmergencyHotfix"]').click(this._onUseEmergencyHotfix.bind(this));

    // General
    html.find('[data-action="rollCollisionDamage"]').click(this._onRollCollisionDamage.bind(this));
    html.find('.assigned-crew').click(this._onOpenCharacterSheet.bind(this));
  }

  /* -------------------------------------------- */
  /*  Event Handlers - Crew Management            */
  /* -------------------------------------------- */

  async _onAssignCrew(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const role = element.dataset.role;
    const characterId = element.value;

    if (!role) return;

    const assignments = foundry.utils.deepClone(this.spelljammerData.crewAssignments ?? {});

    if (role === "gunner") {
      const gunnerIndex = parseInt(element.dataset.gunnerIndex ?? 0);
      if (!Array.isArray(assignments.gunners)) assignments.gunners = [];
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

    game.socket.emit(`module.${MODULE_ID}`, {
      type: "refreshSheet",
      actorId: this.actor.id
    });
  }

  async _onRemoveCrew(event) {
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget;
    const role = element.dataset.role;
    if (!role) return;

    const assignments = foundry.utils.deepClone(this.spelljammerData.crewAssignments ?? {});

    if (role === "gunner") {
      const gunnerIndex = parseInt(element.dataset.gunnerIndex ?? 0);
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
  /*  Event Handlers - Power Modules              */
  /* -------------------------------------------- */

  async _onToggleModule(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const moduleId = element.dataset.moduleId;
    if (!moduleId || !POWER_MODULES[moduleId]) return;

    // Don't toggle if clicking on HP input
    if (event.target.classList.contains('module-hp-input')) return;

    const sjData = this.spelljammerData;
    const moduleState = sjData.powerModules?.[moduleId] ?? { active: false, hp: 10 };
    const moduleDef = POWER_MODULES[moduleId];

    if (moduleState.hp <= 0) {
      ui.notifications.warn("This module is damaged and cannot be activated!");
      return;
    }

    if (!moduleState.active) {
      const usedCharges = this._calculateUsedPowerCharges(sjData.powerModules);
      const maxCharges = this._getBoatswainProficiency(sjData.crewAssignments?.boatswain);

      if (usedCharges + moduleDef.cost > maxCharges) {
        ui.notifications.warn("Not enough power charges available!");
        return;
      }
    }

    await this.actor.update({
      [`flags.${MODULE_ID}.powerModules.${moduleId}.active`]: !moduleState.active
    });

    if (!moduleState.active && moduleId === "hullReinforcement") {
      await SpelljammerRolls.rollHullReinforcement(this.actor);
    }

    game.socket.emit(`module.${MODULE_ID}`, {
      type: "refreshSheet",
      actorId: this.actor.id
    });
  }

  /* -------------------------------------------- */
  /*  Event Handlers - Captain                    */
  /* -------------------------------------------- */

  async _onSelectCommand(event) {
    const command = event.currentTarget.value;
    if (!command) return;

    await this.actor.update({
      [`flags.${MODULE_ID}.captainCommand`]: command
    });

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

  async _onRollGrapple(event) {
    event.preventDefault();
    await SpelljammerRolls.rollGrapple(this.actor, this.spelljammerData);
  }

  async _onUseToMe(event) {
    event.preventDefault();
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="spelljammer-chat captain-ability">
        <h3>To Me, Ocean Court!</h3>
        <p>The Captain calls for a boarding/defense party. All crew members who have not yet taken their turn are teleported to the Captain's position.</p>
        <p><em>Crew members joining this party leave their bridge roles and can act as their normal characters.</em></p>
      </div>`
    });
  }

  async _onRollInitiative(event) {
    event.preventDefault();
    await SpelljammerRolls.rollShipInitiative(this.actor, this.spelljammerData);
  }

  /* -------------------------------------------- */
  /*  Event Handlers - Helmsman                   */
  /* -------------------------------------------- */

  async _onRollOverdrive(event) {
    event.preventDefault();
    await SpelljammerRolls.rollOverdrive(this.actor, this.spelljammerData);
  }

  async _onRollEmergencyBrake(event) {
    event.preventDefault();
    await SpelljammerRolls.rollEmergencyBrake(this.actor, this.spelljammerData);
  }

  async _onUseEvade(event) {
    event.preventDefault();
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

  async _onUseJamming(event) {
    event.preventDefault();
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="spelljammer-chat helmsman-ability">
        <h3>Maneuver - Jamming</h3>
        <p>By expending a 3rd-level spell slot, the Helmsman attunes the ship's magical signature to match a target vessel within 5 feet.</p>
        <p>For the next minute, this ship automatically matches the target's speed, acceleration, and deceleration without needing Overdrive or Emergency Brake checks.</p>
      </div>`
    });
  }

  /* -------------------------------------------- */
  /*  Event Handlers - Gunner                     */
  /* -------------------------------------------- */

  async _onRollWeaponAttack(event) {
    event.preventDefault();
    const weaponIndex = parseInt(event.currentTarget.dataset.weaponIndex);
    await SpelljammerRolls.rollWeaponAttack(this.actor, this.spelljammerData, weaponIndex);
  }

  async _onAssignWeaponGunner(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const weaponIndex = parseInt(element.dataset.weaponIndex);
    const gunnerIndex = element.value === "" ? null : parseInt(element.value);

    const weapons = foundry.utils.deepClone(this.spelljammerData.weapons ?? []);
    if (weapons[weaponIndex]) {
      weapons[weaponIndex].assignedGunner = gunnerIndex;
      await this.actor.update({
        [`flags.${MODULE_ID}.weapons`]: weapons
      });
    }
  }

  async _onAddWeapon(event) {
    event.preventDefault();
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

  async _onDeleteWeapon(event) {
    event.preventDefault();
    const weaponIndex = parseInt(event.currentTarget.dataset.weaponIndex);
    const weapons = foundry.utils.deepClone(this.spelljammerData.weapons ?? []);

    if (weapons[weaponIndex]) {
      weapons.splice(weaponIndex, 1);
      await this.actor.update({
        [`flags.${MODULE_ID}.weapons`]: weapons
      });
    }
  }

  /* -------------------------------------------- */
  /*  Event Handlers - Boatswain                  */
  /* -------------------------------------------- */

  async _onRollArcaneOverclock(event) {
    event.preventDefault();
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

  async _onUseEmergencyHotfix(event) {
    event.preventDefault();
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
  /*  Event Handlers - General                    */
  /* -------------------------------------------- */

  async _onRollCollisionDamage(event) {
    event.preventDefault();
    const size = event.currentTarget.dataset.size ?? "2x2";
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

  async _onOpenCharacterSheet(event) {
    event.preventDefault();
    const actorId = event.currentTarget.dataset.actorId;
    if (!actorId) return;

    const actor = game.actors.get(actorId);
    if (actor) {
      actor.sheet.render(true);
    }
  }

  /* -------------------------------------------- */
  /*  Form Submission                             */
  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    const expanded = foundry.utils.expandObject(formData);

    // Handle spelljammer-specific updates
    if (expanded.spelljammer) {
      await this.actor.update({
        [`flags.${MODULE_ID}`]: foundry.utils.mergeObject(
          this.spelljammerData,
          expanded.spelljammer,
          { recursive: true }
        )
      });
      delete expanded.spelljammer;
    }

    // Handle standard actor updates
    return this.actor.update(expanded);
  }
}
