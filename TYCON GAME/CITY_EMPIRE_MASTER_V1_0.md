# CITY EMPIRE
## MASTER BUILD DOCUMENT — V1.0

**Project Type:** PC Single-Player Open-World Life & Business Simulation  
**Engine:** Unreal Engine 5.8  
**Primary Development:** C++ + Blueprints  
**Current Mode:** Single Player  
**Future Mode:** Multiplayer-ready architecture, multiplayer implementation deferred  
**Document Status:** MASTER / SOURCE OF TRUTH  
**Version:** 1.0.0

---

# 0. PURPOSE OF THIS DOCUMENT

This document is the primary source of truth for the CITY EMPIRE project.

Claude Code must read this document before making major architectural or gameplay decisions.

The goal is not to create a temporary prototype that will be thrown away.

The goal is to create the foundation of a long-term expandable PC game.

The project will be developed in phases.

The first objective is to create a polished, playable vertical slice.

After the vertical slice is stable, the game will continue receiving updates and new systems.

Future Claude Code sessions must be able to open the existing project, read this document and the progress files, understand the current state, and continue development without starting over.

---

# 1. CORE GAME VISION

CITY EMPIRE is a third-person open-world Single Player game where the player starts with very little and gradually builds an empire inside a living city.

The player should feel that they are actually living inside the city.

The player is not simply selecting options from menus.

They physically:

- Walk through the city
- Drive vehicles
- Visit businesses
- Meet business owners
- Purchase businesses
- Manage businesses
- Earn money
- Spend money
- Use a phone
- Visit the bank
- Customize their home
- Explore new areas
- Build their personal empire

The ultimate fantasy is:

> "I started with almost nothing, built my first business, became successful, expanded throughout the city, and eventually created my own empire."

---

# 2. GAME IDENTITY

CITY EMPIRE should feel like a combination of:

- Open-world exploration
- Life simulation
- Business simulation
- Vehicle gameplay
- Property ownership
- Economic progression
- Personal customization
- Living city simulation

The game should NOT feel like:

- A generic mobile game
- A menu simulator
- A spreadsheet simulator
- A generic GTA clone
- A social-media app
- An MMO
- A casino game

The game must establish its own identity.

---

# 3. DESIGN PHILOSOPHY

## 3.1 WORLD FIRST

Important actions should happen physically inside the world whenever possible.

Bad:

    Open menu
    Select business
    Press BUY
    Business is purchased

Preferred:

    Find business
    Travel to business
    Enter business
    Meet owner
    Talk
    Receive asking price
    Decide whether to purchase
    Complete transaction
    Business becomes owned

Menus should support the world.

They should not replace the world.

---

# 4. CORE GAMEPLAY LOOP

The central gameplay loop is:

    EXPLORE
       ↓
    EARN MONEY
       ↓
    BUY ASSETS
       ↓
    BUILD BUSINESSES
       ↓
    GENERATE INCOME
       ↓
    UPGRADE
       ↓
    UNLOCK NEW OPPORTUNITIES
       ↓
    EXPAND
       ↓
    BUILD EMPIRE

The loop should remain fun even before advanced systems exist.

---

# 5. PLAYER PROGRESSION

The player begins weak.

Early game:

- Low cash
- Basic clothing
- Basic home
- Basic vehicle
- Limited access
- One or few income sources

Mid game:

- Better vehicle
- Multiple businesses
- Improved home
- Better clothing
- Larger income
- More opportunities
- More areas available

Late game:

- Multiple businesses
- Expensive assets
- High-end vehicles
- Premium properties
- Major city presence
- Access to advanced systems
- Large financial reserves

The player should visually and mechanically feel their progression.

---

# 6. PLATFORM

Current target:

## PC ONLY

Target:

- Windows PC
- Keyboard + Mouse
- Gamepad architecture should remain possible

Do NOT optimize the project around mobile.

Do NOT design the primary interface like a mobile game.

PC allows us to prioritize:

- Higher visual quality
- Larger environments
- More complex simulation
- Better UI
- Better animations
- More detailed systems

---

# 7. ENGINE

Primary engine:

## Unreal Engine 5.8

