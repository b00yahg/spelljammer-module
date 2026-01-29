/**
 * Spelljammer Roll Helpers
 * Handles all dice rolling for ship combat mechanics
 */

import { MODULE_ID, POWER_MODULES, OVERDRIVE_DC_TABLE } from "../../spelljammer.mjs";

export class SpelljammerRolls {

  /**
   * Roll ship initiative (Captain's Charisma + Proficiency)
   */
  static async rollShipInitiative(actor, sjData) {
    const captainId = sjData.crewAssignments?.captain;
    let bonus = 0;
    let captainName = "No Captain";

    if (captainId) {
      const captain = game.actors.get(captainId);
      if (captain) {
        const chaMod = captain.system.abilities?.cha?.mod ?? 0;
        const prof = captain.system.attributes?.prof ?? 2;
        bonus = chaMod + prof;
        captainName = captain.name;
      }
    }

    const roll = await new Roll(`1d20 + ${bonus}`).evaluate();

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<div class="spelljammer-chat initiative-roll">
        <h3>${actor.name} - Ship Initiative</h3>
        <p>Captain: <strong>${captainName}</strong></p>
        <p>Modifier: Charisma + Proficiency = ${bonus >= 0 ? '+' : ''}${bonus}</p>
      </div>`
    });

    return roll;
  }

  /**
   * Roll grapple check (Captain's Charisma + Vehicles proficiency)
   */
  static async rollGrapple(actor, sjData) {
    const captainId = sjData.crewAssignments?.captain;
    let bonus = 0;
    let captainName = "No Captain";

    if (captainId) {
      const captain = game.actors.get(captainId);
      if (captain) {
        const chaMod = captain.system.abilities?.cha?.mod ?? 0;
        const prof = captain.system.attributes?.prof ?? 2;
        bonus = chaMod + prof;
        captainName = captain.name;
      }
    }

    const roll = await new Roll(`1d20 + ${bonus}`).evaluate();

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<div class="spelljammer-chat grapple-roll">
        <h3>Grappling Ropes</h3>
        <p>Captain <strong>${captainName}</strong> attempts to grapple another vessel!</p>
        <p>Charisma (Vehicles) Check: ${bonus >= 0 ? '+' : ''}${bonus}</p>
        <p><em>Contested by opposing Captain's check (DC 10 if no Captain)</em></p>
      </div>`
    });

    return roll;
  }

  /**
   * Roll Overdrive check (Helmsman's Wisdom + Vehicles)
   */
  static async rollOverdrive(actor, sjData) {
    const helmsmanId = sjData.crewAssignments?.helmsman;
    let bonus = 0;
    let helmsmanName = "No Helmsman";
    const currentSpeed = sjData.velocity?.current ?? 0;
    const dc = SpelljammerRolls._getOverdriveDC(currentSpeed);

    // Check if Captain gave Tactical Order advantage
    const hasAdvantage = sjData.captainCommand === "helmsman";

    if (helmsmanId) {
      const helmsman = game.actors.get(helmsmanId);
      if (helmsman) {
        const wisMod = helmsman.system.abilities?.wis?.mod ?? 0;
        const prof = helmsman.system.attributes?.prof ?? 2;
        bonus = wisMod + prof;
        helmsmanName = helmsman.name;
      }
    }

    const formula = hasAdvantage ? `2d20kh + ${bonus}` : `1d20 + ${bonus}`;
    const roll = await new Roll(formula).evaluate();

    const success = roll.total >= dc;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<div class="spelljammer-chat overdrive-roll ${success ? 'success' : 'failure'}">
        <h3>Overdrive!</h3>
        <p>Helmsman <strong>${helmsmanName}</strong> pushes the helm beyond its limits!</p>
        <p>Wisdom (Vehicles) Check vs DC ${dc}</p>
        <p>Maximum Acceleration: <strong>${(sjData.velocity?.maxAcceleration ?? 200) * 3} ft</strong> (3x normal)</p>
        ${hasAdvantage ? '<p><em>Rolling with advantage (Captain\'s Tactical Order)</em></p>' : ''}
        <p class="result ${success ? 'success' : 'failure'}">
          ${success
            ? '✓ Success! Acceleration applied normally.'
            : '✗ Failed! Next turn, acceleration capability is reduced to zero as the helm recovers.'}
        </p>
      </div>`
    });

    // If failed, set combat flag
    if (!success) {
      await actor.update({
        [`flags.${MODULE_ID}.combat.overdriveDisabled`]: true
      });
    }

    return { roll, success };
  }

  /**
   * Roll Emergency Brake check
   */
  static async rollEmergencyBrake(actor, sjData) {
    const helmsmanId = sjData.crewAssignments?.helmsman;
    let bonus = 0;
    let helmsmanName = "No Helmsman";
    const currentSpeed = sjData.velocity?.current ?? 0;
    const dc = SpelljammerRolls._getOverdriveDC(currentSpeed);

    const hasAdvantage = sjData.captainCommand === "helmsman";

    if (helmsmanId) {
      const helmsman = game.actors.get(helmsmanId);
      if (helmsman) {
        const wisMod = helmsman.system.abilities?.wis?.mod ?? 0;
        const prof = helmsman.system.attributes?.prof ?? 2;
        bonus = wisMod + prof;
        helmsmanName = helmsman.name;
      }
    }

    const formula = hasAdvantage ? `2d20kh + ${bonus}` : `1d20 + ${bonus}`;
    const roll = await new Roll(formula).evaluate();

    const success = roll.total >= dc;

    let damageMessage = "";
    if (!success) {
      // Roll 2d6 force damage to ship
      const damageRoll = await new Roll("2d6").evaluate();
      damageMessage = `<p class="damage">The ship takes <strong>${damageRoll.total}</strong> force damage from magical feedback!</p>`;

      // Apply damage to ship
      const currentHp = actor.system.attributes?.hp?.value ?? 0;
      await actor.update({
        "system.attributes.hp.value": Math.max(0, currentHp - damageRoll.total)
      });
    }

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<div class="spelljammer-chat emergency-brake-roll ${success ? 'success' : 'failure'}">
        <h3>Emergency Brake!</h3>
        <p>Helmsman <strong>${helmsmanName}</strong> reverses the arcane flow!</p>
        <p>Wisdom (Vehicles) Check vs DC ${dc}</p>
        <p>Maximum Deceleration: <strong>${(sjData.velocity?.maxDeceleration ?? 200) * 3} ft</strong> (3x normal)</p>
        ${hasAdvantage ? '<p><em>Rolling with advantage (Captain\'s Tactical Order)</em></p>' : ''}
        <p class="result ${success ? 'success' : 'failure'}">
          ${success
            ? '✓ Success! Deceleration applied normally.'
            : '✗ Failed! The sudden strain damages the ship.'}
        </p>
        ${damageMessage}
      </div>`
    });

    return { roll, success };
  }

  /**
   * Roll weapon attack
   */
  static async rollWeaponAttack(actor, sjData, weaponIndex) {
    const weapons = sjData.weapons ?? [];
    const weapon = weapons[weaponIndex];

    if (!weapon) {
      ui.notifications.error("Weapon not found!");
      return;
    }

    // Check if weapon is functional
    if (weapon.hp <= 0) {
      ui.notifications.warn("This weapon is damaged and cannot fire!");
      return;
    }

    // Get gunner stats
    let attackBonus = 0;
    let gunnerName = "Unassigned";
    let dexMod = 0;
    let prof = 2;

    if (weapon.assignedGunner !== null) {
      const gunnerId = sjData.crewAssignments?.gunners?.[weapon.assignedGunner];
      if (gunnerId) {
        const gunner = game.actors.get(gunnerId);
        if (gunner) {
          dexMod = gunner.system.abilities?.dex?.mod ?? 0;
          prof = gunner.system.attributes?.prof ?? 2;
          attackBonus = dexMod + prof;
          gunnerName = gunner.name;
        }
      }
    }

    // Check for Weapons Array bonus damage
    const weaponsArrayActive = sjData.powerModules?.weaponsArray?.active &&
      sjData.powerModules?.weaponsArray?.hp > 0;

    // Build damage formula
    let damageFormula = weapon.damage;
    if (weaponsArrayActive) {
      damageFormula += " + 1d6";
    }
    // Add DEX mod to damage
    if (dexMod !== 0) {
      damageFormula += ` + ${dexMod}`;
    }

    // Roll attack
    const attackRoll = await new Roll(`1d20 + ${attackBonus}`).evaluate();

    // Create chat content
    let content = `<div class="spelljammer-chat weapon-attack">
      <h3>${weapon.name}</h3>
      <p>Gunner: <strong>${gunnerName}</strong></p>
      <p>Attack Roll: DEX (${dexMod >= 0 ? '+' : ''}${dexMod}) + Proficiency (+${prof})</p>
      <p>Range: ${weapon.range} ft | Position: ${weapon.position}</p>
      <p>Firing Arc: ${weapon.firingArc}°</p>
      ${weapon.properties?.length ? `<p>Properties: ${weapon.properties.join(", ")}</p>` : ''}
      ${weaponsArrayActive ? '<p class="bonus"><em>+1d6 damage from Weapons Array!</em></p>' : ''}
    </div>`;

    await attackRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: content
    });

    // Roll damage button in chat
    const damageButton = `<button class="spelljammer-damage-roll" data-formula="${damageFormula}" data-type="${weapon.damageType}" data-weapon="${weapon.name}">
      Roll Damage: ${damageFormula} ${weapon.damageType}
    </button>`;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="spelljammer-chat damage-prompt">
        <p>If the attack hits:</p>
        ${damageButton}
      </div>`
    });

    return attackRoll;
  }

  /**
   * Roll Hull Reinforcement (2d8 temp HP)
   */
  static async rollHullReinforcement(actor) {
    const roll = await new Roll("2d8").evaluate();

    // Apply temp HP to ship
    const currentTempHp = actor.system.attributes?.hp?.temp ?? 0;
    const newTempHp = Math.max(currentTempHp, roll.total);

    await actor.update({
      "system.attributes.hp.temp": newTempHp
    });

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<div class="spelljammer-chat hull-reinforcement">
        <h3>Hull Reinforcement</h3>
        <p>The Boatswain channels power to the hull plating!</p>
        <p>The ship gains <strong>${roll.total}</strong> temporary hit points.</p>
      </div>`
    });

    return roll;
  }

  /**
   * Roll collision damage
   */
  static async rollCollisionDamage(actor, size = "2x2") {
    const damageTable = {
      "0.5x0.5": "1d10",
      "1x1": "2d10",
      "2x2": "3d10",
      "3x3": "4d10",
      "4x4": "5d10"
    };

    const formula = damageTable[size] ?? "3d10";
    const roll = await new Roll(formula).evaluate();

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<div class="spelljammer-chat collision-damage">
        <h3>Collision!</h3>
        <p>Ship Size: ${size}</p>
        <p>Both vessels take bludgeoning damage!</p>
      </div>`
    });

    return roll;
  }

  /**
   * Roll grazing avoidance check
   */
  static async rollGrazingCheck(actor, sjData) {
    const helmsmanId = sjData.crewAssignments?.helmsman;
    let bonus = 0;
    let helmsmanName = "No Helmsman";
    const currentSpeed = sjData.velocity?.current ?? 0;
    const dc = SpelljammerRolls._getOverdriveDC(currentSpeed);

    if (helmsmanId) {
      const helmsman = game.actors.get(helmsmanId);
      if (helmsman) {
        const wisMod = helmsman.system.abilities?.wis?.mod ?? 0;
        const prof = helmsman.system.attributes?.prof ?? 2;
        bonus = wisMod + prof;
        helmsmanName = helmsman.name;
      }
    }

    // Check for Evade bonus
    if (sjData.combat?.evadeActive) {
      const helmsmanProf = game.actors.get(helmsmanId)?.system.attributes?.prof ?? 2;
      bonus += helmsmanProf;
    }

    const roll = await new Roll(`1d20 + ${bonus}`).evaluate();
    const success = roll.total >= dc;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<div class="spelljammer-chat grazing-check ${success ? 'success' : 'failure'}">
        <h3>Grazing Impact!</h3>
        <p>Helmsman <strong>${helmsmanName}</strong> attempts to avoid collision damage!</p>
        <p>Wisdom (Vehicles) Check vs DC ${dc}</p>
        ${sjData.combat?.evadeActive ? '<p><em>+Proficiency from Evade maneuver!</em></p>' : ''}
        <p class="result ${success ? 'success' : 'failure'}">
          ${success
            ? '✓ Success! Collision damage avoided!'
            : '✗ Failed! The ship takes full collision damage.'}
        </p>
      </div>`
    });

    return { roll, success };
  }

  /**
   * Helper to get overdrive DC from speed
   */
  static _getOverdriveDC(speed) {
    const bracket = Math.floor(speed / 100) * 100;
    return OVERDRIVE_DC_TABLE[Math.min(bracket, 900)] ?? 20;
  }
}

/* -------------------------------------------- */
/*  Chat Message Hooks for Damage Buttons       */
/* -------------------------------------------- */

Hooks.on("renderChatMessage", (message, html) => {
  html.find(".spelljammer-damage-roll").click(async (event) => {
    const button = event.currentTarget;
    const formula = button.dataset.formula;
    const damageType = button.dataset.type;
    const weaponName = button.dataset.weapon;

    const roll = await new Roll(formula).evaluate();

    await roll.toMessage({
      speaker: message.speaker,
      flavor: `<div class="spelljammer-chat damage-roll">
        <h3>${weaponName} Damage</h3>
        <p>Damage Type: ${damageType}</p>
      </div>`
    });
  });
});
