## Table of Contents

- [Introduction to Ship Combat](# introduction-to-ship-combat)
	- [Ship Attributes](#ship-attributes)
	- [Initiative and Turn Order](#initiative-and-turn-order)
- [Crew Positions](#crew-positions)
    - [Captain](#captain)
    - [Helmsman](#helmsman)
    - [Gunner](#gunner)
    - [Boatswain](#boatswain)
- [Out of Combat Rules](#out of combat rules)

# Introduction to Ship Combat

Combat in the vastness of The Phlogiston follows special rules that reflect the unique nature of spelljamming vessels. Just as a party of adventurers relies on the specialized skills of each member, a spelljamming vessel depends on its crew to function effectively in the heat of battle.

> [!important] Crew Positions 
> During ship combat, players may take on the roles of **[Captain](#captain)**, **[Helmsman](#helmsman)**, **[Gunner](#gunner)**, or **[Boatswain](#boatswain)**, each with their own set of actions and responsibilities. Players may disconnect from their crew roles at any time to act as their normal characters, though personal weapons and spells cannot directly target ships.
# Ship Attributes
Each spelljamming vessel possesses attributes similar to creatures in the standard rules:

- **Armor Class (AC)**: The difficulty of landing a damaging blow on the ship
- **Hull Points (HP)**: The vessel's structural integrity, functioning like hit points
- **Module HP**: Each weapon and module aboard the ship has 10 HP of its own
- **Size**: Ships come in various sizes (see [Ship Sizes](#ship-sizes-and-cargo-capacity) table)
- **Speed Attributes**: Base speed, maximum acceleration/deceleration, and turning capability

> [!danger] Destroying a Ship
> When a ship's [Hull Points](#ship-attributes) reaches 0, it ceases to operate until it regains at least 1 hull point. During this time, the ship cannot move and can be automatically grappled by another ship. 
## Initiative and Turn Order

(Figure out how the heck I want to handle this)

# Crew Positions
## Captain
The Captain commands the vessel and coordinates the crew's efforts, serving as the tactical leader during ship combat.
### Captain's Features
The Captain rolls initiative for the ship. They control communications aboard the vessel, enabling crew members to communicate regardless of their position on the ship. The player controlling the Captain can mute and unmute the Discord call at will (something Im sure will only be used responsibly)

The Captain can "hail" another ship, effectively casting the _sending_ spell at will to communicate with another vessel's Captain. When the Captain attempts to hail another vessel, the Captain of the receiving ship must willingly accept the communication. If they choose not to accept the hail or if no Captain is present, the sending Captain receives only static in return.

At the beginning of combat, the Captain may issue one command that empowers another crew member. These commands include:

- Allowing a Gunner to make an additional weapon attack
- Enabling the Boatswain to allocate one additional power
- Allow the helsman to overdrive or emergancy break without a DC check.
### Special Actions
**Grappling Ropes.** When your ship is within five feet of another vessel, you can use an action to make a Charisma (Vehicles) check contested by the opposing ship's Captain. If the opposing ship has no Captain, the DC is 10. On a success, both ships become grappled together, preventing movement unless both vessels move as one.

**To Me, Ocean Court.** As an action, you can call for a boarding or defense party. Any crew members who have not yet taken their turn are instantly teleported to your position. Player characters who join this party are no longer in their bridge crew role but can instead use their normal turn to defend against boarders or to board another ship.

## Helmsman
The Helmsman controls the ship's movement through The Phlogiston, maneuvering the vessel to optimal firing positions or away from danger.
### Helmsman's Features
On the Helmsman's turn, they control the vessel's movement in the following ways:
- **Accelerate** in any direction within the ship's maximum acceleration limits
- **Decelerate** to reduce the ship's current velocity within its limits
- **Navigate** through the vast expanse by combining these vectors of force
Each vessel has specific movement attributes defined in its stat block:
- **Starting Base Velocity**: The current speed and direction of the ship at the beginning of combat
- **Maximum Acceleration**: How much directional force can be applied in a single turn
- **Maximum Deceleration**: How much the current velocity can be reduced in a single turn
- **Emergency Capabilities**: Enhanced acceleration or deceleration at the risk of system damage
### Ship Movement
The Helmsman navigates through the Phlogiston using a vector-based movement system on a grid where each square represents 100 feet.
#### Core Movement Principles
- Ships always have a **Current Velocity** (speed and direction)
- Helmsmen can apply **Acceleration** in any direction
- Movement follows a combined vector path but snaps to the grid
- Ships always face one of eight directions: N, NE, E, SE, S, SW, W, NW
#### How Movement Works
1. **Starting Position**: At the beginning of your turn, note your current velocity and direction
2. **Acceleration**: Choose a direction to accelerate (up to your maximum acceleration)
3. **Calculate Path**: Combine your current velocity vector with your acceleration vector
4. **Move Ship**: Follow the resulting path along the grid (diagonal movement costs 1 square)
5. **Update Facing**: Your ship now faces the direction closest to your resultant vector
6. **New Velocity**: Your new speed and direction become your velocity for the next turn

> [!example] Ship Movement Example
> **Turn 0:** A ship begins combat with a velocity of 500 ft/round East (5 grid squares).
> 
> **Turn 1:** The Helmsman decides to accelerate 200 ft/round South.
> - Current velocity: 500 ft/round East (green bar)
> - Applied acceleration: 200 ft/round South (blue line)
> - Actual grid movement: The ship moves 4 grid squares (400 ft) Southeast along the black line path
> - At the end of the turn, the ship is now facing Southeast with a velocity of 400 ft/round
> 
> **Turn 2:** The Helmsman accelerates 100 ft/round more to the South.
> - Current velocity: 400 ft/round Southeast
> - Applied acceleration: 100 ft/round South
> - The combined vectors (Southeast + South) now have a stronger southward component
> - The ship's new direction "rounds" to South, as the southward component now dominates
> - Actual grid movement: The ship moves 3 grid squares (300 ft) South
> - At the end of the turn, the ship is now facing South with a velocity of 300 ft/round
> 


> [!warning] Collisions and Grazing
> **Direct Collisions:** When a ship directly impacts an object or another ship, both vessels take bludgeoning damage based on ship size:
> - Sloops (1×1): 2d10 damage
> - Frigates (2×2): 3d10 damage
> - Heavy Frigates (3×3): 4d10 damage
> 
> **Grazing Impacts:** If a ship merely clips or grazes an object (hitting only the corner of its space), the Helmsman may attempt a Wisdom (Vehicle) check with a DC based on current speed. On a success, the collision damage is avoided completely.
### Special Actions
**Overdrive.** The Helmsman pushes the spelljamming helm beyond its normal limits, tripling the ship's maximum acceleration. When this happens, the Helmsman must succeed on a Wisdom (Vehicle) check with a DC determined by the ship's current speed:

| Current Speed |  DC |
| ------------- | --: |
| 0-100 ft      |   0 |
| 200-300 ft    |   5 |
| 400-500 ft    |  10 |
| 600-700 ft    |  15 |
| 800-900 ft    |  20 |

On a failure, the acceleration still occurs, but at the start of the Helmsman's next turn, the ship's acceleration capability is reduced to zero for that turn as the helm recovers from the strain.

**Emergency Brake.** By reversing the arcane flow through the helm, the Helmsman can bring the vessel to a rapid halt, tripling the normal deceleration limit. When this happens, the Helmsman must succeed on a Wisdom (Vehicle) check using the same DC table as Overdrive. On a failure, the deceleration still occurs, but the sudden strain inflicts 2d6 force damage to the ship as the magical energies feedback through the helm.

**Maneuver - Evade (1st-level).** As a reaction, by expending a 1st-level spell slot, the Helmsman can channel magical energy to enhance the ship's defensive capabilities. Until the start of the Helmsman's next turn, players can add their proficiency bonus to either:
- The ship's AC against incoming attacks, OR
- Any Wisdom (Vehicle) checks made to avoid grazing collisions
This bonus increases by 2 for each level the spell is upcast above 1st level.

**Maneuver - Jamming (3rd-level).** By expending a 3rd-level spell slot, the Helmsman attunes their vessel's magical signature to match another ship within 5 feet. For the next minute, the ship is able to match the speed, acceleration, and deceleration of the target vessel without needing to worry about overdriving or emergency brakes.
## Gunner
The Gunner operates the ship's weapon systems, targeting enemy vessels or upcoming obstacles. 
### Gunner's Features
When a Gunner fires ship weapons, the weapon is considered a heavy, loading, two-handed weapon with which they are proficient. This means the Gunner adds their Dexterity modifier plus proficiency bonus to both attack and damage rolls. Any spells, class features, or magical items that affect ranged weapon attacks also apply to the Gunner's attacks with ship weapons.

$$\text{Attack Roll} = \text{d}20 + \text{DEX modifier} + \text{Proficiency Bonus} + \text{Other Bonuses}$$

Ship weapons can only target other spelljammers and creatures or objects of Gargantuan size or larger. Each weapon has a specific firing arc that limits its targeting options:

- **Broadside weapons**: 90-degree firing arc, allowing them to target a wide area to port or starboard
- **Bow and Stern weapons**: 45-degree firing arc, focusing their effectiveness directly ahead or behind the vessel

> [!info] Special Properties 
> Ship weapons may have special properties that affect their operation:
> 
> **Utilize**: Once fired, the weapon requires another action to charge before it can be fired again. This typically applies to particularly powerful weapons with devastating effects.
> 
> **Automatic**: When you make an attack with this ship weapon on your turn against a target in your normal range, you can choose to instead make two attacks at disadvantage.
> 
> **Crew-Operated**: Making an attack with this ship weapon requires two crew members. Only one needs to be a Gunner with the appropriate proficiency.
### Special Actions

**Switch Weapons.** As a bonus action, the Gunner can switch between different weapon systems, allowing them to adapt to changing battle conditions.

**Trigger on the Pulse.** The Gunner can ready a ship weapon attack, similar to the Ready action in standard combat. This allows them to fire at a specific trigger.

## Boatswain
The Boatswain manages the ship's power systems through a complex network of arcane rigging, allocating energy to various ship functions and modules as needed.
### Boatswain's Features
Each turn, the Boatswain has a number of power charges equal to their proficiency bonus to allocate among the ship's systems. 

The Boatswain can assign power charges to the following modules:

| Module             | Cost      | Effect                                                                                                |
| ------------------ | --------- | ----------------------------------------------------------------------------------------------------- |
| Weapons Array      | 1 charge  | +1d6 damage to all weapon attacks until the start of your next turn                                   |
| Deflector Grid     | 1 charge  | Ship gains resistance to one damage type until the start of your next turn                            |
| Thruster Override  | 1 charge  | +100 feet to the ship's maximum acceleration or deceleration this turn                                |
| Hull Reinforcement | 1 charge  | Ship gains 2d8 temporary hit points                                                                   |
| System Restoration | 1 charge  | If a weapon system or module has dropped to zero hit points, restore it to functioning at 1 hit point |
| Warp Core Charge   | 2 charges | After 3 consecutive turns of charging, can initiate warp jump to escape combat                        |

> [!tip] Module Upgrades 
> As you acquire advanced modules for your Spelljammer from _Spamazon_, these upgrades will be added to your ship's systems. Each new module becomes available in the Boatswain's power allocation options. 
> 
> For instance, purchasing a Chameleon Orb (which renders your ship invisible) would add this capability to your power module options. The Boatswain can then choose to allocate power charges to this module when tactically advantageous. 

### Special Actions
**Arcane Overclock.** As an action, the Boatswain can expend a spell slot to gain additional power charges equal to the spell slot level for this turn only. 

**Emergency Hotfix.** When the ship drops below half its hull points, the Boatswain can use their reaction to immediately reallocate 1 power charge.

# Out of Combat Rules

## Crew Requirements and Costs
Spelljamming vessels require crews to maintain the complex magical systems that keep the ship functioning. The costs listed below include everything the crew requires, including income, food, and water:

|Crew Type|Cost per Day|Cost per Month|Stat Block|
|---|---|---|---|
|Green Crew|1.5 gp|45 gp|Bandit (CR 1/8)|
|Mercenaries|3 gp|90 gp|Soldier (CR 1/2)|
|Veteran Crew|5 gp|150 gp|Thug (CR 1/2) or Guard Captain (CR 2)|
|Giff Mercenaries|6.5 gp|195 gp|Giff Shipmate (CR 3)|
|Hurwaeti Mercenaries|8 gp|240 gp|Lizardfolk Sovereign (CR 4)|

### Air Supply
Each spelljamming vessel maintains a bubble of breathable air around it. "Days of Air" on the ship stat block represents how long this bubble can sustain the crew before becoming stale and eventually unbreathable.

$$\text{Effective Air Supply (days)} = \frac{\text{Ship's Total Air Days}}{\text{Number of Creatures Aboard}}$$

When the air supply is fully expended, the air becomes fouled. All creatures within the air bubble gain the poisoned condition while breathing this fouled air. The fouled air lasts for the same duration as the fresh air did.

If the fouled air is also completely expended, the air becomes lethal. All creatures aboard gain one level of exhaustion for every minute they breathe this lethal air.

A ship's air bubble completely refreshes when the vessel lands on a planet with a breathable atmosphere or docks at a jamstop equipped with air recharging facilities.

When creatures venture outside the air bubble, they carry a pocket of air that lasts for 1 minute. Characters can hold their breath for a number of minutes equal to their Constitution modifier (minimum 30 seconds) if this pocket is depleted.
## Ship Sizes and Cargo Capacity
Spelljamming vessels come in various sizes, each with different crew requirements and cargo capacities:

| Size Catagory    | Grid Dimensions |
| ---------------- | --------------- |
| Fighter          | 0.5 × 0.5       |
| Schooner         | 1 × 1           |
| Sloop            | 1 × 1           |
| Frigate          | 2 × 2           |
| Heavy Frigate    | 3 × 3           |
| Ship of the Line | 4 × 4           |

The cargo hold can be used for trade goods, treasure, or sheltering passengers. Larger vessels naturally have greater cargo capacity, making them valuable for merchants plying the trade routes through The Phlogiston between crystal spheres.