Recommended technologies:

- C++
- Blueprints
- Enhanced Input
- World Partition
- Nanite
- Lumen
- PCG
- UMG / Common UI
- Data Assets
- Data Tables
- SaveGame
- Gameplay Tags where useful
- Unreal AI systems where appropriate

Use C++ for important reusable systems.

Use Blueprints for:

- Content configuration
- Level-specific logic
- Simple interactions
- Designer-friendly tuning
- Visual scripting
- Prototyping

Do not build the entire game exclusively in Blueprint.

---

# 8. ARCHITECTURE PRINCIPLE

The architecture must support long-term development.

Systems should be modular.

Avoid:

- Giant classes
- Duplicate logic
- Hardcoded values
- UI controlling core gameplay
- Random global variables
- Systems that depend directly on unrelated systems

Prefer:

- Interfaces
- Components
- Services
- Data Assets
- Data Tables
- Events
- Modular subsystems
- Clear ownership of state

---

# 9. PROJECT STRUCTURE

Recommended source structure:

    Source/
        CityEmpire/
            Core/
            Player/
            Characters/
            Vehicles/
            Economy/
            Businesses/
            World/
            NPC/
            Traffic/
            Phone/
            UI/
            Inventory/
            Building/
            SaveSystem/
            Interaction/
            Audio/
            AI/
            Police/
            BlackMarket/
            Data/

Recommended content structure:

    Content/
        CityEmpire/
            Maps/
            Characters/
            Vehicles/
            Buildings/
            Businesses/
            UI/
            Audio/
            Materials/
            VFX/
            Data/
            Blueprints/
            Environment/
            NPC/
            AI/

Documentation:

    Docs/
        MASTER.md
        CURRENT_PROGRESS.md
        CHANGELOG.md
        DECISIONS.md
        TODO.md

---

# 10. DOCUMENTATION RULE

The project must maintain documentation while it is being developed.

Create:

## Docs/CURRENT_PROGRESS.md

This file must always contain:

- Current version
- Current phase
- Completed systems
- Current system being developed
- Known bugs
- Known limitations
- Next recommended task
- Important architectural notes
- Files/classes changed

Create:

## Docs/CHANGELOG.md

Track:

- Added
- Changed
- Fixed
- Removed
- Known Issues

Create:

## Docs/DECISIONS.md

Record major architecture/gameplay decisions.

Create:

## Docs/TODO.md

Track:

- Current tasks
- Future tasks
- Deferred systems
- Ideas awaiting approval

---

# 11. WORLD DESIGN

The game begins in a district called:

# EUROPEAN DISTRICT

This is the first playable region.

It should feel like a believable European urban district.

---

# 12. EUROPEAN DISTRICT

The first district should contain:

- Main streets
- Side streets
- Residential buildings
- Commercial buildings
- Cafes
- Shops
- Restaurants
- Parking
- Small public areas
- Street lights
- Signs
- Trees
- Sidewalks
- Traffic
- Pedestrians
- Businesses
- Police station
- Player home
- Roads leading toward future areas

The district should be dense enough to feel alive.

Do NOT build a giant empty map.

---

# 13. WORLD EXPANSION

The European District is only the beginning.

Future world structure:

    EUROPEAN DISTRICT
            |
            +---- DISTRICT 2
            |
            +---- DISTRICT 3
            |
            +---- HIGHWAY
                     |
                     +---- FUTURE CITY
                     |
                     +---- FUTURE REGIONS

Future districts should be physically connected.

The player should be able to travel between them through the world.

Fast travel may be added later.

Fast travel must not replace physical world connectivity.

---

# 14. WORLD PHILOSOPHY

The city should feel like a place rather than a level.

Players should see:

- People going somewhere
- Cars moving
- Businesses operating
- Buildings with different purposes
- Lights changing
- Different activity levels throughout the day

The world should continue to exist when the player is not directly interacting with it.

---

# 15. THIRD-PERSON PLAYER

The player character must support:

- Walking
- Running
- Sprinting
- Jumping
- Camera control
- Interaction
- Entering vehicles
- Exiting vehicles
- Basic animation states
- Clothing
- Appearance customization

