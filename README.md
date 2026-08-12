# Lego-Star-Wars-Battles
Web app/game for digital and physical wargaming

## Headless balance simulations

Run every narrative mission with 25 deterministic bot-vs-bot seeds:

```powershell
npm run simulate:balance
```

Useful options:

```powershell
npm run simulate:balance -- --runs 100 --seed 1138
npm run simulate:balance -- --group standard --runs 50
npm run simulate:balance -- --group all --runs 25
npm run simulate:balance -- --scenario geonosis-heart-of-factory --runs 50
npm run simulate:balance -- --runs 10 --json
```

The report includes mission outcomes, duration, remaining combat power,
Mission Director interventions, passed activations and AI loop warnings.
