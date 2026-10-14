# Postgres

Date: REPLACE_WITH_TODAY

## Decision

The database is Postgres.

## Why

Postgres is much more feature-rich than SQLite and MySQL, and it is widely supported across
vendors.

## Trade-offs

Postgres is less convenient than SQLite for testing and for forking a database, since it has
to run as a separate process.

MySQL often has better performance characteristics and more extensions for horizontal
scaling. That isn't a concern for the kind of apps this stack is built for.
