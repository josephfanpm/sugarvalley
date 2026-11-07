# Sugar Valley: Product Requirements

Status: MVP (Forest hamlet and town) built; not yet playtested with outside users.
Back to the [README](../README.md) for problem, users, decisions and metrics. Detailed system specs live in
[design/gdd/](../design/gdd/). This doc pulls the must-hold behavior into testable stories.

## Goals

1. Make in-range time feel rewarding through a world that visibly grows from real CGM data.
2. Give friends and family a warm, low-effort way to check in.
3. Never make a hard day worse: no punishment, no pressure toward risky behavior, safety always wins.

## Non-goals

- Not a medical device: no alerts, no dosing or treatment advice.
- No combat, ads, pay-to-win or energy timers outside real data.
- No accounts for visitors.

## Default thresholds

Urgent low < 55, low < 70, high > 180, urgent high > 250 mg/dL; owners can change ranges at setup
([balance.js](../src/data/balance.js)). Data is stale after 15 minutes.

## User stories

### 1. Earn sunlight and restore the valley

*As an owner, I want my in-range time to turn into progress I can see, so the invisible work of
managing T1D feels rewarded.*

```gherkin
Feature: Sunlight from readings

  Scenario: In-range readings earn sunlight
    Given my range is 70–180 mg/dL
    When the server stores a 5-minute reading of 120 mg/dL
    Then 1 sunlight is added to my Sun Well

  Scenario: Lows never earn
    When the server stores a reading of 62 mg/dL
    Then no sunlight is added

  Scenario: A comeback never beats staying in range
    Given I left range 40 minutes ago and spent 3 readings out of range
    When my next reading is back in range
    Then I get a comeback bonus of at most 3 sunlight
    And no more than 4 comeback bonuses are paid in a day

  Scenario: Restore a place
    Given I have 160 sunlight
    When I walk to the faded footbridge and choose restore
    Then 150 sunlight is spent
    And the footbridge fades back into color
    And the east meadow opens
```

Specs: [sunlight.md](../design/gdd/sunlight.md), [farm.md](../design/gdd/farm.md). Tests: [server/valley.test.js](../server/valley.test.js), [tests/unit/cgm.test.js](../tests/unit/cgm.test.js).

### 2. Urgent and stale states

*As an owner, I want the game to step aside when I need to treat, without making me feel punished.*

```gherkin
Feature: Safety wins

  Scenario: Urgent low as the owner
    When my newest reading is 48 mg/dL
    Then a banner that can't be dismissed says to take care of myself first
    And my character sits and treats
    And the goal arrow, jokes, gifts and prompts are hidden
    And the game keeps running

  Scenario: Stale data is never "fine"
    Given my last reading was in range
    When 16 minutes pass with no new reading
    Then nothing in the world says or implies I am in range
    And my character naps
    And the HUD shows when the last reading was
```

Spec: [safety.md](../design/gdd/safety.md) rules 1–3.

### 3. Visit a friend's valley with numbers hidden

*As a visitor, I want to see how my friend is doing and cheer them on, without seeing data they
chose not to share.*

```gherkin
Feature: Visitors

  Scenario: Open the share link with numbers hidden
    Given the owner turned off "show numbers and graph"
    When I open their share link
    Then I play in their valley without an account
    And I see no readings, graph or percentages
    And the Garden of Days still grows from rounded daily values

  Scenario: Leave a gift
    When I leave a gift at the Sun Well
    Then the owner gets 3 sunlight when they next collect, for the first 5 gifts that day
    And I can't spend the owner's sunlight

  Scenario: Urgent state while visiting
    Given the owner added an urgent contact number
    When the owner has an urgent low
    Then I see a banner to check on them with Text and Call
    And gifts are blocked until the urgent state ends
```

Spec: [visitors.md](../design/gdd/visitors.md), [safety.md](../design/gdd/safety.md) rules 11–13.

### 4. A rough day still grows something

*As an owner, I want bad days recorded without blame, so I keep coming back after them.*

```gherkin
Feature: Garden of Days

  Scenario: Day below goal
    Given yesterday's time in range was below my goal
    When the day closes at midnight
    Then a hardy shrub or cactus is planted, not a dead plant
    And its summary uses neutral wording

  Scenario: Not enough data
    Given yesterday had under 50% of expected readings
    Then a small stone marker is placed instead of a plant
    And the day is not scored

  Scenario: Nothing decays
    Given I haven't opened the game for 5 days
    When I return
    Then every restored place is still restored and no plant has withered
```

Spec: [garden-of-days.md](../design/gdd/garden-of-days.md), [safety.md](../design/gdd/safety.md) rules 5–9.

## Open questions

- Does the reward loop change how people feel about their data, or only how often they look? Needs playtests.
- Sick-day pause (safety rule 8) is specified but not built: what does a pause look like to visitors?
- How should the Sugar Peek rewards migrate (systems index item 15)?
