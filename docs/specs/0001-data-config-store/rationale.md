# 0001. Data & config store for opess: reasoning

This file is the decision record. `/develop` does not need it.

## Context

opess keeps almost nothing today. Window state lives in React memory and resets on every reload, and the widget layout lives in browser `localStorage` under one key. The upcoming slices all need durable state: the persistent desktop slice needs window and widget layout to survive a reload and a restart, the Settings app needs server level settings, the apps and containers epic needs a record of what is installed, and the sign in feature needs a place for the owner account and its secrets. The backup and restore feature needs all of it in a form that can be exported and restored.

Every feature inventing its own storage would scatter state, make backup impossible, and force a rewrite later. So opess needs one store and one way to read and write it, decided once, before the features that depend on it.

The forces at play: opess is a self hosted product for a single owner running their own server, so the data is small and there is no multi tenant scale to plan for. The owner asked for files they can read and copy by hand, which rules out an opaque database for the common case. The store holds secrets (the account's credentials), so a copy of the config directory must not hand them over. The project is solo with no deadline and runs on whatever machine the owner has, so a native dependency that must compile is a liability. The build approach is Tracer Bullet, so the first slice should prove one write through every layer, not build the whole store before anything works. There is no git yet, so there is no history to lean on, which raises the value of readable files and a last good copy.

This store is opess's own state only. Data managed by the docker apps opess runs stays in those apps' own volumes, not here.

> ⚠️ Premise note: this store has no access control of its own until the sign in feature (#27) lands. Until then, anything that can reach the opess port can read and write all state, including secrets through the store API. That is acceptable on a trusted home network and this spec records it as a documented gap, but if opess will be reachable beyond the LAN, #27 must ship before or with this store. Separately, the encryption key sits on the same host as the encrypted file, so it protects a leaked copy of the config directory, not a compromised host.

## Options considered

### Option 1: Human readable JSON files in a known config directory

One JSON file per collection, versioned, validated, written atomically, with secrets in a separate encrypted file.

**Pros**:
- Human readable, easy to inspect, diff, copy, and back up, which the owner asked for.
- No heavy dependency and no native build step.
- Fits the small, single owner dataset without any operational overhead.
- Gives Tracer Bullet an obvious thin thread: one file read and written end to end.

**Cons**:
- Schema validation, migrations, and atomic writes are hand rolled and must be tested.
- Whole document writes rewrite the file, and there is no querying.
- One writer per file, so concurrent writers are serialised rather than merged.

### Option 2: SQLite via better-sqlite3

A real relational database in one file, with transactions, migrations, and queries.

**Pros**:
- Transactions and locking solve concurrency and partial write concerns for free.
- Queries and indexes if the data ever grows or needs filtering.
- Mature migration tooling.

**Cons**:
- The store file is an opaque binary, which conflicts with the readable files requirement.
- Adds a native dependency that must build on every target machine, painful on small or odd hardware.
- More machinery than a small settings and layout store justifies.

### Option 3: A JSON store library (lowdb or conf)

A small library over a JSON file that provides a read and write API and change events.

**Pros**:
- Less of our own code for read, write, and defaults.
- Familiar pattern and quick to start.

**Cons**:
- Another dependency to track and update for a small amount of saved code.
- Still opaque about atomicity, migrations, and encryption, which we must handle ourselves anyway.
- Adds an abstraction over something simple enough to own directly.

## Rationale

The dataset is small, single owner, and must be readable, so a database buys robustness opess does not yet need at the cost of the inspectability the owner explicitly asked for and a native dependency that can fail to build on the machines opess targets. JSON files in one directory meet every stated force directly: readable, portable, dependency free, and trivial to back up. The parts a database would hand us, atomic writes, validation, and migrations, are small and bounded here and are worth owning.

This is a deliberate trade against future scale. The store is designed so the choice can change without a rewrite: all access goes through one server function surface, so the backing store can be swapped later without touching callers. The documented trigger to revisit is the first time a feature needs to query state or the data grows past comfortable whole file rewrites, at which point SQLite becomes the better fit.

The secrets design follows the same reading. Only the secrets are encrypted, so the common case stays readable and the sensitive case stays protected, and the key is kept in its own file so the encrypted blob is useless on its own. This protects the realistic threat, a copied config directory, and the spec states plainly the threat it does not cover, a compromised host.
