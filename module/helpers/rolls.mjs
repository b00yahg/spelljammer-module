/**
 * Spelljammer Rolls Helper
 * Handles all dice rolling for ship combat
 */

const MODULE_ID = "spelljammer-module";

export class SpelljammerRolls {

  /**
   * Roll initiative for the ship (Captain's CHA + Prof)
   */
  static async rollInitiative(ship, captain) {
    const bonus = captain
      ? (captain.system.abilities.cha?.mod ?? 0) + (captain.system.attributes.prof ?? 2)
      : 0;

    const roll = await new Roll(`1d20 + ${bonus}`).evaluate();

    const content = `
      <div class="spelljammer-chat spelljammer-roll">
        <h3>Ship Initiative</h3>
        <p><strong>Ship:</strong> ${ship.name}</p>
        ${captain ? `<p><strong>Captain:</strong> ${captain.name}</p>` : `<p class="warning">No Captain assigned!</p>`}
        <p><strong>Bonus:</strong> ${bonus >= 0 ? "+" : ""}${bonus} (CHA + Prof)</p>
      </div>
    `;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: ship }),
      flavor: content
    });

    // Add to combat if active
    if (game.combat && ship.token) {
      const combatant = game.combat.combatants.find(c => c.actorId === ship.id);
      if (combatant) {
        await game.combat.setInitiative(combatant.id, roll.total);
      }
    }

    return roll;
  }

  /**
   * Roll a vehicle check (Ability + Prof for Vehicles)
   */
  static async rollVehicleCheck(ship, crewMember, checkType, ability = "wis") {
    const abilityMod = crewMember
      ? (crewMember.system.abilities[ability]?.mod ?? 0)
      : 0;
    const prof = crewMember?.system.attributes.prof ?? 0;
    const bonus = abilityMod + prof;

    // Determine DC based on check type and current velocity
    let dc = 0;
    let dcInfo = "";
    const velocity = ship.getFlag(MODULE_ID, "velocity");

    if (checkType === "overdrive" || checkType === "brake") {
      const speed = velocity?.current ?? 0;
      if (speed <= 100) dc = 0;
      else if (speed <= 300) dc = 5;
      else if (speed <= 500) dc = 10;
      else if (speed <= 700) dc = 15;
      else dc = 20;
      dcInfo = `<p><strong>DC:</strong> ${dc} (based on ${speed} ft speed)</p>`;
    }

    const roll = await new Roll(`1d20 + ${bonus}`).evaluate();

    const checkNames = {
      overdrive: "Overdrive",
      brake: "Emergency Brake",
      evade: "Evade Maneuver",
      grapple: "Grappling Ropes",
      graze: "Grazing Collision"
    };

    const abilityNames = {
      str: "STR",
      dex: "DEX",
      con: "CON",
      int: "INT",
      wis: "WIS",
      cha: "CHA"
    };

    const success = dc > 0 ? roll.total >= dc : null;
    const successText = success === null ? "" :
      success ? '<span class="success">SUCCESS</span>' : '<span class="failure">FAILURE</span>';

    const content = `
      <div class="spelljammer-chat spelljammer-roll">
        <h3>${checkNames[checkType] || "Vehicle Check"}</h3>
        <p><strong>Ship:</strong> ${ship.name}</p>
        ${crewMember ? `<p><strong>Crew:</strong> ${crewMember.name}</p>` : `<p class="warning">No crew assigned!</p>`}
        <p><strong>Bonus:</strong> ${bonus >= 0 ? "+" : ""}${bonus} (${abilityNames[ability]} + Prof)</p>
        ${dcInfo}
        ${successText ? `<p><strong>Result:</strong> ${successText}</p>` : ""}
      </div>
    `;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: ship }),
      flavor: content
    });

    // Handle failure effects
    if (success === false) {
      if (checkType === "overdrive") {
        // Disable overdrive for next turn
        const combat = foundry.utils.deepClone(ship.getFlag(MODULE_ID, "combat") || {});
        combat.overdriveDisabled = true;
        await ship.setFlag(MODULE_ID, "combat", combat);

        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: ship }),
          content: `<div class="spelljammer-chat warning">Overdrive Failed! Acceleration reduced to 0 next turn as the helm recovers.</div>`
        });
      } else if (checkType === "brake") {
        // Take damage
        const damageRoll = await new Roll("2d6").evaluate();
        await damageRoll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: ship }),
          flavor: `<div class="spelljammer-chat">Emergency Brake Failure - Force Damage to Ship!</div>`
        });
      }
    }

    return roll;
  }

  /**
   * Roll a weapon attack (Gunner's DEX + Prof)
   */
  static async rollWeaponAttack(ship, weapon, gunner, weaponsArrayActive = false) {
    const dexMod = gunner?.system.abilities.dex?.mod ?? 0;
    const prof = gunner?.system.attributes.prof ?? 2;
    const bonus = dexMod + prof;

    const roll = await new Roll(`1d20 + ${bonus}`).evaluate();

    const content = `
      <div class="spelljammer-chat spelljammer-roll">
        <h3>Ship Weapon Attack</h3>
        <p><strong>Weapon:</strong> ${weapon.name}</p>
        <p><strong>Ship:</strong> ${ship.name}</p>
        ${gunner ? `<p><strong>Gunner:</strong> ${gunner.name}</p>` : `<p class="warning">No Gunner assigned!</p>`}
        <p><strong>Attack Bonus:</strong> ${bonus >= 0 ? "+" : ""}${bonus} (DEX + Prof)</p>
        <p><strong>Range:</strong> ${weapon.range.normal}/${weapon.range.long} ft</p>
        <p><strong>Firing Arc:</strong> ${weapon.firingArc}° (${weapon.position})</p>
        ${weaponsArrayActive ? `<p class="powered">Weapons Array Active!</p>` : ""}
        <button class="roll-damage" data-weapon-id="${weapon.id}">Roll Damage</button>
      </div>
    `;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: ship }),
      flavor: content
    });

    return roll;
  }

  /**
   * Roll weapon damage (Weapon dice + DEX mod + Weapons Array)
   */
  static async rollWeaponDamage(ship, weapon, gunner, weaponsArrayActive = false) {
    const dexMod = gunner?.system.abilities.dex?.mod ?? 0;

    let formula = weapon.damage;
    if (dexMod !== 0) {
      formula += ` + ${dexMod}`;
    }
    if (weaponsArrayActive) {
      formula += " + 1d6";
    }

    const roll = await new Roll(formula).evaluate();

    const content = `
      <div class="spelljammer-chat spelljammer-roll">
        <h3>Weapon Damage</h3>
        <p><strong>Weapon:</strong> ${weapon.name}</p>
        <p><strong>Damage:</strong> ${weapon.damage} ${weapon.damageType}</p>
        ${gunner ? `<p><strong>DEX Bonus:</strong> +${dexMod}</p>` : ""}
        ${weaponsArrayActive ? `<p class="powered">Weapons Array: +1d6</p>` : ""}
      </div>
    `;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: ship }),
      flavor: content,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL
    });

    return roll;
  }

  /**
   * Roll collision damage based on ship size
   */
  static async rollCollisionDamage(ship) {
    const shipClass = ship.getFlag(MODULE_ID, "shipClass") || "Frigate (2x2)";

    // Determine damage dice based on ship size
    let damageDice = "2d10"; // Default for Sloop (1x1)

    if (shipClass.includes("0.5x0.5") || shipClass.includes("Fighter")) {
      damageDice = "1d10";
    } else if (shipClass.includes("1x1") || shipClass.includes("Sloop") || shipClass.includes("Schooner")) {
      damageDice = "2d10";
    } else if (shipClass.includes("2x2") || shipClass.includes("Frigate")) {
      damageDice = "3d10";
    } else if (shipClass.includes("3x3") || shipClass.includes("Heavy")) {
      damageDice = "4d10";
    } else if (shipClass.includes("4x4") || shipClass.includes("Line")) {
      damageDice = "5d10";
    }

    const roll = await new Roll(damageDice).evaluate();

    const content = `
      <div class="spelljammer-chat spelljammer-roll collision">
        <h3>Collision!</h3>
        <p><strong>Ship:</strong> ${ship.name}</p>
        <p><strong>Ship Class:</strong> ${shipClass}</p>
        <p><strong>Damage:</strong> ${damageDice} bludgeoning</p>
        <p class="warning">Both vessels take this damage!</p>
      </div>
    `;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: ship }),
      flavor: content
    });

    return roll;
  }

  /**
   * Roll temporary HP for Hull Reinforcement
   */
  static async rollHullReinforcement(ship) {
    const roll = await new Roll("2d8").evaluate();

    const content = `
      <div class="spelljammer-chat spelljammer-roll">
        <h3>Hull Reinforcement</h3>
        <p><strong>Ship:</strong> ${ship.name}</p>
        <p>Ship gains temporary hit points!</p>
      </div>
    `;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: ship }),
      flavor: content
    });

    return roll;
  }

  /**
   * Roll Arcane Overclock bonus power charges
   */
  static async rollArcaneOverclock(ship, boatswain, spellLevel) {
    const content = `
      <div class="spelljammer-chat spelljammer-roll">
        <h3>Arcane Overclock</h3>
        <p><strong>Boatswain:</strong> ${boatswain?.name || "Unknown"}</p>
        <p><strong>Spell Slot:</strong> ${spellLevel}${this._getOrdinalSuffix(spellLevel)} level</p>
        <p><strong>Bonus Power Charges:</strong> +${spellLevel}</p>
      </div>
    `;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: ship }),
      content
    });

    return spellLevel;
  }

  /**
   * Get ordinal suffix for numbers
   */
  static _getOrdinalSuffix(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }
}