Movement must feel responsive.

Camera must feel smooth.

Avoid floaty movement.

---

# 16. INTERACTION SYSTEM

Create ONE reusable interaction framework.

Interaction examples:

- Talk
- Buy
- Enter
- Exit
- Open
- Inspect
- Use
- Pick up
- Sit
- Deposit
- Withdraw
- Manage
- Purchase

Do not create completely separate interaction code for every object.

The system should support:

- Interaction range
- Line of sight where appropriate
- Prompt
- Input
- Conditions
- Feedback
- Animation hooks
- Interaction priority

Example:

    Player looks at object
          ↓
    Interaction detected
          ↓
    Prompt displayed
          ↓
    Player presses input
          ↓
    Interaction executed

---

# 17. CHARACTER

The player needs a customizable character.

V1 customization:

- Basic body
- Face
- Hair
- Clothing
- Shoes
- Accessories

The character must appear in the actual world.

Do not make customization only a menu/avatar system.

---

# 18. CLOTHING SYSTEM

Clothing should be data-driven.

Potential categories:

- Tops
- Pants
- Shoes
- Jackets
- Accessories

Each item can contain:

- ID
- Name
- Category
- Mesh
- Material
- Price
- Rarity
- Unlock requirement

V1 can contain a small number of items.

Future updates can add many more.

---

# 19. VEHICLE SYSTEM

The player must be able to drive.

V1 requires at least:

- One playable vehicle
- Enter
- Exit
- Accelerate
- Brake
- Reverse
- Steering
- Camera
- Basic physics
- Parking
- Vehicle persistence

The vehicle must feel good to control.

---

# 20. FUTURE VEHICLE SYSTEM

Future features may include:

- Multiple vehicle classes
- Vehicle dealerships
- Vehicle purchasing
- Vehicle selling
- Vehicle upgrades
- Performance
- Cosmetics
- Paint
- Wheels
- Interior
- Damage
- Garages
- Rare vehicles

The architecture must support adding vehicles through data/configuration.

---

# 21. NPC SYSTEM

NPCs make the city feel alive.

V1 NPC types:

- Pedestrians
- Drivers
- Business owners
- Employees
- Customers
- Police

Basic behaviors:

- Walking
- Waiting
- Standing
- Entering/exiting selected buildings
- Basic reactions
- Basic schedules
- Navigation

Do not build an advanced human simulation in V1.

Build a scalable foundation.

---

# 22. TRAFFIC SYSTEM

V1:

- Cars spawn on roads
- Cars follow road paths
- Cars stop at basic traffic controls
- Cars avoid obvious collisions
- Cars despawn intelligently
- Density varies by time

Future:

- Emergency vehicles
- Traffic accidents
- Rush hours
- District-specific traffic
- Advanced traffic rules

---

# 23. DAY/NIGHT SYSTEM

Implement:

- Morning
- Day
- Evening
- Night

World behavior can change based on time.

Day:

- More pedestrians
- More traffic
- More businesses open

Night:

- Street lights
- Building lights
- Different atmosphere
- Different traffic density
- Different pedestrian density

Business schedules should be data-driven.

---

# 24. ECONOMY SYSTEM

Money is a core system.

Two primary balances:

## CASH

Money carried by the player.

## BANK

Money stored in the player's bank account.

All financial changes must go through a centralized economy system.

Do NOT allow random systems to directly change money.

---

# 25. TRANSACTION SYSTEM

Every important financial transaction should generate a transaction record.

Example:

    Business Purchase
    - Amount
    - Source
    - Destination
    - Timestamp
    - Description
    - Transaction Type

Transaction types may include:

- Income
- Purchase
- Deposit
- Withdrawal
- Business Revenue
- Business Expense
- Upgrade
- Vehicle Purchase
- Property Purchase

---

# 26. BANK

V1 bank:

- Balance
- Deposit
- Withdraw
- Transaction history

The player can access banking through:

1. Physical bank
2. Phone

Future:

- Loans
- Credit
- Business accounts
- Investments

---

# 27. PHONE

The phone is a central in-game interface.

Open with a dedicated input.

The phone should feel like an actual smartphone.

