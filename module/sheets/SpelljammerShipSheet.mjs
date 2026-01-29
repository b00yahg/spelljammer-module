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
  COLLISION_DAMAGE,
  getShipWeapons,
  getPowerModules,
  addDefaultPowerModules,
  addShipWeapon,
  togglePowerModule,
  createShipWeaponData
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
      resizable: true,
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }]
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

    // Ensure default power modules exist as Items
    await addDefaultPowerModules(this.actor);

    // Get fresh flag data directly from actor
    const sjData = this.actor.getFlag(MODULE_ID, "") ?? getDefaultSpelljammerData();

    console.log("Spelljammer | getData - crewAssignments:", sjData.crewAssignments);

    // Get Items-based weapons and modules
    const shipWeapons = getShipWeapons(this.actor);
    const powerModuleItems = getPowerModules(this.actor);

    // Resolve crew assignments
    const resolvedCrew = await this._resolveCrewAssignments(sjData.crewAssignments);
    console.log("Spelljammer | getData - resolvedCrew:", resolvedCrew);

    // Add spelljammer-specific context
    context.spelljammer = {
      ...sjData,
      // Computed values
      directions: DIRECTIONS,
      powerModuleDefinitions: POWER_MODULES,
      crewRoles: CREW_ROLES,
      // Power modules from Items
      powerModuleItems: this._preparePowerModuleItems(powerModuleItems),
      // Ship weapons from Items
      shipWeaponItems: this._prepareShipWeaponItems(shipWeapons, sjData),
      // Legacy support - Power module state with definitions (for templates)
      powerModulesWithDefs: this._getPowerModulesFromItems(powerModuleItems),
      // Crew assignments resolved to actors
      resolvedCrew: resolvedCrew,
      // Available characters for assignment
      availableCharacters: this._getAvailableCharacters(),
      // Total power charges used (from Items)
      usedPowerCharges: this._calculateUsedPowerChargesFromItems(powerModuleItems),
      // Boatswain's max charges
      maxPowerCharges: this._getBoatswainProficiency(sjData.crewAssignments?.boatswain),
      // Overdrive DC based on current speed
      overdriveDC: this._getOverdriveDC(sjData.velocity?.current ?? 0),
      // Weapons with gunner stats (from Items)
      weaponsWithStats: this._getWeaponsWithStatsFromItems(shipWeapons, sjData),
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
    context.items = this.actor.items;

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
      gunners: [null, null, null, null], // Maintain 4 positions
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

    // Resolve gunners (maintain index positions!)
    if (Array.isArray(assignments.gunners)) {
      for (let i = 0; i < assignments.gunners.length; i++) {
        const gunnerId = assignments.gunners[i];
        if (gunnerId) {
          const actor = game.actors.get(gunnerId);
          if (actor) {
            resolved.gunners[i] = {
              id: actor.id,
              name: actor.name,
              img: actor.img,
              proficiency: actor.system.attributes?.prof ?? 2,
              dexMod: actor.system.abilities?.dex?.mod ?? 0
            };
          }
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
  /*  Item-Based Helper Methods                   */
  /* -------------------------------------------- */

  /**
   * Prepare power module Items for display
   */
  _preparePowerModuleItems(moduleItems) {
    return moduleItems.map(item => {
      const flags = item.flags?.[MODULE_ID] ?? {};
      const moduleDef = POWER_MODULES[flags.moduleId] ?? {};
      return {
        id: item.id,
        name: item.name,
        img: item.img,
        moduleId: flags.moduleId,
        cost: flags.cost ?? moduleDef.cost ?? 1,
        description: moduleDef.description ?? "",
        effect: flags.effect ?? moduleDef.effect,
        effectValue: flags.effectValue ?? moduleDef.effectValue,
        active: flags.active ?? false,
        hp: item.system.hp?.value ?? 10,
        maxHp: item.system.hp?.max ?? 10,
        disabled: (item.system.hp?.value ?? 10) <= 0
      };
    });
  }

  /**
   * Prepare ship weapon Items for display
   */
  _prepareShipWeaponItems(weaponItems, sjData) {
    return weaponItems.map((item, index) => {
      const flags = item.flags?.[MODULE_ID] ?? {};
      const assignedGunnerIdx = flags.assignedGunner;

      let attackBonus = 0;
      let gunnerName = "Unassigned";

      if (assignedGunnerIdx !== null && assignedGunnerIdx !== undefined && sjData.crewAssignments?.gunners) {
        const gunnerId = sjData.crewAssignments.gunners[assignedGunnerIdx];
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

      // Get damage from Item
      const damageParts = item.system.damage?.parts ?? [];
      const damage = damageParts[0]?.[0] ?? "2d10";
      const damageType = damageParts[0]?.[1] ?? "bludgeoning";

      return {
        id: item.id,
        name: item.name,
        img: item.img,
        damage,
        damageType,
        range: `${item.system.range?.value ?? 300}/${item.system.range?.long ?? 900}`,
        position: flags.position ?? "broadside",
        firingArc: flags.firingArc ?? 90,
        properties: flags.specialProperties ?? [],
        hp: item.system.hp?.value ?? 10,
        maxHp: item.system.hp?.max ?? 10,
        assignedGunner: assignedGunnerIdx,
        index,
        attackBonus,
        attackBonusFormatted: attackBonus >= 0 ? `+${attackBonus}` : `${attackBonus}`,
        gunnerName,
        disabled: (item.system.hp?.value ?? 10) <= 0
      };
    });
  }

  /**
   * Get power modules from Items in legacy format for templates
   */
  _getPowerModulesFromItems(moduleItems) {
    return moduleItems.map(item => {
      const flags = item.flags?.[MODULE_ID] ?? {};
      const moduleDef = POWER_MODULES[flags.moduleId] ?? {};
      return {
        ...moduleDef,
        id: flags.moduleId,
        itemId: item.id,
        name: item.name,
        active: flags.active ?? false,
        hp: item.system.hp?.value ?? 10,
        maxHp: item.system.hp?.max ?? 10,
        disabled: (item.system.hp?.value ?? 10) <= 0
      };
    });
  }

  /**
   * Calculate used power charges from Item-based modules
   */
  _calculateUsedPowerChargesFromItems(moduleItems) {
    return moduleItems.reduce((total, item) => {
      const flags = item.flags?.[MODULE_ID] ?? {};
      const hp = item.system.hp?.value ?? 10;
      if (flags.active && hp > 0) {
        return total + (flags.cost ?? 1);
      }
      return total;
    }, 0);
  }

  /**
   * Get weapons with stats from Items
   */
  _getWeaponsWithStatsFromItems(weaponItems, sjData) {
    return this._prepareShipWeaponItems(weaponItems, sjData);
  }

  /* -------------------------------------------- */
  /*  Event Listeners                             */
  /* -------------------------------------------- */

  /**
   * Override Foundry's _onChangeInput to prevent form submission for our custom elements
   * @override
   */
  _onChangeInput(event) {
    // Skip form submission for our custom select elements
    const element = event.target;
    if (element.classList.contains('crew-select') || element.classList.contains('gunner-select')) {
      // Don't call super - we handle these ourselves
      return;
    }
    // For all other elements, use default behavior
    super._onChangeInput(event);
  }

  /**
   * Override _getSubmitData to handle missing form element gracefully
   * @override
   */
  _getSubmitData(updateData = {}) {
    // Try to get form data normally, but handle the case where form isn't ready
    try {
      if (!this.form) {
        return updateData;
      }
      return super._getSubmitData(updateData);
    } catch (err) {
      console.warn("Spelljammer | Form submit data error (non-critical):", err.message);
      return updateData;
    }
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Crew assignment - Use event delegation for better reliability
    html.on('change', '.crew-select', this._onAssignCrew.bind(this));
    html.on('click', '.remove-crew', this._onRemoveCrew.bind(this));

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

    // Drag-drop visual feedback
    html.find('.drop-zone, .drop-target').on('dragover', (event) => {
      event.preventDefault();
      event.currentTarget.classList.add('dragover');
    });
    html.find('.drop-zone, .drop-target').on('dragleave', (event) => {
      event.currentTarget.classList.remove('dragover');
    });
    html.find('.drop-zone, .drop-target').on('drop', (event) => {
      event.currentTarget.classList.remove('dragover');
    });
  }

  /* -------------------------------------------- */
  /*  Event Handlers - Crew Management            */
  /* -------------------------------------------- */

  async _onAssignCrew(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation(); // Prevent Foundry's _onChangeInput from triggering

    const element = event.currentTarget;
    const role = element.dataset.role;
    const characterId = element.value;

    console.log(`Spelljammer | Crew assignment: role=${role}, characterId=${characterId}`);

    if (!role) {
      console.warn("Spelljammer | No role found on crew select element");
      return;
    }

    // Get fresh flag data directly
    const assignments = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "crewAssignments") ?? {});

    // Ensure gunners array exists with proper length
    if (!Array.isArray(assignments.gunners)) {
      assignments.gunners = [null, null, null, null];
    }
    while (assignments.gunners.length < 4) {
      assignments.gunners.push(null);
    }

    let assignedName = "Unassigned";
    if (characterId) {
      const actor = game.actors.get(characterId);
      if (actor) assignedName = actor.name;
    }

    if (role === "gunner") {
      const gunnerIndex = parseInt(element.dataset.gunnerIndex ?? 0);
      assignments.gunners[gunnerIndex] = characterId || null;
    } else {
      assignments[role] = characterId || null;
    }

    try {
      // Get the full current spelljammer data and merge in new assignments
      const currentData = this.actor.getFlag(MODULE_ID, "") ?? {};
      const updatedData = foundry.utils.mergeObject(currentData, { crewAssignments: assignments });

      // Use a single atomic update, but prevent automatic re-render
      await this.actor.update({
        [`flags.${MODULE_ID}`]: updatedData
      }, { render: false });

      console.log(`Spelljammer | Crew assignment updated. New assignments:`, assignments);

      // Show notification
      if (characterId) {
        ui.notifications.info(`${assignedName} assigned as ${role.charAt(0).toUpperCase() + role.slice(1)}!`);
      } else {
        ui.notifications.info(`${role.charAt(0).toUpperCase() + role.slice(1)} role cleared.`);
      }

      // Notify other clients
      game.socket.emit(`module.${MODULE_ID}`, {
        type: "refreshSheet",
        actorId: this.actor.id
      });

      // Now manually re-render after update is complete
      this.render(true);
    } catch (err) {
      console.error("Spelljammer | Error updating crew assignment:", err);
      ui.notifications.error("Failed to assign crew member!");
    }
  }

  async _onRemoveCrew(event) {
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget;
    const role = element.dataset.role;
    if (!role) return;

    // Get fresh flag data
    const assignments = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "crewAssignments") ?? {});

    // Ensure gunners array exists
    if (!Array.isArray(assignments.gunners)) {
      assignments.gunners = [null, null, null, null];
    }

    if (role === "gunner") {
      const gunnerIndex = parseInt(element.dataset.gunnerIndex ?? 0);
      assignments.gunners[gunnerIndex] = null;
    } else {
      assignments[role] = null;
    }

    // Get the full current spelljammer data and merge in new assignments
    const currentData = this.actor.getFlag(MODULE_ID, "") ?? {};
    const updatedData = foundry.utils.mergeObject(currentData, { crewAssignments: assignments });

    // Use a single atomic update, but prevent automatic re-render
    await this.actor.update({
      [`flags.${MODULE_ID}`]: updatedData
    }, { render: false });

    // Notify other clients
    game.socket.emit(`module.${MODULE_ID}`, {
      type: "refreshSheet",
      actorId: this.actor.id
    });

    // Now manually re-render after update is complete
    this.render(true);
  }

  /* -------------------------------------------- */
  /*  Event Handlers - Power Modules              */
  /* -------------------------------------------- */

  async _onToggleModule(event) {
    event.preventDefault();
    const element = event.currentTarget;

    // Don't toggle if clicking on HP input
    if (event.target.classList.contains('module-hp-input')) return;

    // Get the item ID from the element (for Item-based modules)
    const itemId = element.dataset.itemId;
    const moduleId = element.dataset.moduleId;

    // Item-based module toggle
    if (itemId) {
      const item = this.actor.items.get(itemId);
      if (!item) return;

      const flags = item.flags?.[MODULE_ID] ?? {};
      const hp = item.system.hp?.value ?? 10;
      const cost = flags.cost ?? 1;

      if (hp <= 0) {
        ui.notifications.warn("This module is damaged and cannot be activated!");
        return;
      }

      const isCurrentlyActive = flags.active ?? false;

      if (!isCurrentlyActive) {
        // Check power charges
        const moduleItems = getPowerModules(this.actor);
        const usedCharges = this._calculateUsedPowerChargesFromItems(moduleItems);
        const maxCharges = this._getBoatswainProficiency(this.spelljammerData.crewAssignments?.boatswain);

        if (usedCharges + cost > maxCharges) {
          ui.notifications.warn("Not enough power charges available!");
          return;
        }
      }

      await item.update({
        [`flags.${MODULE_ID}.active`]: !isCurrentlyActive
      });

      // Special effect: Hull Reinforcement grants temp HP
      if (!isCurrentlyActive && flags.moduleId === "hullReinforcement") {
        await SpelljammerRolls.rollHullReinforcement(this.actor);
      }

      // Notify and render
      game.socket.emit(`module.${MODULE_ID}`, {
        type: "refreshSheet",
        actorId: this.actor.id
      });

      this.render(false);
      return;
    }

    // Legacy flag-based module toggle (for backwards compatibility)
    if (!moduleId || !POWER_MODULES[moduleId]) return;

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

    this.render(false);
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
    const element = event.currentTarget;
    const itemId = element.dataset.itemId;

    // Item-based weapon attack
    if (itemId) {
      const item = this.actor.items.get(itemId);
      if (!item) return;

      const flags = item.flags?.[MODULE_ID] ?? {};
      const assignedGunnerIdx = flags.assignedGunner;
      const sjData = this.spelljammerData;

      // Get gunner stats
      let attackBonus = 0;
      let gunnerName = "Unassigned";
      let gunnerActor = null;

      if (assignedGunnerIdx !== null && assignedGunnerIdx !== undefined && sjData.crewAssignments?.gunners) {
        const gunnerId = sjData.crewAssignments.gunners[assignedGunnerIdx];
        if (gunnerId) {
          gunnerActor = game.actors.get(gunnerId);
          if (gunnerActor) {
            const dexMod = gunnerActor.system.abilities?.dex?.mod ?? 0;
            const prof = gunnerActor.system.attributes?.prof ?? 2;
            attackBonus = dexMod + prof;
            gunnerName = gunnerActor.name;
          }
        }
      }

      // Get damage info
      const damageParts = item.system.damage?.parts ?? [];
      const baseDamage = damageParts[0]?.[0] ?? "2d10";
      const damageType = damageParts[0]?.[1] ?? "bludgeoning";

      // Check for Weapons Array bonus
      const moduleItems = getPowerModules(this.actor);
      const weaponsArray = moduleItems.find(m => m.flags?.[MODULE_ID]?.moduleId === "weaponsArray");
      const hasWeaponsArrayBonus = weaponsArray?.flags?.[MODULE_ID]?.active && (weaponsArray.system.hp?.value ?? 10) > 0;

      // Roll attack
      const roll = await new Roll("1d20 + @bonus", { bonus: attackBonus }).evaluate();
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `<div class="spelljammer-chat weapon-attack">
          <h3>${item.name}</h3>
          <p><strong>Gunner:</strong> ${gunnerName}</p>
          <p><strong>Attack Roll:</strong></p>
        </div>`
      });

      // Create damage roll button
      const damageFormula = hasWeaponsArrayBonus ? `${baseDamage} + 1d6` : baseDamage;
      const damageContent = `<div class="spelljammer-chat weapon-damage">
        <p><strong>Damage:</strong> ${damageFormula} ${damageType}</p>
        ${hasWeaponsArrayBonus ? '<p class="bonus-note"><i class="fas fa-bolt"></i> Weapons Array: +1d6 damage</p>' : ''}
        <button class="spelljammer-damage-roll" data-formula="${damageFormula}" data-type="${damageType}" data-weapon="${item.name}">
          <i class="fas fa-dice-d20"></i> Roll Damage
        </button>
      </div>`;

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: damageContent
      });

      return;
    }

    // Legacy flag-based weapon attack
    const weaponIndex = parseInt(element.dataset.weaponIndex);
    await SpelljammerRolls.rollWeaponAttack(this.actor, this.spelljammerData, weaponIndex);
  }

  async _onAssignWeaponGunner(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation(); // Prevent Foundry's _onChangeInput
    const element = event.currentTarget;
    const itemId = element.dataset.itemId;
    const gunnerIndex = element.value === "" ? null : parseInt(element.value);

    // Item-based weapon
    if (itemId) {
      const item = this.actor.items.get(itemId);
      if (!item) return;

      await item.update({
        [`flags.${MODULE_ID}.assignedGunner`]: gunnerIndex
      });

      this.render(false);
      return;
    }

    // Legacy flag-based weapon
    const weaponIndex = parseInt(element.dataset.weaponIndex);
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

    // Create weapon as an Item
    await addShipWeapon(this.actor, {
      name: "New Weapon",
      damage: "2d10",
      damageType: "bludgeoning",
      range: "300/900",
      position: "broadside",
      firingArc: 90,
      properties: [],
      hp: 10,
      maxHp: 10
    });

    ui.notifications.info("New ship weapon added!");
    this.render(false);
  }

  async _onDeleteWeapon(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.dataset.itemId;

    // Item-based weapon
    if (itemId) {
      const item = this.actor.items.get(itemId);
      if (!item) return;

      const confirm = await Dialog.confirm({
        title: "Delete Weapon",
        content: `<p>Are you sure you want to delete <strong>${item.name}</strong>?</p>`
      });

      if (confirm) {
        await item.delete();
        this.render(false);
      }
      return;
    }

    // Legacy flag-based weapon
    const weaponIndex = parseInt(element.dataset.weaponIndex);
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
  /*  Drag and Drop                               */
  /* -------------------------------------------- */

  /** @override */
  _canDragDrop(selector) {
    return this.isEditable;
  }

  /** @override */
  async _onDrop(event) {
    event.preventDefault();

    // Try to extract the data
    let data;
    try {
      data = JSON.parse(event.dataTransfer?.getData("text/plain"));
    } catch (err) {
      return false;
    }

    // Handle dropping an Actor (for crew assignment)
    if (data.type === "Actor") {
      return this._onDropActor(event, data);
    }

    // Handle dropping an Item (for weapons)
    if (data.type === "Item") {
      return this._onDropItem(event, data);
    }

    return false;
  }

  /**
   * Handle dropping an Actor onto the sheet for crew assignment
   */
  async _onDropActor(event, data) {
    // Get the dropped actor
    const actor = await Actor.implementation.fromDropData(data);
    if (!actor) return false;

    // Only allow character actors
    if (actor.type !== "character") {
      ui.notifications.warn("Only character actors can be assigned as crew!");
      return false;
    }

    // Find which drop zone we're in
    const dropTarget = event.target.closest("[data-drop-role]");
    if (dropTarget) {
      const role = dropTarget.dataset.dropRole;
      const gunnerIndex = dropTarget.dataset.gunnerIndex;
      return this._assignCrewMember(actor, role, gunnerIndex);
    }

    // If no specific drop zone, show a dialog to choose role
    const roleChoice = await this._showRoleSelectionDialog(actor);
    if (roleChoice) {
      return this._assignCrewMember(actor, roleChoice.role, roleChoice.gunnerIndex);
    }

    return false;
  }

  /**
   * Handle dropping an Item onto the sheet (for weapons)
   */
  async _onDropItem(event, data) {
    const item = await Item.implementation.fromDropData(data);
    if (!item) return false;

    // Check if it's a weapon-type item
    if (item.type === "weapon") {
      // Create a new ship weapon based on the item
      const weapons = foundry.utils.deepClone(this.spelljammerData.weapons ?? []);
      weapons.push({
        name: item.name,
        damage: item.system.damage?.parts?.[0]?.[0] ?? "2d10",
        damageType: item.system.damage?.parts?.[0]?.[1] ?? "bludgeoning",
        range: `${item.system.range?.value ?? 300}/${item.system.range?.long ?? 900}`,
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

      ui.notifications.info(`Added ${item.name} as a ship weapon!`);
      return true;
    }

    return false;
  }

  /**
   * Assign a crew member to a role
   */
  async _assignCrewMember(actor, role, gunnerIndex = null) {
    // Get fresh flag data directly
    const assignments = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "crewAssignments") ?? {});

    // Ensure gunners array exists with proper length
    if (!Array.isArray(assignments.gunners)) {
      assignments.gunners = [null, null, null, null];
    }
    while (assignments.gunners.length < 4) {
      assignments.gunners.push(null);
    }

    if (role === "gunner") {
      const idx = parseInt(gunnerIndex ?? 0);
      assignments.gunners[idx] = actor.id;
    } else {
      assignments[role] = actor.id;
    }

    // Get the full current spelljammer data and merge in new assignments
    const currentData = this.actor.getFlag(MODULE_ID, "") ?? {};
    const updatedData = foundry.utils.mergeObject(currentData, { crewAssignments: assignments });

    // Use a single atomic update, but prevent automatic re-render
    await this.actor.update({
      [`flags.${MODULE_ID}`]: updatedData
    }, { render: false });

    ui.notifications.info(`${actor.name} assigned as ${role.charAt(0).toUpperCase() + role.slice(1)}!`);

    // Notify other clients
    game.socket.emit(`module.${MODULE_ID}`, {
      type: "refreshSheet",
      actorId: this.actor.id
    });

    // Now manually re-render after update is complete
    this.render(true);

    return true;
  }

  /**
   * Show a dialog to select which role to assign
   */
  async _showRoleSelectionDialog(actor) {
    return new Promise((resolve) => {
      new Dialog({
        title: `Assign ${actor.name} to Crew Role`,
        content: `
          <p>Select a role for <strong>${actor.name}</strong>:</p>
          <form>
            <div class="form-group">
              <label>Role:</label>
              <select name="role" style="width: 100%;">
                <option value="captain">Captain</option>
                <option value="helmsman">Helmsman</option>
                <option value="boatswain">Boatswain</option>
                <option value="gunner-0">Gunner 1</option>
                <option value="gunner-1">Gunner 2</option>
                <option value="gunner-2">Gunner 3</option>
                <option value="gunner-3">Gunner 4</option>
              </select>
            </div>
          </form>
        `,
        buttons: {
          assign: {
            icon: '<i class="fas fa-check"></i>',
            label: "Assign",
            callback: (html) => {
              const roleValue = html.find('[name="role"]').val();
              if (roleValue.startsWith("gunner-")) {
                resolve({ role: "gunner", gunnerIndex: roleValue.split("-")[1] });
              } else {
                resolve({ role: roleValue, gunnerIndex: null });
              }
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel",
            callback: () => resolve(null)
          }
        },
        default: "assign"
      }).render(true);
    });
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
