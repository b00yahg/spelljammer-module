/**
 * Spelljammer Ship Sheet
 * Custom ActorSheet for vehicle actors with Spelljammer functionality
 */

import { SpelljammerRolls } from "../helpers/rolls.mjs";

const MODULE_ID = "spelljammer-combat";

export class SpelljammerShipSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["spelljammer", "sheet", "actor", "vehicle"],
      template: `modules/${MODULE_ID}/templates/spelljammer-sheet.hbs`,
      width: 800,
      height: 700,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "bridge" }],
      dragDrop: [{ dragSelector: null, dropSelector: ".crew-dropzone" }]
    });
  }

  /** @override */
  get template() {
    return `modules/${MODULE_ID}/templates/spelljammer-sheet.hbs`;
  }

  /** @override */
  async _render(force = false, options = {}) {
    try {
      await super._render(force, options);
    } catch (error) {
      console.error(`${MODULE_ID} | Error rendering sheet:`, error);
      ui.notifications?.error("Error rendering Spelljammer sheet. Check console for details.");

      // Try to render with minimal template as fallback
      const html = `<div class="spelljammer-sheet" style="padding: 20px;">
        <h1>${this.actor?.name || "Ship"}</h1>
        <p style="color: red;">Error loading sheet. Please check the browser console (F12) for details.</p>
        <p>Try refreshing the page. If the issue persists, try removing the sheet type and re-assigning it.</p>
        <button onclick="this.closest('.app').querySelector('.close').click()">Close</button>
      </div>`;
      this.element.html(html);
    }
  }

  // ==========================================================================
  // DATA PREPARATION
  // ==========================================================================

  /** @override */
  async getData(options = {}) {
    const context = await super.getData(options);
    const actor = this.actor;

    try {
      // Ensure Spelljammer data is initialized
      await this._ensureSpelljammerData();

      // Get all Spelljammer flags
      const sjData = this._getSpelljammerData();

      // Resolve crew assignments to actual actor objects
      const resolvedCrew = await this._resolveCrewAssignments(sjData.crewAssignments);

      // Get available characters for assignment
      const availableCharacters = this._getAvailableCharacters(sjData.crewAssignments);

      // Prepare weapons with computed attack bonuses
      const preparedWeapons = this._prepareWeapons(sjData.weapons, resolvedCrew);

      // Prepare power module display data
      const preparedModules = this._preparePowerModules(sjData.powerModules, resolvedCrew.boatswain);

      // Calculate power charges
      const boatswainProf = resolvedCrew.boatswain?.prof ?? 0;
      const bonusCharge = sjData.combat?.activeOrder === "engineering" ? 1 : 0;
      const totalCharges = boatswainProf + bonusCharge;
      const usedCharges = sjData.powerCharges?.used ?? 0;
      const availableCharges = Math.max(0, totalCharges - usedCharges);

      // Y2K theme setting - with fallback
      let y2kTheme = true;
      try {
        y2kTheme = game.settings.get(MODULE_ID, "y2kTheme");
      } catch (e) {
        console.log(`${MODULE_ID} | Settings not yet registered, using defaults`);
      }

      // Build context
      context.spelljammer = {
        ...sjData,
        crew: resolvedCrew,
        availableCharacters,
        weapons: preparedWeapons,
        modules: preparedModules,
        isSinglePilot: sjData.singlePilot || false,
        power: {
          total: totalCharges,
          used: usedCharges,
          available: availableCharges,
          bonusFromOrder: bonusCharge > 0
        }
      };

      context.y2kTheme = y2kTheme;
      context.isGM = game.user.isGM;
      context.isOwner = actor.isOwner;
      context.directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

    } catch (error) {
      console.error(`${MODULE_ID} | Error in getData:`, error);
      console.error(`${MODULE_ID} | Stack trace:`, error.stack);

      // Provide complete fallback context to prevent blank sheet
      context.spelljammer = {
        initialized: false,
        shipClass: "Unknown",
        velocity: { current: 0, direction: "N", maxAcceleration: 200, maxDeceleration: 200 },
        crew: { captain: null, helmsman: null, gunners: [], boatswain: null },
        crewAssignments: { captain: null, helmsman: null, gunners: [], boatswain: null },
        crewRequirements: { minimum: 1, maximum: 10 },
        airSupply: { current: 30, max: 30 },
        availableCharacters: [],
        weapons: [],
        modules: [],
        power: { total: 0, used: 0, available: 0, bonusFromOrder: false },
        powerCharges: { used: 0, bonusFromOrder: false },
        powerModules: {},
        combat: { activeOrder: null, captainOrderUsed: false },
        isSinglePilot: false
      };
      context.y2kTheme = true;
      context.isGM = game.user?.isGM ?? false;
      context.isOwner = actor?.isOwner ?? false;
      context.directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    }

    return context;
  }

  /**
   * Ensure Spelljammer data exists on the actor
   * This is the KEY function for persistence - it only sets defaults for missing values
   */
  async _ensureSpelljammerData() {
    const initialized = this.actor.getFlag(MODULE_ID, "initialized");

    if (!initialized) {
      console.log(`${MODULE_ID} | Initializing Spelljammer data for ${this.actor.name}`);

      const defaults = {
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
        crewRequirements: { minimum: 5, maximum: 15 },
        airSupply: { current: 30, max: 30 },
        powerModules: {
          weaponsArray: { active: false, hp: 10, maxHp: 10 },
          deflectorGrid: { active: false, hp: 10, maxHp: 10, damageType: null },
          thrusterOverride: { active: false, hp: 10, maxHp: 10 },
          hullReinforcement: { active: false, hp: 10, maxHp: 10 },
          systemRestoration: { active: false, hp: 10, maxHp: 10 },
          warpCoreCharge: { active: false, hp: 10, maxHp: 10, chargeProgress: 0 }
        },
        powerCharges: {
          used: 0,
          bonusFromOrder: false
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

      // Set each default individually - this preserves any existing values
      for (const [key, value] of Object.entries(defaults)) {
        const existing = this.actor.getFlag(MODULE_ID, key);
        if (existing === undefined) {
          await this.actor.setFlag(MODULE_ID, key, value);
        }
      }
    }
  }

  /**
   * Get all Spelljammer data from flags
   */
  _getSpelljammerData() {
    return {
      initialized: this.actor.getFlag(MODULE_ID, "initialized") ?? false,
      shipClass: this.actor.getFlag(MODULE_ID, "shipClass") ?? "Unknown",
      velocity: this.actor.getFlag(MODULE_ID, "velocity") ?? { current: 0, direction: "N", maxAcceleration: 200, maxDeceleration: 200 },
      crewAssignments: this.actor.getFlag(MODULE_ID, "crewAssignments") ?? { captain: null, helmsman: null, gunners: [], boatswain: null },
      crewRequirements: this.actor.getFlag(MODULE_ID, "crewRequirements") ?? { minimum: 5, maximum: 15 },
      airSupply: this.actor.getFlag(MODULE_ID, "airSupply") ?? { current: 30, max: 30 },
      powerModules: this.actor.getFlag(MODULE_ID, "powerModules") ?? {},
      powerCharges: this.actor.getFlag(MODULE_ID, "powerCharges") ?? { used: 0, bonusFromOrder: false },
      weapons: this.actor.getFlag(MODULE_ID, "weapons") ?? [],
      combat: this.actor.getFlag(MODULE_ID, "combat") ?? {},
      singlePilot: this.actor.getFlag(MODULE_ID, "singlePilot") ?? false
    };
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

    // Resolve captain
    if (assignments.captain) {
      const captain = game.actors.get(assignments.captain);
      if (captain) {
        resolved.captain = this._getCrewMemberData(captain);
      }
    }

    // Resolve helmsman
    if (assignments.helmsman) {
      const helmsman = game.actors.get(assignments.helmsman);
      if (helmsman) {
        resolved.helmsman = this._getCrewMemberData(helmsman);
      }
    }

    // Resolve gunners
    const gunners = assignments.gunners || [];
    for (let i = 0; i < gunners.length; i++) {
      if (gunners[i]) {
        const gunner = game.actors.get(gunners[i]);
        if (gunner) {
          resolved.gunners[i] = this._getCrewMemberData(gunner);
        } else {
          resolved.gunners[i] = null;
        }
      } else {
        resolved.gunners[i] = null;
      }
    }

    // Resolve boatswain
    if (assignments.boatswain) {
      const boatswain = game.actors.get(assignments.boatswain);
      if (boatswain) {
        resolved.boatswain = this._getCrewMemberData(boatswain);
      }
    }

    return resolved;
  }

  /**
   * Extract relevant data from a crew member actor
   */
  _getCrewMemberData(actor) {
    const abilities = actor.system.abilities || {};
    const attributes = actor.system.attributes || {};

    return {
      id: actor.id,
      name: actor.name,
      img: actor.img,
      // Ability modifiers
      str: abilities.str?.mod ?? 0,
      dex: abilities.dex?.mod ?? 0,
      con: abilities.con?.mod ?? 0,
      int: abilities.int?.mod ?? 0,
      wis: abilities.wis?.mod ?? 0,
      cha: abilities.cha?.mod ?? 0,
      // Proficiency bonus
      prof: attributes.prof ?? 2,
      // Computed bonuses
      initiativeBonus: (abilities.cha?.mod ?? 0) + (attributes.prof ?? 2),
      vehicleBonus: (abilities.cha?.mod ?? 0) + (attributes.prof ?? 2),
      attackBonus: (abilities.dex?.mod ?? 0) + (attributes.prof ?? 2),
      movementBonus: (abilities.wis?.mod ?? 0) + (attributes.prof ?? 2)
    };
  }

  /**
   * Get list of available characters for crew assignment
   */
  _getAvailableCharacters(assignments) {
    // Get all assigned IDs
    const assignedIds = new Set();
    if (assignments.captain) assignedIds.add(assignments.captain);
    if (assignments.helmsman) assignedIds.add(assignments.helmsman);
    if (assignments.boatswain) assignedIds.add(assignments.boatswain);
    (assignments.gunners || []).forEach(id => {
      if (id) assignedIds.add(id);
    });

    // Get all character actors that aren't assigned
    return game.actors
      .filter(a => a.type === "character" && !assignedIds.has(a.id))
      .map(a => ({
        id: a.id,
        name: a.name,
        img: a.img
      }));
  }

  /**
   * Prepare weapons with computed attack bonuses
   */
  _prepareWeapons(weapons, crew) {
    return (weapons || []).map(weapon => {
      const gunnerIndex = weapon.assignedGunner;
      const gunner = gunnerIndex !== null && crew.gunners[gunnerIndex] ? crew.gunners[gunnerIndex] : null;

      return {
        ...weapon,
        gunner,
        attackBonus: gunner ? gunner.attackBonus : 0,
        damageBonus: gunner ? gunner.dex : 0,
        canFire: weapon.hp > 0 && gunner !== null
      };
    });
  }

  /**
   * Prepare power modules for display
   */
  _preparePowerModules(modules, boatswain) {
    const moduleDefinitions = {
      weaponsArray: { name: "Weapons Array", cost: 1, effect: "+1d6 damage to all weapon attacks" },
      deflectorGrid: { name: "Deflector Grid", cost: 1, effect: "Resistance to one damage type" },
      thrusterOverride: { name: "Thruster Override", cost: 1, effect: "+100 ft to max acceleration/deceleration" },
      hullReinforcement: { name: "Hull Reinforcement", cost: 1, effect: "Gain 2d8 temporary HP" },
      systemRestoration: { name: "System Restoration", cost: 1, effect: "Restore a disabled system to 1 HP" },
      warpCoreCharge: { name: "Warp Core Charge", cost: 2, effect: "After 3 turns, can warp jump" }
    };

    const prepared = [];
    for (const [key, definition] of Object.entries(moduleDefinitions)) {
      const moduleData = modules[key] || { active: false, hp: 10, maxHp: 10 };
      prepared.push({
        id: key,
        ...definition,
        ...moduleData,
        isDisabled: moduleData.hp <= 0,
        canActivate: boatswain !== null && moduleData.hp > 0
      });
    }

    return prepared;
  }

  // ==========================================================================
  // CREW ASSIGNMENT - THE CORE PERSISTENCE LOGIC
  // ==========================================================================

  /**
   * Assign a crew member to a role
   * THIS IS THE KEY FUNCTION - uses setFlag for atomic updates
   */
  async assignCrewMember(role, actorId, gunnerIndex = null) {
    console.log(`${MODULE_ID} | Assigning ${actorId} to ${role}` + (gunnerIndex !== null ? ` (slot ${gunnerIndex})` : ""));

    // Get FRESH copy of current assignments
    const currentAssignments = foundry.utils.deepClone(
      this.actor.getFlag(MODULE_ID, "crewAssignments") || {
        captain: null,
        helmsman: null,
        gunners: [null, null, null, null],
        boatswain: null
      }
    );

    // First, remove this actor from any existing role
    if (currentAssignments.captain === actorId) currentAssignments.captain = null;
    if (currentAssignments.helmsman === actorId) currentAssignments.helmsman = null;
    if (currentAssignments.boatswain === actorId) currentAssignments.boatswain = null;

    const gunners = currentAssignments.gunners || [];
    for (let i = 0; i < gunners.length; i++) {
      if (gunners[i] === actorId) gunners[i] = null;
    }
    currentAssignments.gunners = gunners;

    // Now assign to new role
    switch (role) {
      case "captain":
        currentAssignments.captain = actorId;
        break;
      case "helmsman":
        currentAssignments.helmsman = actorId;
        break;
      case "boatswain":
        currentAssignments.boatswain = actorId;
        break;
      case "gunner":
        if (gunnerIndex !== null && gunnerIndex >= 0) {
          // Ensure gunners array is long enough
          while (currentAssignments.gunners.length <= gunnerIndex) {
            currentAssignments.gunners.push(null);
          }
          currentAssignments.gunners[gunnerIndex] = actorId;
        }
        break;
    }

    // Use setFlag for atomic update - this triggers persistence and sheet refresh
    await this.actor.setFlag(MODULE_ID, "crewAssignments", currentAssignments);

    // Log for debugging
    console.log(`${MODULE_ID} | Crew assignments updated:`, currentAssignments);

    // Notify other clients
    game.socket.emit(`module.${MODULE_ID}`, {
      type: "crewUpdate",
      actorId: this.actor.id
    });

    // Notification
    const crewActor = game.actors.get(actorId);
    if (crewActor) {
      ui.notifications.info(`${crewActor.name} assigned as ${role}${gunnerIndex !== null ? ` ${gunnerIndex + 1}` : ""}`);
    }
  }

  /**
   * Remove a crew member from their role
   */
  async removeCrewMember(role, gunnerIndex = null) {
    console.log(`${MODULE_ID} | Removing crew from ${role}` + (gunnerIndex !== null ? ` (slot ${gunnerIndex})` : ""));

    // Get FRESH copy of current assignments
    const currentAssignments = foundry.utils.deepClone(
      this.actor.getFlag(MODULE_ID, "crewAssignments") || {
        captain: null,
        helmsman: null,
        gunners: [],
        boatswain: null
      }
    );

    // Store name for notification
    let removedName = null;

    // Remove from specified role
    switch (role) {
      case "captain":
        if (currentAssignments.captain) {
          const actor = game.actors.get(currentAssignments.captain);
          removedName = actor?.name;
        }
        currentAssignments.captain = null;
        break;
      case "helmsman":
        if (currentAssignments.helmsman) {
          const actor = game.actors.get(currentAssignments.helmsman);
          removedName = actor?.name;
        }
        currentAssignments.helmsman = null;
        break;
      case "boatswain":
        if (currentAssignments.boatswain) {
          const actor = game.actors.get(currentAssignments.boatswain);
          removedName = actor?.name;
        }
        currentAssignments.boatswain = null;
        break;
      case "gunner":
        if (gunnerIndex !== null && currentAssignments.gunners && currentAssignments.gunners[gunnerIndex]) {
          const actor = game.actors.get(currentAssignments.gunners[gunnerIndex]);
          removedName = actor?.name;
          currentAssignments.gunners[gunnerIndex] = null;
        }
        break;
    }

    // Use setFlag for atomic update
    await this.actor.setFlag(MODULE_ID, "crewAssignments", currentAssignments);

    // Notify other clients
    game.socket.emit(`module.${MODULE_ID}`, {
      type: "crewUpdate",
      actorId: this.actor.id
    });

    // Notification
    if (removedName) {
      ui.notifications.info(`${removedName} removed from ${role}`);
    }
  }

  // ==========================================================================
  // EVENT LISTENERS
  // ==========================================================================

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Only activate for owners
    if (!this.isEditable) return;

    // Crew assignment via dropdown
    html.find(".crew-select").on("change", this._onCrewSelect.bind(this));

    // Remove crew buttons
    html.find(".remove-crew").on("click", this._onRemoveCrew.bind(this));

    // Roll buttons
    html.find(".roll-initiative").on("click", this._onRollInitiative.bind(this));
    html.find(".roll-vehicle-check").on("click", this._onRollVehicleCheck.bind(this));
    html.find(".roll-weapon-attack").on("click", this._onRollWeaponAttack.bind(this));
    html.find(".roll-weapon-damage").on("click", this._onRollWeaponDamage.bind(this));

    // Captain orders
    html.find(".captain-order").on("click", this._onCaptainOrder.bind(this));

    // Helmsman actions
    html.find(".helmsman-action").on("click", this._onHelmsmanAction.bind(this));

    // Power module controls
    html.find(".toggle-module").on("click", this._onToggleModule.bind(this));
    html.find(".allocate-power").on("click", this._onAllocatePower.bind(this));

    // Velocity controls - editable inputs
    html.find(".velocity-adjust").on("click", this._onVelocityAdjust.bind(this));
    html.find(".direction-select").on("change", this._onDirectionChange.bind(this));
    html.find(".velocity-input").on("change", this._onVelocityInput.bind(this));
    html.find(".direction-btn").on("click", this._onDirectionClick.bind(this));
    html.find(".max-accel-input").on("change", this._onMaxAccelChange.bind(this));
    html.find(".max-decel-input").on("change", this._onMaxDecelChange.bind(this));

    // Weapon gunner assignment
    html.find(".weapon-gunner-select").on("change", this._onWeaponGunnerSelect.bind(this));

    // Reset power charges (new turn)
    html.find(".reset-power-charges").on("click", this._onResetPowerCharges.bind(this));
  }

  /** @override */
  async _onDrop(event) {
    event.preventDefault();

    // Get drop target
    const dropzone = event.target.closest(".crew-dropzone");
    if (!dropzone) return super._onDrop(event);

    // Get dropped data
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (e) {
      return;
    }

    // Only accept actors
    if (data.type !== "Actor") return;

    // Get the actor
    const actor = await fromUuid(data.uuid);
    if (!actor || actor.type !== "character") {
      ui.notifications.warn("Only character actors can be assigned as crew.");
      return;
    }

    // Get role from dropzone
    const role = dropzone.dataset.role;
    const gunnerIndex = dropzone.dataset.gunnerIndex !== undefined
      ? parseInt(dropzone.dataset.gunnerIndex)
      : null;

    // Assign crew member
    await this.assignCrewMember(role, actor.id, gunnerIndex);
  }

  /**
   * Handle crew selection from dropdown
   */
  async _onCrewSelect(event) {
    event.preventDefault();
    const select = event.currentTarget;
    const role = select.dataset.role;
    const gunnerIndex = select.dataset.gunnerIndex !== undefined
      ? parseInt(select.dataset.gunnerIndex)
      : null;
    const actorId = select.value;

    if (actorId) {
      await this.assignCrewMember(role, actorId, gunnerIndex);
    }
  }

  /**
   * Handle crew removal
   */
  async _onRemoveCrew(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const role = button.dataset.role;
    const gunnerIndex = button.dataset.gunnerIndex !== undefined
      ? parseInt(button.dataset.gunnerIndex)
      : null;

    await this.removeCrewMember(role, gunnerIndex);
  }

  /**
   * Roll initiative for the ship
   */
  async _onRollInitiative(event) {
    event.preventDefault();
    const sjData = this._getSpelljammerData();
    const captain = sjData.crewAssignments.captain
      ? game.actors.get(sjData.crewAssignments.captain)
      : null;

    await SpelljammerRolls.rollInitiative(this.actor, captain);
  }

  /**
   * Roll a vehicle check
   */
  async _onRollVehicleCheck(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const checkType = button.dataset.checkType;
    const ability = button.dataset.ability || "cha";

    const sjData = this._getSpelljammerData();
    let crewMember = null;

    // Determine which crew member makes this check
    switch (checkType) {
      case "grapple":
      case "hail":
        crewMember = sjData.crewAssignments.captain
          ? game.actors.get(sjData.crewAssignments.captain)
          : null;
        break;
      case "overdrive":
      case "brake":
      case "evade":
        crewMember = sjData.crewAssignments.helmsman
          ? game.actors.get(sjData.crewAssignments.helmsman)
          : null;
        break;
    }

    await SpelljammerRolls.rollVehicleCheck(this.actor, crewMember, checkType, ability);
  }

  /**
   * Roll a weapon attack
   */
  async _onRollWeaponAttack(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const weaponId = button.dataset.weaponId;

    const sjData = this._getSpelljammerData();
    const weapon = sjData.weapons.find(w => w.id === weaponId);
    if (!weapon) return;

    const gunnerIndex = weapon.assignedGunner;
    const gunnerId = sjData.crewAssignments.gunners?.[gunnerIndex];
    const gunner = gunnerId ? game.actors.get(gunnerId) : null;

    const weaponsArrayActive = sjData.powerModules?.weaponsArray?.active || false;

    await SpelljammerRolls.rollWeaponAttack(this.actor, weapon, gunner, weaponsArrayActive);
  }

  /**
   * Roll weapon damage
   */
  async _onRollWeaponDamage(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const weaponId = button.dataset.weaponId;

    const sjData = this._getSpelljammerData();
    const weapon = sjData.weapons.find(w => w.id === weaponId);
    if (!weapon) return;

    const gunnerIndex = weapon.assignedGunner;
    const gunnerId = sjData.crewAssignments.gunners?.[gunnerIndex];
    const gunner = gunnerId ? game.actors.get(gunnerId) : null;

    const weaponsArrayActive = sjData.powerModules?.weaponsArray?.active || false;

    await SpelljammerRolls.rollWeaponDamage(this.actor, weapon, gunner, weaponsArrayActive);
  }

  /**
   * Handle captain order selection
   */
  async _onCaptainOrder(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const orderType = button.dataset.order;

    const combat = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "combat") || {});

    if (combat.captainOrderUsed) {
      ui.notifications.warn("Captain has already issued an order this combat.");
      return;
    }

    combat.captainOrderUsed = true;
    combat.activeOrder = orderType;

    await this.actor.setFlag(MODULE_ID, "combat", combat);

    // Send chat message
    const orderNames = {
      offensive: "Offensive Order - A Gunner gets an extra weapon attack!",
      engineering: "Engineering Order - Boatswain gains +1 power charge!",
      tactical: "Tactical Order - Helmsman gets advantage on Overdrive/Brake checks!"
    };

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="spelljammer-chat"><strong>Captain's Order:</strong> ${orderNames[orderType]}</div>`
    });
  }

  /**
   * Handle helmsman special actions
   */
  async _onHelmsmanAction(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const action = button.dataset.action;

    const sjData = this._getSpelljammerData();
    const helmsman = sjData.crewAssignments.helmsman
      ? game.actors.get(sjData.crewAssignments.helmsman)
      : null;

    switch (action) {
      case "overdrive":
      case "brake":
        await SpelljammerRolls.rollVehicleCheck(this.actor, helmsman, action, "wis");
        break;
      case "evade":
        // Evade costs a spell slot
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div class="spelljammer-chat"><strong>Evade:</strong> Expend a 1st-level spell slot. Until next turn, add proficiency bonus to AC or Vehicle checks. (+2 per level above 1st)</div>`
        });
        break;
      case "jamming":
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div class="spelljammer-chat"><strong>Jamming:</strong> Expend a 3rd-level spell slot. For 1 minute, match another ship's speed, acceleration, and deceleration.</div>`
        });
        break;
    }
  }

  /**
   * Allocate power to a module
   */
  async _onAllocatePower(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const moduleId = button.dataset.moduleId;

    // Get boatswain for power charge calculation
    const sjData = this._getSpelljammerData();
    const boatswainId = sjData.crewAssignments.boatswain;

    if (!boatswainId) {
      ui.notifications.warn("No Boatswain assigned to allocate power!");
      return;
    }

    const boatswain = game.actors.get(boatswainId);
    const boatswainProf = boatswain?.system.attributes.prof ?? 2;
    const bonusCharge = sjData.combat?.activeOrder === "engineering" ? 1 : 0;
    const totalCharges = boatswainProf + bonusCharge;

    const modules = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "powerModules") || {});
    const powerCharges = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "powerCharges") || { used: 0 });

    if (!modules[moduleId]) return;
    if (modules[moduleId].hp <= 0) {
      ui.notifications.warn("This module is disabled!");
      return;
    }

    // Module cost definitions
    const moduleCosts = {
      weaponsArray: 1,
      deflectorGrid: 1,
      thrusterOverride: 1,
      hullReinforcement: 1,
      systemRestoration: 1,
      warpCoreCharge: 2
    };

    const cost = moduleCosts[moduleId] || 1;
    const availableCharges = totalCharges - powerCharges.used;

    // Check if we have enough charges
    if (availableCharges < cost) {
      ui.notifications.warn(`Not enough power charges! Need ${cost}, have ${availableCharges}.`);
      return;
    }

    // Activate module and consume charges
    modules[moduleId].active = true;
    powerCharges.used += cost;

    await this.actor.setFlag(MODULE_ID, "powerModules", modules);
    await this.actor.setFlag(MODULE_ID, "powerCharges", powerCharges);

    // Handle special module effects
    const moduleInfo = {
      weaponsArray: { name: "Weapons Array", effect: "+1d6 damage to all weapon attacks until next turn" },
      deflectorGrid: { name: "Deflector Grid", effect: "Ship gains resistance to one damage type until next turn" },
      thrusterOverride: { name: "Thruster Override", effect: "+100 ft to max acceleration/deceleration this turn" },
      hullReinforcement: { name: "Hull Reinforcement", effect: "Ship gains 2d8 temporary HP" },
      systemRestoration: { name: "System Restoration", effect: "Restore a disabled system to 1 HP" },
      warpCoreCharge: { name: "Warp Core Charge", effect: "Charging warp core... (3 consecutive turns to jump)" }
    };

    const info = moduleInfo[moduleId];
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="spelljammer-chat">
        <h3><i class="fas fa-bolt"></i> Power Allocated</h3>
        <p><strong>${info.name}</strong> (${cost} charge${cost > 1 ? "s" : ""})</p>
        <p>${info.effect}</p>
        <p class="power-status">Charges: ${powerCharges.used}/${totalCharges} used</p>
      </div>`
    });

    // Roll for Hull Reinforcement
    if (moduleId === "hullReinforcement") {
      const roll = await new Roll("2d8").evaluate();
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: "Hull Reinforcement - Temporary HP"
      });
    }
  }

  /**
   * Deactivate a power module and refund charge
   */
  async _onToggleModule(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const moduleId = button.dataset.moduleId;

    const modules = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "powerModules") || {});
    const powerCharges = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "powerCharges") || { used: 0 });

    if (!modules[moduleId]) return;

    const moduleCosts = {
      weaponsArray: 1, deflectorGrid: 1, thrusterOverride: 1,
      hullReinforcement: 1, systemRestoration: 1, warpCoreCharge: 2
    };

    if (modules[moduleId].active) {
      // Deactivating - refund the charge
      modules[moduleId].active = false;
      powerCharges.used = Math.max(0, powerCharges.used - (moduleCosts[moduleId] || 1));
      ui.notifications.info(`${moduleId} deactivated, charge refunded.`);
    } else {
      // Can't activate via toggle - must use allocate
      ui.notifications.info("Use 'Allocate Power' to activate modules.");
      return;
    }

    await this.actor.setFlag(MODULE_ID, "powerModules", modules);
    await this.actor.setFlag(MODULE_ID, "powerCharges", powerCharges);
  }

  /**
   * Reset power charges for new turn
   */
  async _onResetPowerCharges(event) {
    event.preventDefault();

    // Deactivate all modules and reset charges
    const modules = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "powerModules") || {});
    for (const key of Object.keys(modules)) {
      modules[key].active = false;
    }

    await this.actor.setFlag(MODULE_ID, "powerModules", modules);
    await this.actor.setFlag(MODULE_ID, "powerCharges", { used: 0, bonusFromOrder: false });

    ui.notifications.info("Power charges reset for new turn!");
  }

  /**
   * Adjust velocity
   */
  async _onVelocityAdjust(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const adjustment = parseInt(button.dataset.adjust) || 0;

    const velocity = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "velocity") || {
      current: 0,
      direction: "N",
      maxAcceleration: 200,
      maxDeceleration: 200
    });

    // Apply adjustment within limits
    const newVelocity = Math.max(0, velocity.current + adjustment);

    if (adjustment > 0 && adjustment > velocity.maxAcceleration) {
      ui.notifications.warn(`Cannot accelerate more than ${velocity.maxAcceleration} ft!`);
      return;
    }
    if (adjustment < 0 && Math.abs(adjustment) > velocity.maxDeceleration) {
      ui.notifications.warn(`Cannot decelerate more than ${velocity.maxDeceleration} ft!`);
      return;
    }

    velocity.current = newVelocity;
    await this.actor.setFlag(MODULE_ID, "velocity", velocity);
  }

  /**
   * Change direction
   */
  async _onDirectionChange(event) {
    event.preventDefault();
    const select = event.currentTarget;
    const newDirection = select.value;

    const velocity = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "velocity") || {
      current: 0,
      direction: "N",
      maxAcceleration: 200,
      maxDeceleration: 200
    });

    velocity.direction = newDirection;
    await this.actor.setFlag(MODULE_ID, "velocity", velocity);
  }

  /**
   * Assign gunner to weapon
   */
  async _onWeaponGunnerSelect(event) {
    event.preventDefault();
    const select = event.currentTarget;
    const weaponId = select.dataset.weaponId;
    const gunnerIndex = select.value === "" ? null : parseInt(select.value);

    const weapons = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "weapons") || []);
    const weapon = weapons.find(w => w.id === weaponId);

    if (weapon) {
      weapon.assignedGunner = gunnerIndex;
      await this.actor.setFlag(MODULE_ID, "weapons", weapons);
      ui.notifications.info(`Gunner ${gunnerIndex !== null ? gunnerIndex + 1 : "unassigned"} for ${weapon.name}`);
    }
  }

  /**
   * Direct velocity input
   */
  async _onVelocityInput(event) {
    event.preventDefault();
    const input = event.currentTarget;
    const newSpeed = parseInt(input.value) || 0;

    const velocity = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "velocity") || {
      current: 0, direction: "N", maxAcceleration: 200, maxDeceleration: 200
    });

    velocity.current = Math.max(0, newSpeed);
    await this.actor.setFlag(MODULE_ID, "velocity", velocity);
  }

  /**
   * Direction button click
   */
  async _onDirectionClick(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const direction = button.dataset.direction;

    const velocity = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "velocity") || {
      current: 0, direction: "N", maxAcceleration: 200, maxDeceleration: 200
    });

    velocity.direction = direction;
    await this.actor.setFlag(MODULE_ID, "velocity", velocity);
  }

  /**
   * Max acceleration change
   */
  async _onMaxAccelChange(event) {
    event.preventDefault();
    const input = event.currentTarget;
    const newMax = parseInt(input.value) || 200;

    const velocity = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "velocity") || {
      current: 0, direction: "N", maxAcceleration: 200, maxDeceleration: 200
    });

    velocity.maxAcceleration = Math.max(0, newMax);
    await this.actor.setFlag(MODULE_ID, "velocity", velocity);
  }

  /**
   * Max deceleration change
   */
  async _onMaxDecelChange(event) {
    event.preventDefault();
    const input = event.currentTarget;
    const newMax = parseInt(input.value) || 200;

    const velocity = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "velocity") || {
      current: 0, direction: "N", maxAcceleration: 200, maxDeceleration: 200
    });

    velocity.maxDeceleration = Math.max(0, newMax);
    await this.actor.setFlag(MODULE_ID, "velocity", velocity);
  }
}