V1 applications:

- Bank
- Businesses
- Map
- Contacts
- Black Market
- Settings

The phone must use a modular application architecture.

Each application should be independently replaceable/upgradable.

---

# 28. MAP

The map should display:

- Player
- Roads
- Home
- Businesses
- Owned businesses
- Police station
- Important locations
- Points of interest

Future:

- Waypoints
- Navigation
- District unlocking
- Fast travel

The map should never remove the need to explore the world.

---

# 29. BUSINESS SYSTEM

Business ownership is one of the most important game systems.

V1 contains:

# FIVE PURCHASABLE BUSINESSES

Suggested starter businesses:

1. Small Cafe
2. Convenience Store
3. Barbershop
4. Car Wash
5. Small Restaurant

These are examples and may be renamed if needed.

The important requirement:

Five businesses must exist and use ONE reusable business framework.

---

# 30. BUSINESS DATA

Every business should have:

- Business ID
- Name
- Type
- Location
- Purchase price
- Base revenue
- Base expenses
- Profit calculation
- Owner
- Level
- Upgrade data
- Opening hours
- Interior
- Exterior
- NPC references

Use Data Assets/Data Tables.

Do not hardcode all business values in gameplay classes.

---

# 31. BUSINESS PURCHASE FLOW

Business purchase must happen physically.

Example:

    Player sees business
          ↓
    Approaches
          ↓
    "FOR SALE" indicator
          ↓
    Interact
          ↓
    Meet owner
          ↓
    Dialogue
          ↓
    Asking price
          ↓
    Purchase decision
          ↓
    Validate money
          ↓
    Deduct money
          ↓
    Assign ownership
          ↓
    Business becomes player's
          ↓
    Management system unlocked

If player cannot afford it:

    Purchase blocked
    Clear feedback shown

---

# 32. BUSINESS OWNER

Each purchasable business should have an owner NPC.

The owner should support a basic dialogue system.

V1 dialogue:

- Greeting
- Business information
- Asking price
- Purchase
- Cancel
- Insufficient funds response

Future:

- Negotiation
- Seller personality
- Seller motivation
- Dynamic prices
- Reputation

---

# 33. BUSINESS MANAGEMENT

Once a business is owned:

The player can open its management interface.

Display:

## Overview

- Revenue
- Expenses
- Profit
- Status
- Level

## Upgrades

- Current level
- Next level
- Price
- Effect

The business generates income over time.

---

# 34. BUSINESS PROGRESSION

Businesses can have multiple upgrade levels.

Example:

Level 1:
Basic

Level 2:
Improved

Level 3:
Premium

Possible effects:

- Higher revenue
- Lower expenses
- More customers
- Better appearance
- Increased capacity

Keep V1 simple.

---

# 35. BUSINESS WORLD STATE

After purchasing a business:

The world should reflect ownership.

Possible V1 changes:

- Ownership indicator
- Different interaction prompt
- Management access
- Player can enter/manage
- Business remains physically present
- Income continues

Future:

- Visual upgrades
- Employees
- Customer counts
- Deliveries
- Business-specific gameplay

---

# 36. HOME

The player has a basic home/room.

V1:

- Enter
- Exit
- Interior
- Wardrobe
- Basic storage
- Customization

Future:

- Apartments
- Houses
- Luxury homes
- Multiple properties
- Property purchasing

---

# 37. BUILD MODE

V1 Build Mode:

- Select furniture
- Place
- Move
- Rotate
- Delete
- Confirm
- Save

The first version can contain a small furniture catalog.

Architecture should allow additional objects later.

---

# 38. BLACK MARKET

The Black Market is accessible through the phone.

V1:

- Black Market app
- Listings
- Item details
- Price
- Purchase
- Transaction feedback

The Black Market should feel visually different from the normal economy.

It is a fictional gameplay system.

Do not build a complex crime simulation yet.

---

# 39. POLICE

The first district includes a police station.

V1:

- Police station building
- Police NPCs
- Police presence
- Basic police vehicles/NPC foundation if practical
- Ambient behavior

Do NOT build yet:

- Complex wanted system
- Raids
- Courts
- Prison
- Investigations
- Full crime simulation

These are future systems.

---

# 40. UI/UX

The UI should feel:

- Premium
- Modern
- Dark
- Elegant
- Cinematic
- Responsive
- Minimal

Avoid:

- Cheap gradients
- Mobile-game appearance
- Huge buttons
- Excessive neon
- UI clutter
- Generic dashboard designs

The environment should remain the main visual focus.

---

# 41. MAIN MENU

Required:

- Continue
- New Game
- Settings
- Exit

Future:

- Load Game
- Credits
- Extras

---

# 42. HUD

Minimal HUD.

Potential elements:

- Cash
- Time
- Interaction prompt
- Notification
- Objective if necessary
- Vehicle information while driving

Do not fill the screen with information.

---

# 43. AUDIO

V1 audio:

- Footsteps
- UI sounds
- Interaction sounds
- Vehicle engine
- Brakes
- Traffic
- City ambience
- Interior ambience
- Day/night ambience

Audio must be modular.

---

# 44. SAVE SYSTEM

Persistent data must include at minimum:

- Player position
- Player appearance
- Clothing
- Cash
- Bank balance
- Transactions
- Owned businesses
- Business levels
- Business income state
- Owned vehicle
- Vehicle state
- Home customization
- Inventory
- World progression
- District unlock state

---

# 45. SAVE VERSIONING

Save files must have a version.

Example:

    SaveVersion = 1

When future updates change the save format, implement migration logic.

Never create a save architecture that prevents future updates.

---

# 46. SETTINGS

V1:

Graphics:
- Resolution
- Window mode
- Quality preset

Audio:
- Master
- Music
- Effects

Controls:
- Mouse sensitivity

Future:
- Full key rebinding
- Accessibility
- Advanced graphics

---

# 47. DEBUG SYSTEM

Create a development-only debug system.

Useful commands:

- AddMoney
- SetTime
- Teleport
- SpawnVehicle
- UnlockBusiness
- ResetBusiness
- GiveItem
- Save
- Load
- AI Debug
- Economy Debug

These must not be exposed in shipping builds.

---

# 48. DATA-DRIVEN SYSTEMS

Use data assets/tables for:

- Businesses
- Vehicles
- Clothing
- Items
- Upgrades
- Districts
- NPC types
- Business schedules

Example:

    BusinessData
        ID
        Name
        Type
        PurchasePrice
        BaseRevenue
        BaseExpenses
        MaxLevel
        Location
        VisualReferences

This makes future updates easier.

---

# 49. PERFORMANCE

Important principles:

- Avoid unnecessary Tick functions
- Use event-driven logic where possible
- Use World Partition
- Use streaming
- Use LODs
- Use Nanite where appropriate
- Use efficient NPC spawning
- Use efficient traffic
- Avoid excessive AI calculations
- Profile regularly

The game is PC-only, but poor architecture should not be accepted.

---

# 50. DEVELOPMENT PHASES

Development must happen in this order unless there is a strong documented reason to change it.

---

## PHASE 0 — FOUNDATION

Create:

- Unreal project
- Source structure
- Content structure
- Input
- GameMode
- Core systems
- Logging
- Documentation
- Save architecture foundation

Definition of Done:

Project launches successfully.

---

## PHASE 1 — PLAYER

Build:

- Third-person character
- Camera
- Movement
- Sprint
- Jump
- Interaction system
- Basic animations

Definition of Done:

Player can move through a test area and interact with objects.

---

## PHASE 2 — EUROPEAN DISTRICT

Build:

- Main roads
- Side roads
- Buildings
- Commercial area
- Residential area
- Landmarks
- Lighting
- Environment
- Basic ambience

Definition of Done:

Player can freely explore a convincing first district.

---

## PHASE 3 — VEHICLE

Build:

- Vehicle
- Enter
- Exit
- Driving
- Camera
- Parking
- Persistence

Definition of Done:

Player can drive around the district.

---

## PHASE 4 — NPC + TRAFFIC

Build:

- Pedestrians
- Drivers
- Traffic
- Spawning
- Despawning
- Basic schedules
- Basic AI

Definition of Done:

The district feels alive.

---

## PHASE 5 — ECONOMY

Build:

- Cash
- Bank
- Transactions
- Economy service
- Validation
- Persistence

Definition of Done:

Money works reliably.

---

## PHASE 6 — PHONE

Build:

- Phone UI
- App architecture
- Bank app
- Map app
- Business app
- Black Market app
- Settings

Definition of Done:

Phone works as an extensible in-game system.

---

## PHASE 7 — BUSINESSES

Build:

- Business data
- Five businesses
- Owner NPCs
- Dialogue
- Purchase flow
- Ownership
- Income
- Management
- Upgrades

Definition of Done:

Player can purchase and manage businesses.

---

## PHASE 8 — HOME + BUILD

Build:

- Home
- Interior
- Wardrobe
- Furniture
- Placement
- Save/load

Definition of Done:

Player can customize and save their home.

---

## PHASE 9 — BLACK MARKET + POLICE

Build:

- Black Market
- Listings
- Purchase
- Police station
- Police presence

Definition of Done:

Both systems exist as stable foundations.

---

## PHASE 10 — POLISH

Build:

- UI polish
- Animation polish
- Audio
- VFX
- Lighting
- Camera
- Interaction feedback
- Performance

Definition of Done:

The vertical slice feels like a real game.

---

# 51. FIRST PLAYABLE EXPERIENCE

The first successful playable flow should be:

    START GAME
       ↓
    CHARACTER
       ↓
    EUROPEAN DISTRICT
       ↓
    EXPLORE
       ↓
    FIND VEHICLE
       ↓
    DRIVE
       ↓
    EXPLORE
       ↓
    FIND BUSINESS
       ↓
    TALK TO OWNER
       ↓
    PURCHASE BUSINESS
       ↓
    OPEN PHONE
       ↓
    CHECK BANK
       ↓
    CHECK BUSINESS
       ↓
    BUSINESS GENERATES INCOME
       ↓
    RETURN HOME
       ↓
    CUSTOMIZE HOME
       ↓
    SAVE
       ↓
    QUIT
       ↓
    LOAD
       ↓
    VERIFY PROGRESS

If this works, the foundation is successful.

---

# 52. TUTORIAL DESIGN

Do not create a giant tutorial.

Teach through the world.

Example:

Player sees vehicle:

    "Press E to enter"

Player opens phone:

    Phone explains its basic controls.

Player enters bank:

    Bank interface explains itself.

Player approaches business:

    "Business for Sale"

The player should learn naturally.

---

# 53. ERROR HANDLING

Every important action must provide feedback.

Examples:

Insufficient money:

    "You don't have enough money."

Successful purchase:

    "Business acquired."

Failed interaction:

    "Unavailable."

Save error:

    "Unable to save game."

Do not allow silent failures.

---

# 54. TESTING REQUIREMENTS

After every major system:

1. Compile.
2. Launch.
3. Test normal behavior.
4. Test invalid behavior.
5. Test save/load.
6. Restart game.
7. Test persistence.
8. Check logs.
9. Fix errors.
10. Update documentation.

Never build many untested systems and hope they work together.

---

# 55. DEFINITION OF DONE

A feature is NOT complete simply because code exists.

A feature is complete when:

- It compiles.
- It launches.
- It is integrated.
- It can be used in-game.
- It gives feedback.
- It saves correctly when persistent.
- It does not break existing systems.
- It has been tested.
- It is documented.

---

# 56. FUTURE MULTIPLAYER

Multiplayer is NOT part of V1.

However, avoid architecture that makes multiplayer impossible.

Separate:

- Player state
- World state
- Business state
- Economy state
- UI
- Persistent state

Do not put important gameplay logic exclusively inside UI.

Do not implement networking now unless explicitly requested.

The goal is:

    Single Player first
    Multiplayer later

---

# 57. FUTURE CONTENT

Possible future updates:

- More businesses
- More vehicles
- More clothing
- More properties
- More districts
- New cities
- Advanced police
- Missions
- Reputation
- Investments
- More Black Market content
- Advanced business systems
- Multiplayer

These are future scope.

Do not build them now unless specifically requested.

---

# 58. UPDATE PHILOSOPHY

CITY EMPIRE is intended to grow over time.

Every future update should be treated as an addition to an existing game.

Do NOT rebuild the entire project.

When adding a feature:

1. Inspect existing architecture.
2. Identify affected systems.
3. Reuse existing systems.
4. Add the smallest clean extension.
5. Test existing systems.
6. Test the new feature.
7. Update documentation.
8. Update changelog.

---

# 59. FUTURE CLAUDE SESSION WORKFLOW

When the user returns in a future Claude Code session:

First read:

    /Docs/MASTER.md
    /Docs/CURRENT_PROGRESS.md
    /Docs/CHANGELOG.md
    /Docs/DECISIONS.md
    /Docs/TODO.md

Then inspect the actual project.

Never trust documentation blindly.

Documentation describes intended/current state.

The codebase is the actual implementation.

Compare both.

---

# 60. IF THE USER REQUESTS A NEW FEATURE

Example:

    "Add a dealership."

Claude should:

1. Read MASTER.
2. Read CURRENT_PROGRESS.
3. Inspect existing vehicle system.
4. Inspect economy system.
5. Inspect interaction system.
6. Design the feature around existing architecture.
7. Implement.
8. Test.
9. Fix.
10. Update documentation.
11. Report exactly what changed.

Do not rewrite unrelated systems.

---

# 61. IF A REQUIREMENT IS AMBIGUOUS

Use this priority:

1. Explicit user instruction
2. This MASTER document
3. Existing architecture
4. Existing design decisions
5. Simplest implementation that preserves the intended experience

If the ambiguity would materially change the game's direction, stop and ask the user.

Otherwise choose a reasonable implementation and document the decision.

---

# 62. DO NOT OVERBUILD

If a feature is too large for V1:

Build a small real version.

Examples:

Do not create:

    100 businesses

Create:

    5 businesses

Do not create:

    100 vehicles

Create:

    1–3 good vehicles

Do not create:

    10 districts

Create:

    1 high-quality district

Do not create:

    Multiplayer

Create:

    Strong Single Player architecture

Quality > quantity.

---

# 63. VISUAL QUALITY BAR

Target:

- Realistic materials
- Detailed environments
- High quality lighting
- Cinematic atmosphere
- Good animation
- Responsive movement
- Premium UI
- Strong sound
- Believable city layout
- Consistent art direction

Do not chase visual complexity before gameplay works.

---

# 64. GAME FEEL

The player should feel:

Beginning:

    "I have almost nothing."

After first vehicle:

    "I'm starting to build my life."

After first business:

    "I own something."

After multiple businesses:

    "I'm becoming powerful."

Later:

    "This city is becoming my empire."

This emotional progression is a core design requirement.

---

# 65. FIRST DEVELOPMENT TARGET

The FIRST objective is NOT:

"Build the entire game."

The FIRST objective is:

"Build a polished vertical slice proving that the core fantasy works."

The vertical slice must contain:

- Player
- World
- Vehicle
- Economy
- Phone
- Businesses
- Home
- Basic Build Mode
- NPCs
- Traffic
- Day/Night
- Save/Load

---

# 66. CURRENT VERSION PLAN

Version:

## 0.1.0 — FOUNDATION

Target:

- Project launches
- Player works
- Basic world exists
- Basic interaction exists
- Documentation exists
- Save architecture exists

---

## 0.2.0 — WORLD + PLAYER

Target:

- European District
- Player
- NPCs
- Day/Night
- Basic traffic

---

## 0.3.0 — VEHICLES

Target:

- Drivable vehicle
- Enter/exit
- Vehicle persistence

---

## 0.4.0 — ECONOMY

Target:

- Cash
- Bank
- Transactions
- Save integration

---

## 0.5.0 — BUSINESSES

Target:

- Five businesses
- Owners
- Dialogue
- Purchase
- Income
- Management

---

## 0.6.0 — PHONE

Target:

- Phone
- Bank
- Map
- Businesses
- Black Market
- Settings

---

## 0.7.0 — HOME

Target:

- Home
- Wardrobe
- Build Mode
- Furniture
- Save

---

## 0.8.0 — WORLD POLISH

Target:

- Lighting
- Audio
- VFX
- Animations
- Environment detail

---

## 0.9.0 — VERTICAL SLICE

Target:

All core systems work together.

---

## 1.0.0 — FIRST COMPLETE PLAYABLE BUILD

Target:

A stable, polished, playable first release of the core CITY EMPIRE experience.

---

# 67. DEVELOPMENT LOGGING

Important systems should produce useful development logs.

Examples:

    [Economy]
    Player purchased Business_001 for 50000.

    [Business]
    Business_001 ownership changed to Player.

    [Save]
    Save completed successfully.

    [Vehicle]
    Player entered Vehicle_001.

Logs should help diagnose problems.

Do not spam logs every frame.

---

# 68. SECURITY / DATA INTEGRITY

Even in Single Player:

- Validate transactions
- Validate purchases
- Prevent negative balances unless explicitly supported
- Validate save data
- Avoid duplicate ownership
- Avoid duplicate transactions
- Validate item ownership

Future multiplayer will depend on strong state integrity.

---

# 69. CODE QUALITY

Code should be:

- Readable
- Modular
- Documented where useful
- Consistent
- Maintainable

Avoid:

- Copy-paste systems
- Giant functions
- Magic numbers
- Hardcoded game values
- Unclear dependencies
- Dead code
- Temporary hacks left undocumented

If a temporary workaround is necessary, document it in:

    Docs/DECISIONS.md

or:

    Docs/TODO.md

---

# 70. MASTER RULE

This document is the project's source of truth.

However:

If the user explicitly changes a game rule later, the new user decision supersedes this document.

When that happens:

1. Update MASTER.md.
2. Record the decision in DECISIONS.md.
3. Update CHANGELOG.md.
4. Update CURRENT_PROGRESS.md if relevant.
5. Modify implementation.

Never keep obsolete rules active just because they existed in an old version of the document.

---

# 71. FINAL CLAUDE INSTRUCTION

You are building CITY EMPIRE as a long-term project.

Do not treat this as a one-message coding task.

Do not attempt to fake completion.

Do not simply create empty placeholders and declare systems complete.

Build working systems incrementally.

After every major phase:

- Compile
- Test
- Fix
- Document
- Continue

The first goal is a polished vertical slice.

The second goal is stability.

The third goal is expansion.

The fourth goal is long-term maintainability.

The final vision is a large, living city where the player can gradually build a personal empire.

---

# 72. START NOW

When this MASTER document is provided to Claude Code:

## STEP 1

Read the entire document.

## STEP 2

Inspect the current project directory.

## STEP 3

Determine whether an Unreal Engine project already exists.

## STEP 4

Do not delete existing useful work without first inspecting it.

## STEP 5

Create/update:

    Docs/MASTER.md
    Docs/CURRENT_PROGRESS.md
    Docs/CHANGELOG.md
    Docs/DECISIONS.md
    Docs/TODO.md

## STEP 6

Establish the project architecture.

## STEP 7

Begin PHASE 0.

## STEP 8

Build the foundation.

## STEP 9

Test it.

## STEP 10

Continue through the roadmap one phase at a time.

Do not skip directly to advanced features.

---

# 73. FINAL SUCCESS TEST

The first complete vertical slice should allow the player to:

    Launch the game
        ↓
    Start a new game
        ↓
    Enter European District
        ↓
    Walk around
        ↓
    Interact with the world
        ↓
    Enter a vehicle
        ↓
    Drive around
        ↓
    Find a business
        ↓
    Talk to its owner
        ↓
    Purchase the business
        ↓
    See ownership reflected in the world
        ↓
    Open the phone
        ↓
    Check bank balance
        ↓
    Check business income
        ↓
    Return home
        ↓
    Customize home
        ↓
    Save
        ↓
    Quit
        ↓
    Reload
        ↓
    Verify everything remains

If this complete loop works reliably, CITY EMPIRE has its first true foundation.

---

# CITY EMPIRE

## BUILD THE WORLD.
## BUILD THE BUSINESS.
## BUILD THE EMPIRE.

END OF MASTER DOCUMENT
